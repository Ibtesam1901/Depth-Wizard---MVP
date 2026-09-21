import numpy as np

def compute_metrics(predicted_dsm: np.ndarray, reference_dsm: np.ndarray):
    """
    Computes scientific validation metrics between predicted DSM and reference DSM:
    - MAE (Mean Absolute Error)
    - RMSE (Root Mean Square Error)
    - Pearson Correlation coefficient (r)
    - 2D Spatial Residual Difference Map (meters)
    """
    # Filter out NaNs, Infs, and standard GIS nodata values (e.g. -9999, -32767)
    mask = (~np.isnan(reference_dsm)) & (~np.isinf(reference_dsm)) & (reference_dsm > -500.0)
    
    if not np.any(mask):
        return {
            "mae": 0.0,
            "rmse": 0.0,
            "correlation": 0.0,
            "diff_map": np.zeros_like(predicted_dsm, dtype=np.float32),
        }

    pred = predicted_dsm[mask]
    ref = reference_dsm[mask]

    diff = pred - ref
    mae = float(np.mean(np.abs(diff)))
    rmse = float(np.sqrt(np.mean(diff ** 2)))

    corr = 0.0
    if len(pred) > 1 and float(np.std(pred)) > 1e-7 and float(np.std(ref)) > 1e-7:
        c = np.corrcoef(pred, ref)[0, 1]
        if not np.isnan(c) and not np.isinf(c):
            corr = float(c)

    # Reconstruct exact 2D spatial residual error map for visualization
    diff_map_2d = np.zeros_like(predicted_dsm, dtype=np.float32)
    diff_map_2d[mask] = diff

    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "correlation": round(corr, 3),
        "diff_map": diff_map_2d,
    }
