import rasterio
from rasterio.io import MemoryFile
from rasterio.transform import Affine
from PIL import Image
import numpy as np
import io
import os
from typing import Tuple, Dict, Any, Optional

def read_geotiff_as_rgb(filepath: str) -> Tuple[Image.Image, Optional[Affine], Optional[Any]]:
    """
    Reads a GeoTIFF, extracts RGB (or panchromatic converted to RGB),
    normalizes uint16/float bands to uint8, and returns PIL Image with transform and CRS.
    """
    with rasterio.open(filepath) as src:
        crs = src.crs
        transform = src.transform
        count = src.count

        if count >= 3:
            # Multi-band RGB (bands 1, 2, 3)
            data = src.read([1, 2, 3])
            # Reorder from (bands, H, W) to (H, W, bands)
            rgb = np.moveaxis(data, 0, -1)
        else:
            # Single-band / panchromatic
            band1 = src.read(1)
            rgb = np.stack([band1, band1, band1], axis=-1)

        # Normalize dynamic range to uint8
        rgb_norm = np.zeros_like(rgb, dtype=np.uint8)
        for i in range(3):
            ch = rgb[:, :, i].astype(np.float32)
            cmin, cmax = np.nanpercentile(ch, 1), np.nanpercentile(ch, 99)
            if cmax - cmin > 1e-5:
                scaled = np.clip((ch - cmin) / (cmax - cmin) * 255.0, 0, 255)
            else:
                scaled = np.zeros_like(ch)
            rgb_norm[:, :, i] = scaled.astype(np.uint8)

        pil_img = Image.fromarray(rgb_norm)
        return pil_img, transform, crs

def write_geotiff(
    output_path: str,
    data: np.ndarray,
    transform: Optional[Affine] = None,
    crs: Optional[Any] = "EPSG:4326",
    nodata: float = -9999.0
) -> bytes:
    """
    Writes a 2D float32 numpy array as a georeferenced GeoTIFF.
    Saves to output_path and returns the raw bytes.
    """
    data_out = data.astype(np.float32)
    # Replace NaNs with nodata
    data_out = np.nan_to_num(data_out, nan=nodata)

    t = transform if transform is not None else Affine.identity()
    c = crs if crs is not None else "EPSG:4326"

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    with rasterio.open(
        output_path,
        "w",
        driver="GTiff",
        height=data_out.shape[0],
        width=data_out.shape[1],
        count=1,
        dtype="float32",
        crs=c,
        transform=t,
        nodata=nodata
    ) as dst:
        dst.write(data_out, 1)

    with open(output_path, "rb") as f:
        return f.read()
