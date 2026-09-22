# DepthWizard 2.0: API Reference Manual

## Base URL
- **Local Dev:** `http://localhost:8000`
- **Cloud Backend:** `https://depth-wizard-mvp.onrender.com`

---

## 1. System Health
- **`GET /health`** or **`GET /`**
  - Returns backend status, pipeline architecture, and version info.

---

## 2. Ingestion & Metadata
- **`POST /api/upload`**
  - **Multipart Form:** `file` (`.jpg`, `.png`, `.tif`, `.tiff`, `.h5`)
  - **Returns:**
    - `file_id`: Unique session identifier
    - `metadata`: Format, CRS, EPSG, resolution, bounds, georeferenced flag
    - `preview_base64`: Compact preview thumbnail

---

## 3. End-to-End Pipeline
- **`POST /process`**
  - **Parameters:**
    - `file`: Imagery file (Required)
    - `reference_file`: Reference DEM/DSM GeoTIFF (Optional)
    - `mode`: `'auto'` or `'relative'`
    - `calibration`: `'srtm'`, `'gcp'`, or `'none'`
  - **Returns:**
    - `rgb_base64`: Orthorectified visual RGB
    - `depth_base64`: Relative depth map (Viridis)
    - `confidence_base64`: Edge dispersion indicator (Plasma)
    - `slope_base64`: Topographic slope angle map (Turbo)
    - `error_base64`: Spatial residual heatmap (Jet)
    - `dsm_data`: 1D array of elevation values
    - `elevation_stats`: Min, Max, Mean, Median, Range
    - `slope_stats`: Min, Max, Mean, Median slope (degrees)
    - `scatter_points`: Sampled points for validation scatter plot
    - `export_filename`: Saved GeoTIFF DSM filename

---

## 4. Terrain & Slope Analysis
- **`POST /api/terrain/slope`**
  - Computes topographic slope in degrees from `dsm_data`, `width`, and `height`.
- **`POST /api/terrain/inspect`**
  - Accepts `x`, `y`, `width`, `height`, `dsm_data`, `transform`, `crs`.
  - Returns: Local elevation ($Z$), slope angle (°), and geographic coordinates (Latitude / Longitude).

---

## 5. Quantitative Validation & Benchmarks
- **`POST /api/validation/evaluate`**
  - Accepts `reference_file`, `dsm_data_str`, `width`, `height`.
  - Returns: MAE, RMSE, Pearson $r$, residual error heatmap, and scatter plot coordinates.
- **`GET /api/validation/benchmarks`**
  - Returns precomputed evaluation benchmarks across Urban, Sparse, Hilly, and Forested categories.

---

## 6. Export Center
- **`POST /api/export/geotiff`**
  - Generates georeferenced GeoTIFF DSM preserving CRS and affine transform.
- **`POST /api/export/numpy`**
  - Returns downloadable `.npy` binary raw elevation array.
- **`POST /api/export/report`**
  - Generates comprehensive technical printable processing summary.
- **`GET /download-dsm/{filename}`**
  - Direct file stream download for generated GeoTIFF DSMs.
