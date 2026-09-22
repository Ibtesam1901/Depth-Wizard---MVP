import numpy as np
import cv2
from PIL import Image
import io
import base64
from typing import Dict, Any, Tuple

def calculate_slope_map(
    dsm: np.ndarray,
    pixel_spacing_x: float = 1.0,
    pixel_spacing_y: float = 1.0
) -> Tuple[np.ndarray, Dict[str, float], str]:
    """
    Computes topographic surface slope in degrees using 2D spatial gradients.
    
    Parameters:
        dsm: 2D numpy array of elevation (meters or relative units)
        pixel_spacing_x: Ground resolution along X (meters)
        pixel_spacing_y: Ground resolution along Y (meters)
        
    Returns:
        slope_deg: 2D float32 array of slope in degrees [0, 90]
        stats: dictionary with min_slope, max_slope, mean_slope, median_slope
        base64_img: colorized PNG slope map
    """
    # Guard against invalid spacing
    dx = max(float(pixel_spacing_x), 0.01)
    dy = max(float(pixel_spacing_y), 0.01)

    # Compute numerical gradients
    grad_y, grad_x = np.gradient(dsm, dy, dx)

    # Slope in radians
    slope_rad = np.arctan(np.sqrt(grad_x**2 + grad_y**2))
    slope_deg = np.degrees(slope_rad).astype(np.float32)

    # Elevation statistics
    min_slope = float(np.nanmin(slope_deg))
    max_slope = float(np.nanmax(slope_deg))
    mean_slope = float(np.nanmean(slope_deg))
    median_slope = float(np.nanmedian(slope_deg))

    stats = {
        "min_slope": round(min_slope, 1),
        "max_slope": round(max_slope, 1),
        "mean_slope": round(mean_slope, 1),
        "median_slope": round(median_slope, 1),
    }

    # Colorize slope: normalized to standard 0-60 degree terrain range
    slope_norm = np.clip(slope_deg / 60.0 * 255.0, 0, 255).astype(np.uint8)
    color_map = cv2.applyColorMap(slope_norm, cv2.COLORMAP_TURBO)
    color_rgb = cv2.cvtColor(color_map, cv2.COLOR_BGR2RGB)

    img = Image.fromarray(color_rgb)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return slope_deg, stats, b64
