from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import numpy as np
from ..processing.slope import calculate_slope_map

router = APIRouter(prefix="/api/terrain", tags=["terrain"])

class SlopeRequest(BaseModel):
    dsm_data: List[float]
    width: int
    height: int
    pixel_spacing_x: Optional[float] = 1.0
    pixel_spacing_y: Optional[float] = 1.0

class PointInspectRequest(BaseModel):
    x: int
    y: int
    width: int
    height: int
    dsm_data: List[float]
    transform: Optional[List[float]] = None
    crs: Optional[str] = None

@router.post("/slope")
async def get_slope(req: SlopeRequest):
    """
    Computes topographic surface slope map and statistics.
    """
    if len(req.dsm_data) != req.width * req.height:
        raise HTTPException(status_code=400, detail="dsm_data length does not match width * height")

    dsm = np.array(req.dsm_data, dtype=np.float32).reshape((req.height, req.width))
    slope_deg, stats, b64 = calculate_slope_map(
        dsm,
        pixel_spacing_x=req.pixel_spacing_x or 1.0,
        pixel_spacing_y=req.pixel_spacing_y or 1.0
    )

    return {
        "status": "success",
        "stats": stats,
        "slope_base64": b64
    }

@router.post("/inspect")
async def inspect_point(req: PointInspectRequest):
    """
    Point Elevation Inspector:
    Given pixel (x, y), returns elevation, slope, and geographic coordinates (Lat/Lon).
    """
    if req.x < 0 or req.x >= req.width or req.y < 0 or req.y >= req.height:
        raise HTTPException(status_code=400, detail=f"Coordinates ({req.x}, {req.y}) are out of bounds.")

    idx = req.y * req.width + req.x
    elevation = float(req.dsm_data[idx])

    # Compute local slope around (x, y)
    dsm = np.array(req.dsm_data, dtype=np.float32).reshape((req.height, req.width))
    y_min, y_max = max(0, req.y - 1), min(req.height - 1, req.y + 1)
    x_min, x_max = max(0, req.x - 1), min(req.width - 1, req.x + 1)

    dz_dx = (float(dsm[req.y, x_max]) - float(dsm[req.y, x_min])) / max(x_max - x_min, 1)
    dz_dy = (float(dsm[y_max, req.x]) - float(dsm[y_min, req.x])) / max(y_max - y_min, 1)
    slope_deg = float(np.degrees(np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))))

    # Geographic projection if transform available
    lat = None
    lon = None
    if req.transform and len(req.transform) >= 6:
        # Affine: X_geo = a*x + b*y + c, Y_geo = d*x + e*y + f
        a, b, c, d, e, f = req.transform[:6]
        geo_x = a * req.x + b * req.y + c
        geo_y = d * req.x + e * req.y + f
        
        # If in EPSG:4326 or lon/lat
        if req.crs and ("4326" in req.crs or "WGS 84" in req.crs):
            lon = round(geo_x, 6)
            lat = round(geo_y, 6)
        else:
            lon = round(geo_x, 2)
            lat = round(geo_y, 2)

    return {
        "x": req.x,
        "y": req.y,
        "elevation": round(elevation, 2),
        "slope_deg": round(slope_deg, 1),
        "latitude": lat,
        "longitude": lon,
        "crs": req.crs
    }
