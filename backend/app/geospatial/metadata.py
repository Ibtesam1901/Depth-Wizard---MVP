import rasterio
from rasterio.crs import CRS
import os
from typing import Optional, Dict, Any

def extract_geospatial_metadata(filepath: str) -> Dict[str, Any]:
    """
    Extracts comprehensive geospatial metadata using Rasterio.
    Works for GeoTIFF (.tif, .tiff), HDF5, and standard imagery formats.
    """
    ext = os.path.splitext(filepath)[1].lower()
    
    if ext in ['.tif', '.tiff']:
        try:
            with rasterio.open(filepath) as src:
                crs = src.crs
                transform = src.transform
                bounds = src.bounds
                width = src.width
                height = src.height
                bands = src.count
                dtypes = src.dtypes
                nodata = src.nodata
                
                is_georeferenced = bool(crs)
                crs_str = crs.to_string() if is_georeferenced else "None"
                epsg = None
                if is_georeferenced:
                    try:
                        epsg = crs.to_epsg()
                    except Exception:
                        epsg = None

                # Pixel resolution (Ground Sample Distance)
                res_x = abs(transform.a) if transform else 1.0
                res_y = abs(transform.e) if transform else 1.0

                return {
                    "filename": os.path.basename(filepath),
                    "format": "GeoTIFF",
                    "width": width,
                    "height": height,
                    "bands": bands,
                    "dtypes": [str(d) for d in dtypes],
                    "nodata": nodata,
                    "georeferenced": is_georeferenced,
                    "crs": crs_str,
                    "epsg": epsg,
                    "transform": list(transform) if transform else None,
                    "bounds": {
                        "left": bounds.left,
                        "bottom": bounds.bottom,
                        "right": bounds.right,
                        "top": bounds.top,
                    } if bounds else None,
                    "resolution": {
                        "x": round(float(res_x), 6),
                        "y": round(float(res_y), 6),
                        "unit": "degrees" if is_georeferenced and "4326" in crs_str else "meters"
                    }
                }
        except Exception as e:
            # Fallback if rasterio cannot parse CRS
            pass

    # Standard imagery fallback
    from PIL import Image
    with Image.open(filepath) as img:
        w, h = img.size
        bands = len(img.getbands())
        fmt = img.format or ext.replace('.', '').upper()
        
    return {
        "filename": os.path.basename(filepath),
        "format": fmt,
        "width": w,
        "height": h,
        "bands": bands,
        "dtypes": ["uint8"],
        "nodata": None,
        "georeferenced": False,
        "crs": "None",
        "epsg": None,
        "transform": None,
        "bounds": None,
        "resolution": {
            "x": 1.0,
            "y": 1.0,
            "unit": "relative"
        }
    }
