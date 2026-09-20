import rasterio
import numpy as np

def load_geotiff(path: str):
    with rasterio.open(path) as src:
        rgb = src.read([1, 2, 3])              # bands
        transform = src.transform               # affine
        crs = src.crs
        bounds = src.bounds
        pixel_size_x = transform.a
        pixel_size_y = -transform.e
    return {
        "rgb": np.moveaxis(rgb, 0, -1),
        "transform": transform,
        "crs": crs,
        "bounds": bounds,
        "pixel_size": (pixel_size_x, pixel_size_y),
    }

def save_dsm(output_path: str, dsm_data: np.ndarray, transform, crs):
    with rasterio.open(
        output_path,
        'w',
        driver='GTiff',
        height=dsm_data.shape[0],
        width=dsm_data.shape[1],
        count=1,
        dtype=dsm_data.dtype,
        crs=crs,
        transform=transform,
    ) as dst:
        dst.write(dsm_data, 1)
