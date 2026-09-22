import numpy as np
import cv2
from PIL import Image
import io
import base64
from typing import Dict, Any, List, Tuple

def compute_validation_metrics(
    predicted_dsm: np.ndarray,
    reference_dsm: np.ndarray
) -> Dict[str, Any]:
    """
    Scientific validation between predicted DSM and reference ground-truth raster:
    - Resamples reference if grid dimensions differ.
    - Computes MAE, RMSE, Pearson correlation r.
    - Computes 2D spatial residual error map.
    - Extracts sampled (ref, pred) scatter-plot points for the UI.
    """
    # Align shapes if different
    if reference_dsm.shape != predicted_dsm.shape:
        reference_aligned = cv2.resize(
            reference_dsm.astype(np.float32),
            (predicted_dsm.shape[1], predicted_dsm.shape[0]),
            interpolation=cv2.INTER_LINEAR
        )
    else:
        reference_aligned = reference_dsm.astype(np.float32)

    # Valid pixel mask: filter NaNs, Infs, and NoData (< -500)
    mask = (
        (~np.isnan(reference_aligned)) &
        (~np.isinf(reference_aligned)) &
        (reference_aligned > -500.0) &
        (~np.isnan(predicted_dsm)) &
        (~np.isinf(predicted_dsm))
    )

    if not np.any(mask) or np.sum(mask) < 4:
        return {
            "mae": 0.0,
            "rmse": 0.0,
            "correlation": 0.0,
            "error_b64": None,
            "scatter_points": [],
            "residual_map": np.zeros_like(predicted_dsm, dtype=np.float32)
        }

    pred = predicted_dsm[mask]
    ref = reference_aligned[mask]

    diff = pred - ref
    mae = float(np.mean(np.abs(diff)))
    rmse = float(np.sqrt(np.mean(diff ** 2)))

    corr = 0.0
    if len(pred) > 1 and float(np.std(pred)) > 1e-7 and float(np.std(ref)) > 1e-7:
        c = np.corrcoef(pred, ref)[0, 1]
        if not np.isnan(c) and not np.isinf(c):
            corr = float(c)

    # 2D Residual difference map
    residual_map = np.zeros_like(predicted_dsm, dtype=np.float32)
    residual_map[mask] = diff

    # Colorize residual error map (using absolute error in JET or PLASMA)
    abs_diff = np.abs(diff)
    max_err = float(np.percentile(abs_diff, 98)) if len(abs_diff) > 0 else 1.0
    max_err = max(max_err, 1.0)
    
    err_2d_norm = np.zeros_like(predicted_dsm, dtype=np.uint8)
    err_2d_norm[mask] = np.clip(abs_diff / max_err * 255.0, 0, 255).astype(np.uint8)

    color_err = cv2.applyColorMap(err_2d_norm, cv2.COLORMAP_JET)
    color_err = cv2.cvtColor(color_err, cv2.COLOR_BGR2RGB)
    
    # Mask out invalid pixels as dark background
    color_err[~mask] = [15, 23, 42]

    img = Image.fromarray(color_err)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    error_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    # Sample up to 600 points for the UI scatter plot
    n_pts = len(pred)
    sample_size = min(n_pts, 600)
    indices = np.random.choice(n_pts, sample_size, replace=False) if n_pts > sample_size else np.arange(n_pts)

    scatter_points = [
        {"ref": round(float(ref[i]), 2), "pred": round(float(pred[i]), 2)}
        for i in indices
    ]

    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "correlation": round(corr, 3),
        "error_b64": error_b64,
        "scatter_points": scatter_points,
        "residual_map": residual_map
    }
