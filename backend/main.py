from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from depth_infer import get_relative_depth
from geotiff_io import load_geotiff, save_dsm
from calibrate import fit_scale_offset, to_metric_dsm
from validate import compute_metrics
import os
import shutil
import numpy as np
import base64
from PIL import Image
import io
import cv2
import rasterio
from rasterio.io import MemoryFile

app = FastAPI(title="DepthWizard API", description="Single-View Height Estimation & 3D Flythrough Pipeline")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

EXPORTS_DIR = "exports"
os.makedirs(EXPORTS_DIR, exist_ok=True)

def array_to_base64(arr, colormap=None):
    if arr.dtype != np.uint8:
        arr_norm = ((arr - np.nanmin(arr)) / (np.nanmax(arr) - np.nanmin(arr) + 1e-8) * 255).astype(np.uint8)
    else:
        arr_norm = arr

    if colormap is not None:
        arr_norm = cv2.applyColorMap(arr_norm, colormap)
        arr_norm = cv2.cvtColor(arr_norm, cv2.COLOR_BGR2RGB)

    img = Image.fromarray(arr_norm)
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

def image_file_to_base64(filepath):
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
    temp_path = f"temp_{file.filename}"
    ref_temp_path = f"ref_temp_{reference_file.filename}" if reference_file else None

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    if reference_file:
        with open(ref_temp_path, "wb") as buffer:
            shutil.copyfileobj(reference_file.file, buffer)
            
    try:
        is_geotiff = temp_path.lower().endswith(('.tif', '.tiff'))
        is_h5 = temp_path.lower().endswith('.h5')
        
        if mode == 'relative':
            is_geotiff = False
            
        geo_metadata = None
        scaled_transform = None
        
        # 1. Inspect Georeferencing Metadata before any transformations
        if is_geotiff:
            try:
                geo_metadata = load_geotiff(temp_path)
            except Exception as e:
                print(f"Warning reading GeoTIFF metadata: {e}")

        # 2. Ingest Imagery
        if is_h5:
            import h5py
            with h5py.File(temp_path, 'r') as f:
                img_data = np.array(f[list(f.keys())[0]])
            original_img = Image.fromarray(img_data)
            temp_path_jpg = temp_path + ".jpg"
            original_img.save(temp_path_jpg)
            os.remove(temp_path)
            temp_path = temp_path_jpg
        else:
            original_img = Image.open(temp_path).convert("RGB")
            
        orig_w, orig_h = original_img.size
        max_dim = 256
        if max(original_img.size) > max_dim:
            original_img.thumbnail((max_dim, max_dim))
            original_img.save(temp_path)
            if geo_metadata and "transform" in geo_metadata:
                scale_x = orig_w / original_img.size[0]
                scale_y = orig_h / original_img.size[1]
                scaled_transform = geo_metadata["transform"] * rasterio.Affine.scale(scale_x, scale_y)
        else:
            if geo_metadata and "transform" in geo_metadata:
                scaled_transform = geo_metadata["transform"]
            
        rgb_b64 = image_file_to_base64(temp_path)
        
        # 3. Monocular Depth Estimation Backbone
        relative_depth = get_relative_depth(temp_path)
        depth_b64 = array_to_base64(relative_depth, cv2.COLORMAP_VIRIDIS)
        
        # 4. Uncertainty / Confidence Map (Sobel Spatial Gradient Analysis)
        sobelx = cv2.Sobel(relative_depth, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(relative_depth, cv2.CV_64F, 0, 1, ksize=3)
        edges = np.sqrt(sobelx**2 + sobely**2)
        confidence = 1.0 - (edges / (np.max(edges) + 1e-8))
        confidence_b64 = array_to_base64(confidence, cv2.COLORMAP_PLASMA)
        
        # 5. Metric Scale Calibration Engine
        metric_dsm = None
        metrics = None
        error_b64 = None
        calibration_method = "none"

        if reference_file:
            # Calibrate against ground-truth reference raster
            with rasterio.open(ref_temp_path) as src:
                ref_band = src.read(1)
            reference_dem = cv2.resize(ref_band, (relative_depth.shape[1], relative_depth.shape[0]))
            
            a, b = fit_scale_offset(relative_depth, reference_dem)
            metric_dsm = to_metric_dsm(relative_depth, a, b)
            calibration_method = "ground_truth_regression"
            
            metrics = compute_metrics(metric_dsm, reference_dem)
            error_b64 = array_to_base64(np.abs(metrics["diff_map"]), cv2.COLORMAP_JET)
        elif is_geotiff:
            # Georeferenced image without reference: scale via scene prior calibration
            metric_dsm = to_metric_dsm(relative_depth, 100.0, 15.0)
            calibration_method = "scene_prior"
            
        active_dsm = metric_dsm if metric_dsm is not None else relative_depth
        dsm_type = "metric" if metric_dsm is not None else "relative"

        # 6. Standard Geospatial Export (GeoTIFF Generation)
        export_filename = f"dsm_{os.path.splitext(os.path.basename(file.filename))[0]}.tif"
        export_path = os.path.join(EXPORTS_DIR, export_filename)
        
        crs_to_use = geo_metadata["crs"] if (geo_metadata and geo_metadata.get("crs")) else "EPSG:4326"
        transform_to_use = scaled_transform if scaled_transform else rasterio.Affine.identity()
        
        dsm_export_data = active_dsm.astype(np.float32)
        with MemoryFile() as memfile:
            with memfile.open(
                driver='GTiff',
                height=dsm_export_data.shape[0],
                width=dsm_export_data.shape[1],
                count=1,
                dtype='float32',
                crs=crs_to_use,
                transform=transform_to_use,
            ) as dst:
                dst.write(dsm_export_data, 1)
            geotiff_bytes = memfile.read()
            geotiff_b64 = base64.b64encode(geotiff_bytes).decode('utf-8')
            
        with open(export_path, "wb") as f_out:
            f_out.write(geotiff_bytes)

        result = {
            "status": "success",
            "is_geotiff": is_geotiff,
            "is_h5": is_h5,
            "crs": str(geo_metadata["crs"]) if (geo_metadata and geo_metadata.get("crs")) else None,
            "bounds": list(geo_metadata["bounds"]) if (geo_metadata and geo_metadata.get("bounds")) else None,
            "pixel_size": list(geo_metadata["pixel_size"]) if (geo_metadata and geo_metadata.get("pixel_size")) else None,
            "width": active_dsm.shape[1],
            "height": active_dsm.shape[0],
            "rgb_base64": rgb_b64,
            "depth_base64": depth_b64,
            "confidence_base64": confidence_b64,
            "error_base64": error_b64,
            "geotiff_base64": geotiff_b64,
            "export_filename": export_filename,
            "download_url": f"/download-dsm/{export_filename}",
            "dsm_data": active_dsm.flatten().tolist(),
            "dsm_type": dsm_type,
            "calibration_method": calibration_method,
            "min_elev": float(np.nanmin(active_dsm)),
            "max_elev": float(np.nanmax(active_dsm)),
            "mean_elev": float(np.nanmean(active_dsm)),
            "range_elev": float(np.nanmax(active_dsm) - np.nanmin(active_dsm)),
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
