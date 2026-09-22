from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import os
import shutil
import numpy as np
import base64
from PIL import Image
import io
import cv2

from .models.depth_model import DepthEstimator, compute_spatial_confidence
from .geospatial.metadata import extract_geospatial_metadata
from .geospatial.geotiff import read_geotiff_as_rgb, write_geotiff
from .geospatial.calibration import robust_fit_scale_offset, to_metric_dsm
from .processing.slope import calculate_slope_map
from .validation.metrics import compute_validation_metrics

from .api.upload import router as upload_router
from .api.terrain import router as terrain_router
from .api.validation import router as validation_router
from .api.export import router as export_router

app = FastAPI(
    title="DepthWizard 2.0 API",
    description="Single-View Height Estimation & 3D Flythrough Pipeline (ISRO PS 26175)",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Mount modular routers
app.include_router(upload_router)
app.include_router(terrain_router)
app.include_router(validation_router)
app.include_router(export_router)

EXPORTS_DIR = "exports"
os.makedirs(EXPORTS_DIR, exist_ok=True)

@app.get("/")
@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "service": "DepthWizard 2.0 API",
        "architecture": "Modular FastAPI + Depth Anything V2 + Rasterio",
        "version": "2.0.0"
    }

def array_to_base64(arr: np.ndarray, colormap=None) -> str:
    if arr.dtype != np.uint8:
        cmin = float(np.nanmin(arr))
        cmax = float(np.nanmax(arr))
        rng = cmax - cmin if (cmax - cmin) > 1e-8 else 1.0
        arr_norm = ((arr - cmin) / rng * 255.0).astype(np.uint8)
    else:
        arr_norm = arr

    if colormap is not None:
        arr_norm = cv2.applyColorMap(arr_norm, colormap)
        arr_norm = cv2.cvtColor(arr_norm, cv2.COLOR_BGR2RGB)

    img = Image.fromarray(arr_norm)
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

