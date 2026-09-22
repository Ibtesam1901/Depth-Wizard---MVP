import numpy as np
from typing import Tuple, List, Dict, Any, Optional
from sklearn.linear_model import HuberRegressor, RANSACRegressor, LinearRegression

def robust_fit_scale_offset(
    relative_depth: np.ndarray,
    reference_dem: np.ndarray,
    method: str = "huber"
) -> Tuple[float, float, float]:
    """
    Fits an affine calibration equation: Z_metric = a * D_relative + b
    Uses robust regression to reject outliers (shadows, clouds, water, model noise).
    
    Returns:
        scale (a): Slope of elevation mapping
        offset (b): Base elevation offset
        rmse: Calibration root-mean-square error on inliers
    """
    # Filter valid pixels
    mask = (
        (~np.isnan(reference_dem)) & 
        (~np.isinf(reference_dem)) & 
        (reference_dem > -500.0) & 
        (~np.isnan(relative_depth)) & 
        (~np.isinf(relative_depth))
    )
    
    if np.sum(mask) < 10:
        # Fallback if insufficient reference pixels
        return 100.0, float(np.nanmedian(reference_dem)) if np.any(mask) else 0.0, 0.0

    d_vals = relative_depth[mask].reshape(-1, 1)
    z_vals = reference_dem[mask]

    # Check for flat depth map
    if float(np.std(d_vals)) < 1e-6:
        return 1.0, float(np.median(z_vals)), 0.0

    try:
        if method == "huber":
            reg = HuberRegressor(max_iter=300)
            reg.fit(d_vals, z_vals)
            a = float(reg.coef_[0])
            b = float(reg.intercept_)
        elif method == "ransac":
            reg = RANSACRegressor(random_state=42)
            reg.fit(d_vals, z_vals)
            a = float(reg.estimator_.coef_[0])
            b = float(reg.estimator_.intercept_)
        else:
            reg = LinearRegression()
            reg.fit(d_vals, z_vals)
            a = float(reg.coef_[0])
            b = float(reg.intercept_)
            
        preds = a * d_vals.ravel() + b
        rmse = float(np.sqrt(np.mean((preds - z_vals) ** 2)))
        return a, b, round(rmse, 2)
    except Exception:
        # Fallback to standard least squares
        A = np.vstack([d_vals.ravel(), np.ones_like(d_vals.ravel())]).T
        res = np.linalg.lstsq(A, z_vals, rcond=None)[0]
        a, b = float(res[0]), float(res[1])
        preds = a * d_vals.ravel() + b
        rmse = float(np.sqrt(np.mean((preds - z_vals) ** 2)))
        return a, b, round(rmse, 2)

def calibrate_with_gcps(
    relative_depth: np.ndarray,
    gcps: List[Dict[str, float]]
) -> Tuple[float, float, float]:
    """
    Fits scale and offset from a set of Ground Control Points.
    Each GCP is a dict: {'x': int, 'y': int, 'z': float}
    
    Returns:
        scale (a), offset (b), calibration_rmse
    """
    if len(gcps) < 2:
        raise ValueError("At least 2 Ground Control Points (GCPs) are required for affine calibration.")

    h, w = relative_depth.shape
    d_points = []
    z_points = []

    for gcp in gcps:
        x = int(np.clip(round(gcp["x"]), 0, w - 1))
        y = int(np.clip(round(gcp["y"]), 0, h - 1))
        d_val = float(relative_depth[y, x])
        z_val = float(gcp["z"])
        d_points.append(d_val)
        z_points.append(z_val)

    D = np.array(d_points)
    Z = np.array(z_points)

    A = np.vstack([D, np.ones_like(D)]).T
    res, residuals, _, _ = np.linalg.lstsq(A, Z, rcond=None)
    a, b = float(res[0]), float(res[1])

    fitted_z = a * D + b
    rmse = float(np.sqrt(np.mean((fitted_z - Z) ** 2)))

    return a, b, round(rmse, 2)

def to_metric_dsm(relative_depth: np.ndarray, a: float, b: float) -> np.ndarray:
    """
    Applies affine calibration: Z_metric = a * D_relative + b
    """
    return (a * relative_depth + b).astype(np.float32)
