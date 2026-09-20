from fastapi import FastAPI, UploadFile, File, Form
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

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

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
            
        max_dim = 256
        if max(original_img.size) > max_dim:
            original_img.thumbnail((max_dim, max_dim))
            original_img.save(temp_path)
            
        rgb_b64 = image_file_to_base64(temp_path)
        
        # 1. Depth Estimation
        relative_depth = get_relative_depth(temp_path)
        depth_b64 = array_to_base64(relative_depth, cv2.COLORMAP_VIRIDIS)
        
        # Confidence Map
        sobelx = cv2.Sobel(relative_depth, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(relative_depth, cv2.CV_64F, 0, 1, ksize=3)
        edges = np.sqrt(sobelx**2 + sobely**2)
        confidence = 1.0 - (edges / (np.max(edges) + 1e-8))
        confidence_b64 = array_to_base64(confidence, cv2.COLORMAP_PLASMA)
        
        result = {
            "status": "success",
            "is_geotiff": is_geotiff,
            "is_h5": is_h5,
            "width": relative_depth.shape[1],
            "height": relative_depth.shape[0],
            "rgb_base64": rgb_b64,
            "depth_base64": depth_b64,
            "confidence_base64": confidence_b64,
            "dsm_data": relative_depth.flatten().tolist(), 
            "dsm_type": "relative",
            "min_elev": float(np.nanmin(relative_depth)),
            "max_elev": float(np.nanmax(relative_depth)),
            "mean_elev": float(np.nanmean(relative_depth)),
            "range_elev": float(np.nanmax(relative_depth) - np.nanmin(relative_depth))
        }
        
        # 2. Metric Calibration & Validation
        if reference_file:
            import rasterio
            with rasterio.open(ref_temp_path) as src:
                ref_band = src.read(1)
            reference_dem = cv2.resize(ref_band, (relative_depth.shape[1], relative_depth.shape[0]))
            
            a, b = fit_scale_offset(relative_depth, reference_dem)
            metric_dsm = to_metric_dsm(relative_depth, a, b)
            
            metrics = compute_metrics(metric_dsm, reference_dem)
            error_b64 = array_to_base64(np.abs(metrics["diff_map"]), cv2.COLORMAP_JET)
            
            if is_geotiff:
                geo_data = load_geotiff(temp_path)
                out_dsm_path = f"dsm_{file.filename}"
                save_dsm(out_dsm_path, metric_dsm, geo_data["transform"], geo_data["crs"])
            
            result.update({
                "dsm_type": "metric",
                "dsm_data": metric_dsm.flatten().tolist(),
                "min_elev": float(np.nanmin(metric_dsm)),
                "max_elev": float(np.nanmax(metric_dsm)),
                "mean_elev": float(np.nanmean(metric_dsm)),
                "range_elev": float(np.nanmax(metric_dsm) - np.nanmin(metric_dsm)),
                "mae": metrics["mae"],
                "rmse": metrics["rmse"],
                "correlation": metrics["correlation"],
                "error_base64": error_b64
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
