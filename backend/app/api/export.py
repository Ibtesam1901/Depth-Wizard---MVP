from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import numpy as np
import os
import io
from ..geospatial.geotiff import write_geotiff
from rasterio.transform import Affine

router = APIRouter(prefix="/api/export", tags=["export"])

EXPORTS_DIR = "exports"
os.makedirs(EXPORTS_DIR, exist_ok=True)

class GeoTIFFExportRequest(BaseModel):
    filename: str
    dsm_data: List[float]
    width: int
    height: int
    transform: Optional[List[float]] = None
    crs: Optional[str] = "EPSG:4326"

class ReportRequest(BaseModel):
    filename: str
    format: str
    crs: Optional[str] = "None"
    resolution: Optional[str] = "1.0 m"
    bounds: Optional[Dict[str, float]] = None
    calibration_method: str = "scene_prior"
    scale: Optional[float] = 1.0
    offset: Optional[float] = 0.0
    min_elev: float
    max_elev: float
    mean_elev: float
    range_elev: float
    mae: Optional[float] = None
    rmse: Optional[float] = None
    correlation: Optional[float] = None
    dsm_type: str = "metric"

@router.post("/geotiff")
async def export_geotiff(req: GeoTIFFExportRequest):
    """
    Generates and saves a georeferenced GeoTIFF DSM.
    """
    if len(req.dsm_data) != req.width * req.height:
        raise HTTPException(status_code=400, detail="Data size does not match dimensions.")

    arr = np.array(req.dsm_data, dtype=np.float32).reshape((req.height, req.width))
    t = Affine(*req.transform[:6]) if req.transform and len(req.transform) >= 6 else Affine.identity()
    
    out_name = f"dsm_{os.path.splitext(os.path.basename(req.filename))[0]}.tif"
    out_path = os.path.join(EXPORTS_DIR, out_name)
    
    write_geotiff(out_path, arr, transform=t, crs=req.crs)

    return {
        "status": "success",
        "export_filename": out_name,
        "download_url": f"/download-dsm/{out_name}"
    }

@router.post("/numpy")
async def export_numpy(req: GeoTIFFExportRequest):
    """
    Returns raw float32 elevation array as a downloadable .npy file.
    """
    arr = np.array(req.dsm_data, dtype=np.float32).reshape((req.height, req.width))
    buf = io.BytesIO()
    np.save(buf, arr)
    buf.seek(0)
    
    out_name = f"raw_elevation_{os.path.splitext(os.path.basename(req.filename))[0]}.npy"
    return Response(
        content=buf.getvalue(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.post("/report")
async def generate_report(req: ReportRequest):
    """
    Generates a technical DepthWizard Processing & Accuracy Report.
    """
    report_lines = [
        "=======================================================================",
        "                   DEPTHWIZARD 2.0 PROCESSING REPORT                   ",
        "      Single-View Height Estimation and 3D Flythrough Pipeline         ",
        "              Smart India Hackathon • ISRO PS 26175                   ",
        "=======================================================================",
        "",
        "1. INPUT IMAGERY METADATA",
        "-----------------------------------------------------------------------",
        f"Filename:               {req.filename}",
        f"Input Format:           {req.format}",
        f"CRS / Projection:       {req.crs}",
        f"Ground Resolution:      {req.resolution}",
        f"Spatial Bounds:         {req.bounds if req.bounds else 'Unreferenced'}",
        "",
        "2. MONOCULAR DEPTH BACKBONE",
        "-----------------------------------------------------------------------",
        "Model Architecture:     Depth Anything V2 (Vision Transformer)",
        "Depth Representation:   Continuous uncalibrated relative disparity",
        "Spatial Edge Filter:    Sobel Gradient Dispersion Index",
        "",
        "3. GEOSPATIAL CALIBRATION",
        "-----------------------------------------------------------------------",
        f"Elevation Mode:         {req.dsm_type.upper()}",
        f"Calibration Scheme:     {req.calibration_method}",
        f"Affine Scale (a):       {req.scale:.4f}" if req.scale else "Affine Scale (a):       1.0000",
        f"Affine Offset (b):      {req.offset:.4f}" if req.offset else "Affine Offset (b):      0.0000",
        "Equation:               Z_metric = a * D_relative + b",
        "",
        "4. TOPOGRAPHIC ELEVATION STATISTICS",
        "-----------------------------------------------------------------------",
        f"Minimum Elevation:      {req.min_elev:.2f} {'m' if req.dsm_type == 'metric' else 'units'}",
        f"Maximum Elevation:      {req.max_elev:.2f} {'m' if req.dsm_type == 'metric' else 'units'}",
        f"Mean Elevation:         {req.mean_elev:.2f} {'m' if req.dsm_type == 'metric' else 'units'}",
        f"Total Relief Range:     {req.range_elev:.2f} {'m' if req.dsm_type == 'metric' else 'units'}",
        "",
        "5. SCIENTIFIC VALIDATION METRICS",
        "-----------------------------------------------------------------------",
        f"Root Mean Square Error: {f'{req.rmse:.3f} m' if req.rmse is not None else 'N/A (No ground truth supplied)'}",
        f"Mean Absolute Error:    {f'{req.mae:.3f} m' if req.mae is not None else 'N/A (No ground truth supplied)'}",
        f"Pearson Correlation (r):{f'{req.correlation:.3f}' if req.correlation is not None else 'N/A'}",
        "",
        "6. VISUALIZATION & INTERACTIVE FLYTHROUGH",
        "-----------------------------------------------------------------------",
        "3D Engine:              Three.js WebGL BufferGeometry",
        "Navigation Capabilities:PointerLock First-Person Flythrough, 6-DOF Orbit",
        "Measurement Tools:      Structure Height Differencing, Point Inspector",
        "Texture Projection:     Optical RGB Orthorectification",
        "",
        "=======================================================================",
        "                    END OF DEPTHWIZARD REPORT                         ",
        "======================================================================="
    ]

    report_text = "\n".join(report_lines)
    return PlainTextResponse(
        content=report_text,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="DepthWizard_Report_{os.path.splitext(req.filename)[0]}.txt"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
