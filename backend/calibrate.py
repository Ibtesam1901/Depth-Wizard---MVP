import numpy as np
from scipy.optimize import curve_fit

def fit_scale_offset(relative_depth: np.ndarray, reference_dem: np.ndarray):
    """
    relative_depth: normalized model output [0, 1], same shape as reference_dem
    reference_dem: resampled reference DEM/DSM values (meters), same grid
    Returns scale (a) and offset (b) such that: metric_elevation ≈ a * relative_depth + b
    """
    # Filter out NaNs, Infs, and negative nodata values (< -500)
    mask = (~np.isnan(reference_dem)) & (~np.isinf(reference_dem)) & (reference_dem > -500.0)
    
    if not np.any(mask) or np.sum(mask) < 4:
        # Fallback if no valid reference data points
        return 100.0, 0.0

    D = relative_depth[mask].ravel()
    R = reference_dem[mask].ravel()

    # Guard against flat / zero-variance depth maps
    if float(np.std(D)) < 1e-6:
        return 1.0, float(np.median(R))

    def linear(x, a, b):
        return a * x + b

    try:
        # Initial guesses: a = range(R), b = min(R)
        r_range = float(np.percentile(R, 98) - np.percentile(R, 2))
        r_min = float(np.percentile(R, 2))
        p0 = [max(r_range, 1.0), r_min]
        
        (a, b), _ = curve_fit(linear, D, R, p0=p0, maxfev=2000)
        return float(a), float(b)
    except Exception:
        # Fallback linear approximation via covariance/variance
        cov = np.cov(D, R)
        var_d = np.var(D)
        if var_d > 1e-7:
            a = cov[0, 1] / var_d
            b = np.mean(R) - a * np.mean(D)
            return float(a), float(b)
        return 100.0, float(np.mean(R))

def to_metric_dsm(relative_depth: np.ndarray, a: float, b: float):
    return a * relative_depth + b
