import numpy as np

def compute_metrics(predicted_dsm: np.ndarray, reference_dsm: np.ndarray):
    mask = ~np.isnan(reference_dsm)
    pred = predicted_dsm[mask]
    ref = reference_dsm[mask]

    diff = pred - ref
    mae = np.mean(np.abs(diff))
    rmse = np.sqrt(np.mean(diff ** 2))
    corr = np.corrcoef(pred, ref)[0, 1]

    return {
        "mae": round(float(mae), 3),
        "rmse": round(float(rmse), 3),
        "correlation": round(float(corr), 3),
        "diff_map": diff,          # for the heatmap visualization
    }