def image_file_to_base64(filepath: str) -> str:
    with open(filepath, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

@app.get("/download-dsm/{filename}")
async def download_dsm(filename: str):
    file_path = os.path.join(EXPORTS_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="image/tiff",
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    return {"error": "File not found"}

@app.post("/process")
async def process(
    file: UploadFile = File(...),
    reference_file: Optional[UploadFile] = File(None),
    mode: str = Form("auto"),
    calibration: str = Form("srtm")
):
    """
    Unified end-to-end processing endpoint:
    1. Ingests RGB / GeoTIFF / H5 imagery and parses geospatial metadata.
    2. Runs Depth Anything V2 monocular depth estimation.
    3. Mode A (rDSM) for unreferenced files or Mode B (calibrated metric DSM) for GeoTIFF / Reference.
    4. Computes topographic surface slope map.
    5. Computes validation metrics (MAE, RMSE, Pearson r, scatter plot) if reference is provided.
    6. Generates georeferenced GeoTIFF DSM export.
    """
    temp_path = f"temp_{os.urandom(4).hex()}_{file.filename}"
    ref_temp_path = f"ref_temp_{os.urandom(4).hex()}_{reference_file.filename}" if reference_file else None

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if reference_file:
        with open(ref_temp_path, "wb") as buffer:
            shutil.copyfileobj(reference_file.file, buffer)

    import time
    t_start = time.perf_counter()

    try:
        ext = os.path.splitext(file.filename)[1].lower()
        is_geotiff = ext in ['.tif', '.tiff']
        is_h5 = ext == '.h5'

        if mode == 'relative':
            is_geotiff = False

        # 1. Geospatial Metadata Extraction
        t0 = time.perf_counter()
        geo_metadata = extract_geospatial_metadata(temp_path)
        
        # 2. Ingest Imagery into PIL Image
        if is_geotiff:
            pil_img, geo_transform, geo_crs = read_geotiff_as_rgb(temp_path)
        elif is_h5:
            import h5py
            with h5py.File(temp_path, 'r') as f:
                img_data = np.array(f[list(f.keys())[0]])
            pil_img = Image.fromarray(img_data).convert("RGB")
            geo_transform, geo_crs = None, None
        else:
            pil_img = Image.open(temp_path).convert("RGB")
            geo_transform, geo_crs = None, None

        orig_w, orig_h = pil_img.size

        # Cloud safety: adaptively resize for RAM constraints
        max_dim = 256
        if max(orig_w, orig_h) > max_dim:
            pil_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        
        # Save processed RGB for base64 return
        buf_rgb = io.BytesIO()
        pil_img.save(buf_rgb, format="PNG")
        rgb_b64 = base64.b64encode(buf_rgb.getvalue()).decode("utf-8")
        t_ingest = time.perf_counter() - t0

        # 3. Monocular Depth Estimation (Depth Anything V2)
        t0 = time.perf_counter()
        depth_estimator = DepthEstimator.get_instance()
        raw_depth, norm_depth = depth_estimator.infer(pil_img)
        depth_b64 = array_to_base64(norm_depth, cv2.COLORMAP_VIRIDIS)

        # 4. Spatial Confidence / Dispersion Index
        confidence = compute_spatial_confidence(norm_depth)
        confidence_b64 = array_to_base64(confidence, cv2.COLORMAP_PLASMA)
        t_depth = time.perf_counter() - t0

        # 5. Metric Scale Calibration Engine
        t0 = time.perf_counter()
        metric_dsm = None
        metrics = None
        error_b64 = None
        scatter_points = []
        calibration_method = "none"
        scale_a, offset_b = 1.0, 0.0

        if reference_file and ref_temp_path and os.path.exists(ref_temp_path):
            import rasterio
            with rasterio.open(ref_temp_path) as ref_src:
                ref_band = ref_src.read(1)
            
            # Robust Affine Calibration against Ground Truth Reference
            scale_a, offset_b, cal_rmse = robust_fit_scale_offset(norm_depth, ref_band)
            metric_dsm = to_metric_dsm(norm_depth, scale_a, offset_b)
            calibration_method = "robust_dem_regression"

            # Compute Scientific Validation Metrics
            val_results = compute_validation_metrics(metric_dsm, ref_band)
            metrics = {
                "mae": val_results["mae"],
                "rmse": val_results["rmse"],
                "correlation": val_results["correlation"],
            }
            error_b64 = val_results["error_b64"]
            scatter_points = val_results["scatter_points"]
        elif is_geotiff:
            # Mode B: Georeferenced scene prior calibration (defaulting to 100m relief, 15m base)
            scale_a, offset_b = 100.0, 15.0
            metric_dsm = to_metric_dsm(norm_depth, scale_a, offset_b)
            calibration_method = "geospatial_scene_prior"

        active_dsm = metric_dsm if metric_dsm is not None else norm_depth
        dsm_type = "metric" if metric_dsm is not None else "relative"
        t_calib = time.perf_counter() - t0

        # 6. Topographic Slope Map Generation
        t0 = time.perf_counter()
        center_lat = (geo_metadata["bounds"]["bottom"] + geo_metadata["bounds"]["top"]) / 2.0 if (geo_metadata and geo_metadata.get("bounds")) else 20.0
        slope_deg, slope_stats, slope_b64 = calculate_slope_map(
            active_dsm,
            pixel_spacing_x=geo_metadata["resolution"]["x"] if is_geotiff else 1.0,
            pixel_spacing_y=geo_metadata["resolution"]["y"] if is_geotiff else 1.0,
            crs=geo_metadata.get("crs") if is_geotiff else None,
            latitude=center_lat
        )
        t_slope = time.perf_counter() - t0

        # 7. GeoTIFF Export Generation
        t0 = time.perf_counter()
        export_filename = f"dsm_{os.path.splitext(os.path.basename(file.filename))[0]}.tif"
        export_path = os.path.join(EXPORTS_DIR, export_filename)

        crs_to_use = geo_metadata["crs"] if (is_geotiff and geo_metadata["georeferenced"]) else "EPSG:4326"
        transform_to_use = geo_transform if is_geotiff else None
        
        geotiff_bytes = write_geotiff(
            export_path,
            active_dsm,
            transform=transform_to_use,
            crs=crs_to_use
        )
        geotiff_b64 = base64.b64encode(geotiff_bytes).decode("utf-8")
        t_export = time.perf_counter() - t0
        t_total = time.perf_counter() - t_start

        # Elevation Analysis Statistics
        min_elev = float(np.nanmin(active_dsm))
        max_elev = float(np.nanmax(active_dsm))
        mean_elev = float(np.nanmean(active_dsm))
        median_elev = float(np.nanmedian(active_dsm))
        range_elev = float(max_elev - min_elev)

        result = {
            "status": "success",
            "filename": file.filename,
            "format": geo_metadata["format"],
            "is_geotiff": is_geotiff,
            "georeferenced": geo_metadata["georeferenced"],
            "crs": geo_metadata["crs"],
            "epsg": geo_metadata["epsg"],
            "bounds": geo_metadata["bounds"],
            "resolution": geo_metadata["resolution"],
            "transform": geo_metadata["transform"],
            "width": active_dsm.shape[1],
            "height": active_dsm.shape[0],
            "rgb_base64": rgb_b64,
            "depth_base64": depth_b64,
            "confidence_base64": confidence_b64,
            "slope_base64": slope_b64,
            "error_base64": error_b64,
            "geotiff_base64": geotiff_b64,
            "export_filename": export_filename,
            "download_url": f"/download-dsm/{export_filename}",
            "dsm_data": active_dsm.flatten().tolist(),
            "dsm_type": dsm_type,
            "calibration": {
                "method": calibration_method,
                "scale": round(scale_a, 4),
                "offset": round(offset_b, 4)
            },
            "elevation_stats": {
                "min": round(min_elev, 2),
                "max": round(max_elev, 2),
                "mean": round(mean_elev, 2),
                "median": round(median_elev, 2),
                "range": round(range_elev, 2),
                "unit": "meters" if dsm_type == "metric" else "relative units"
            },
            "slope_stats": slope_stats,
            "scatter_points": scatter_points,
            # Top-level legacy aliases for complete frontend backward-compatibility
            "min_elev": min_elev,
            "max_elev": max_elev,
            "mean_elev": mean_elev,
            "range_elev": range_elev,
            "timings": {
                "ingest_metadata": round(t_ingest, 2),
                "depth_inference": round(t_depth, 2),
                "calibration": round(t_calib, 2),
                "slope_analysis": round(t_slope, 2),
                "geotiff_export": round(t_export, 2),
                "total": round(t_total, 2)
            }
        }

        if metrics:
            result.update({
                "mae": metrics["mae"],
                "rmse": metrics["rmse"],
                "correlation": metrics["correlation"],
            })

        return result
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if ref_temp_path and os.path.exists(ref_temp_path):
            os.remove(ref_temp_path)
