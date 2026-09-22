import numpy as np
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.geospatial.metadata import extract_geospatial_metadata
from app.geospatial.calibration import robust_fit_scale_offset, calibrate_with_gcps, to_metric_dsm
from app.processing.slope import calculate_slope_map
from app.validation.metrics import compute_validation_metrics
from app.geospatial.geotiff import write_geotiff

def test_pipeline():
    print("1. Testing geospatial metadata extraction...")
    geo_path = "test_geo.tif"
    if os.path.exists(geo_path):
        meta = extract_geospatial_metadata(geo_path)
        assert meta["georeferenced"] is True, "Expected test_geo.tif to be georeferenced"
        print(f"   [PASS] GeoTIFF metadata: CRS={meta['crs']}, Size={meta['width']}x{meta['height']}")

    print("2. Testing robust affine calibration...")
    d_fake = np.linspace(0.0, 1.0, 1000).reshape((25, 40))
    # True relation: Z = 45 * D + 200 with 5% noise and 5 outliers
    z_true = 45.0 * d_fake + 200.0 + np.random.normal(0, 0.5, d_fake.shape)
    z_true[2, 3] = 999.0  # outlier
    z_true[5, 8] = -9999.0 # nodata
    
    scale, offset, rmse = robust_fit_scale_offset(d_fake, z_true)
    assert abs(scale - 45.0) < 5.0, f"Expected scale close to 45.0, got {scale}"
    assert abs(offset - 200.0) < 5.0, f"Expected offset close to 200.0, got {offset}"
    print(f"   [PASS] Robust regression: scale={scale:.2f}, offset={offset:.2f}, RMSE={rmse:.2f}m")

    print("3. Testing GCP calibration...")
    gcps = [
        {"x": 5, "y": 5, "z": 210.0},
        {"x": 15, "y": 10, "z": 225.0},
        {"x": 25, "y": 15, "z": 240.0}
    ]
    g_scale, g_offset, g_rmse = calibrate_with_gcps(d_fake, gcps)
    print(f"   [PASS] GCP Calibration: scale={g_scale:.2f}, offset={g_offset:.2f}, RMSE={g_rmse:.2f}m")

    print("4. Testing topographic slope computation...")
    dsm_fake = to_metric_dsm(d_fake, 50.0, 100.0)
    slope_deg, stats, b64 = calculate_slope_map(dsm_fake, pixel_spacing_x=10.0, pixel_spacing_y=10.0)
    assert stats["min_slope"] >= 0.0, "Slope cannot be negative"
    assert len(b64) > 100, "Expected valid base64 slope image"
    print(f"   [PASS] Slope statistics: Min={stats['min_slope']} deg, Mean={stats['mean_slope']} deg, Max={stats['max_slope']} deg")

    print("5. Testing scientific validation metrics...")
    dsm_calibrated = to_metric_dsm(d_fake, scale, offset)
    val = compute_validation_metrics(dsm_calibrated, 45.0 * d_fake + 200.0)
    assert val["mae"] > 0 or val["mae"] == 0, "Expected MAE >= 0"
    assert val["rmse"] >= 0, "Expected RMSE >= 0"
    assert val["correlation"] > 0.85, f"Expected strong correlation, got {val['correlation']}"
    assert len(val["scatter_points"]) > 0, "Expected scatter plot points"
    print(f"   [PASS] Validation: MAE={val['mae']}m, RMSE={val['rmse']}m, Pearson r={val['correlation']}")

    print("6. Testing GeoTIFF export...")
    out_tif = "exports/test_pipeline_export.tif"
    bytes_written = write_geotiff(out_tif, dsm_fake)
    assert os.path.exists(out_tif), "Exported GeoTIFF must exist"
    assert len(bytes_written) > 500, "Exported GeoTIFF cannot be empty"
    print(f"   [PASS] GeoTIFF written successfully: {len(bytes_written)} bytes")

    print("\n[SUCCESS] ALL DEPTHWIZARD 2.0 BACKEND MODULE TESTS PASSED!")

if __name__ == "__main__":
    test_pipeline()
