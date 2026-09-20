import numpy as np
from scipy.optimize import curve_fit

def fit_scale_offset(relative_depth: np.ndarray, reference_dem: np.ndarray):
    """
    relative_depth: normalized model output, same shape as reference_dem
    reference_dem: resampled SRTM values (meters), same grid
    Returns a, b such that  metric_elevation ≈ a * relative_depth + b
    """
    mask = ~np.isnan(reference_dem)
    D = relative_depth[mask].ravel()
    R = reference_dem[mask].ravel()

    def linear(x, a, b):
        return a * x + b

    (a, b), _ = curve_fit(linear, D, R)
    return a, b

def to_metric_dsm(relative_depth: np.ndarray, a: float, b: float):
    return a * relative_depth + b
