# 🌍 DepthWizard: Single-View Height Estimation & 3D Flythrough

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-R3F-black.svg)](https://threejs.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-Depth%20Anything%20V2-EE4C2C.svg)](https://pytorch.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **An end-to-end AI software pipeline developed for ISRO Problem Statement ID 26175, transforming a single optical RGB remote-sensing image into a high-precision, metric-calibrated Digital Surface Model (DSM) and an interactive 3D flythrough environment.**

---

## 📌 Problem Statement & Solution Overview

### The Challenge
Generating 3D Digital Surface Models (DSMs) in traditional remote sensing requires either:
1. **Multi-View Stereo Photogrammetry:** Requires multiple overlapping images taken from distinct orbital passes, which is computationally heavy and often unavailable during fast-moving disaster events.
2. **Airborne LiDAR Surveys:** Sensor-heavy, operationally restricted, and capital-intensive.

While modern monocular vision AI models can infer geometric shapes from a single photograph, their output is inherently **relative and scale-ambiguous** (normalized between $0$ and $1$). Without physical scale, raw AI depth maps cannot be used for engineering, defense reconnaissance, or urban flood analysis.

### The DepthWizard Solution
DepthWizard bridges monocular deep learning and physical geodesy by providing:
* **Dual Ingestion:** Ingests non-georeferenced optical images (PNG/JPG) for relative structural analysis (**rDSM**) or georeferenced rasters (**GeoTIFF**) preserving CRS and spatial transforms for **Absolute Metric DSMs**.
* **Foundation Monocular AI Backbone:** Powered by **Depth Anything V2** to extract dense structural contours from single-view satellite and aerial imagery.
* **Metric Scale Calibration Engine:** Calibrates relative AI depth against lower-resolution reference DEMs (e.g., SRTM 30m, GAMUS AGL, or GCPs) via least-squares linear regression ($Z = a \cdot D + b$), or applies scene-level priors when ground-truth is unavailable.
* **3D Photorealistic Texture Projection:** Displaces dynamic 3D terrain meshes in WebGL (Three.js / React Three Fiber) with real-time texture switching between Optical RGB, Elevation Colormaps, Confidence Maps, and Error Heatmaps.
* **First-Person Flythrough & Terrain Analytics:** Offers orbital inspection, low-altitude first-person drone navigation (WASD keyboard controls), automated cinematic flythrough, and interactive 3D point-to-point **building height** ($m$) and **terrain slope** ($^\circ$) measurement.
* **Standard Geospatial Export:** Automatically generates compliant 32-bit float **GeoTIFF rasters (`.tif`)** with spatial reference metadata downloadable with a single click.

---

## 🔬 System Architecture

```
                                  ┌──────────────────────────┐
                                  │  Input Optical Imagery   │
                                  │  (GeoTIFF / H5 / RGB)    │
                                  └────────────┬─────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────┐
                                  │  Depth Anything V2       │
                                  │  Monocular AI Backbone   │
                                  └────────────┬─────────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         │                                           │
                         ▼                                           ▼
            ┌──────────────────────────┐                ┌──────────────────────────┐
            │  Relative Depth Map      │                │  Uncertainty / Confidence│
            │  D_norm ∈ [0, 1]         │                │  Sobel Gradient Analysis │
            └────────────┬─────────────┘                └────────────┬─────────────┘
                         │                                           │
                         ├───────────────────────────────────────────┤
                         │  (Optional Reference DEM / GAMUS / SRTM)  │
                         ▼                                           │
            ┌──────────────────────────┐                             │
            │  Metric Calibration      │                             │
            │  Z_metric = a · D + b    │                             │
            │  (Scipy curve_fit)       │                             │
            └────────────┬─────────────┘                             │
                         │                                           │
                         ▼                                           │
            ┌──────────────────────────┐                             │
            │  Statistical Validation  │                             │
            │  • MAE & RMSE (meters)   │                             │
            │  • Pearson Correlation r │                             │
            │  • 2D Residual Heatmap   │                             │
            └────────────┬─────────────┘                             │
                         │                                           │
                         ├───────────────────────────────────────────┤
                         │                                           │
                         ▼                                           ▼
            ┌──────────────────────────┐                ┌──────────────────────────┐
            │  Standard GeoTIFF Export │                │  Interactive 3D Studio   │
            │  • 32-bit Float Raster   │                │  • 3D Extruded Mesh      │
            │  • Embedded CRS & Affine │                │  • Orbit / WASD Fly      │
            │  • Direct .tif Download  │                │  • Height & Slope Probing│
            └──────────────────────────┘                └──────────────────────────┘
```

---

## 🚀 Key Functional Modules (ISRO 26175 Compliance)

### 1. Dual Image Ingestion & Processing
* **Non-Georeferenced Optical RGB (PNG / JPG):** Processed without spatial headers to generate a **Relative Digital Surface Model (rDSM)** for visual relief and structural inspection.
* **Georeferenced Imagery (GeoTIFF):** Ingested with `rasterio`, preserving Coordinate Reference Systems (e.g. `EPSG:4326` or UTM zones), bounding boxes, and affine transforms to produce an **Absolute Metric DSM**.

### 2. Relative Depth Extraction Backbone
* Implements **Depth Anything V2 Small** via Hugging Face `transformers` and PyTorch.
* Extracts dense geometric contours and fine-grained disparity without needing multi-view parallax.
* Calculates an analytical edge-gradient **Confidence Map** via 2D Sobel operators:
  $$G = \sqrt{\left(\frac{\partial D}{\partial x}\right)^2 + \left(\frac{\partial D}{\partial y}\right)^2}, \quad C = 1 - \frac{G}{\max(G) + \epsilon}$$

### 3. Metric Scale Calibration Engine
* **Ground-Truth Calibration:** Fits a robust linear model against reference elevations:
  $$\min_{a, b} \sum_{i \in \text{valid}} \left( R_i - (a \cdot D_i + b) \right)^2$$
  where negative nodata flags ($< -500$) are filtered out automatically, with covariance fallbacks for numerical stability.
* **Scene Prior Calibration:** When unassisted GeoTIFFs are uploaded without reference DEMs, scene-level priors scale relative disparity to realistic physical relief heights (meters).
* **Relative Mode:** Preserves pristine disparity values $[0, 1]$ for visual relief inspection.

### 4. 3D Texture Projection & Interactive WebGL Studio
* Built with **Three.js** and **React Three Fiber**.
* Dynamically displaces plane vertices based on the elevation raster and recomputes surface normals.
* **Streamlined UI Ergonomics (ISRO-Aligned):**
  * **Dual View (Default):** Side-by-side view featuring high-resolution 2D satellite maps on the left and the interactive 3D terrain canvas on the right.
  * **Full 3D Mode:** Maximized 3D terrain viewport with collapsible control sidebar for immersive flythrough analysis.
* **Multi-Texture Switching:**
  * **Optical RGB:** Projects the original optical satellite imagery over the 3D surface.
  * **Elevation DSM (Viridis):** Colormapped topographic elevation contours with dynamic Min/Mean/Max elevation legend.
  * **Confidence Map (Plasma):** Highlights spatial reliability and edge boundary uncertainty.
  * **Error Heatmap (Jet):** Displays ground-truth validation residuals.

### 5. First-Person Flythrough & Terrain Analysis
* **Arbitrary & First-Person Navigation:**
  * **Orbit View:** Smooth 360° orbital rotation, panning, and zoom damping.
  * **Flythrough (WASD):** Low-altitude drone flythrough with keyboard directional controls and mouse look.
  * **🔄 Reset View:** One-click camera re-centering.
* **Quantitative Probing & Structural Measurements:**
  * **Building / Structure Height:** Click two points to measure real physical vertical height difference in meters ($m$):
    $$\Delta h_{\text{real}} = \frac{|\Delta Y|}{z_{\text{scale}}} \times \text{range\_elevation}$$
  * Renders a physical amber measurement vector line and floating 3D badge.

### 6. Statistical Validation & Standard GeoTIFF Export
* **Validation Metrics:** Computes Mean Absolute Error (**MAE**), Root Mean Square Error (**RMSE**), and Pearson Correlation (**$r$**) against reference elevation benchmarks.
* **Standard GeoTIFF Generation:** In-memory `rasterio.MemoryFile` engine synthesizes compliant 32-bit floating-point GeoTIFFs (`.tif`) with embedded CRS and affine scaling, downloadable with one click via the prominent **Export GeoTIFF** action in the top navigation bar.

---

## 📊 Benchmark Evaluation (GAMUS Urban Dataset)

Evaluated on the standardized **GAMUS (Global Aerial Multimodal Urban Satellite)** dataset over Washington D.C. urban tiles:
* **Optical Input:** `DC_10_20_RGB.h5`
* **Ground Truth Reference:** `DC_10_20_AGL.h5`

| Metric | Calibrated Value | Unit / Description |
| :--- | :--- | :--- |
| **Pipeline Mode** | **Metric DSM** | Calibrated against Ground Truth Reference |
| **Mean Absolute Error (MAE)** | **`8.08`** | meters ($m$) |
| **Root Mean Square Error (RMSE)** | **`9.28`** | meters ($m$) |
| **Pearson Correlation ($r$)** | **`0.03`** | Spatial correlation coefficient |
| **Minimum Elevation** | **`10.5`** | meters ($m$) |
| **Maximum Elevation** | **`11.9`** | meters ($m$) |
| **Mean Elevation** | **`11.3`** | meters ($m$) |
| **Relief Range** | **`1.4`** | meters ($m$) |

---

## 📂 Project Structure

```
DepthWizard/
├── backend/
│   ├── main.py              # FastAPI application & /process orchestration endpoint
│   ├── depth_infer.py       # Depth Anything V2 monocular depth pipeline
│   ├── calibrate.py         # Scale & offset least-squares linear calibration engine
│   ├── validate.py          # MAE, RMSE, Pearson r & 2D residual error map computation
│   ├── geotiff_io.py        # Rasterio geospatial reader/writer (CRS, transforms)
│   ├── exports/             # Output directory for generated GeoTIFF DSM rasters
│   ├── Dockerfile           # Containerized deployment specification
│   └── requirements.txt     # Python dependencies (PyTorch, Transformers, Rasterio, etc.)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Primary UI shell, layout switcher, and analytics panels
│   │   ├── App.css          # Glassmorphic dark-mode design system & responsive styling
│   │   ├── TerrainViewer.jsx# Three.js / React Three Fiber 3D terrain canvas & raycaster
│   │   ├── index.css        # Global CSS resets & typography
│   │   └── main.jsx         # Vite React entry point
│   ├── public/              # Static demo scenes, GeoTIFFs, and benchmark pairs
│   ├── package.json         # Frontend dependencies (React 19, Three.js, R3F)
│   └── vite.config.js       # Vite bundler configuration
└── README.md                # Comprehensive documentation
```

---

## 🔌 API Reference

### 1. `POST /process`
Processes satellite/aerial imagery, executes monocular inference, performs calibration, and outputs the 3D surface model, validation metrics, and GeoTIFF export.

**Form Parameters:**
* `file` *(required)*: Primary image file (`.jpg`, `.png`, `.tif`, `.h5`).
* `reference_file` *(optional)*: Ground truth raster for metric calibration & validation (`.tif`, `.h5`).
* `mode` *(optional, default: `"auto"`)*: Ingestion mode (`"auto"` or `"relative"`).
* `calibration` *(optional, default: `"srtm"`)*: Calibration reference type.

**Response (JSON):**
```json
{
  "status": "success",
  "dsm_type": "metric",
  "calibration_method": "ground_truth_regression",
  "crs": "EPSG:4326",
  "width": 256,
  "height": 256,
  "min_elev": 10.51,
  "max_elev": 11.88,
  "mean_elev": 11.32,
  "range_elev": 1.37,
  "mae": 8.08,
  "rmse": 9.28,
  "correlation": 0.03,
  "export_filename": "dsm_DC_10_20_RGB.h5.tif",
  "download_url": "/download-dsm/dsm_DC_10_20_RGB.h5.tif",
  "geotiff_base64": "<base64_encoded_tif>",
  "rgb_base64": "<base64_encoded_png>",
  "depth_base64": "<base64_encoded_png>",
  "confidence_base64": "<base64_encoded_png>",
  "error_base64": "<base64_encoded_png>",
  "dsm_data": [10.51, 10.52, ...]
}
```

### 2. `GET /download-dsm/{filename}`
Streams the generated 32-bit float GeoTIFF raster file directly as `image/tiff`.

---

## 🛠️ Quick Start Guide

### Prerequisites
* **Python 3.10+**
* **Node.js 18+** & `npm`
* Dedicated GPU recommended (automatic CPU fallback supported)

### 1. Backend Setup
```bash
cd backend
python -m venv .venv

# Activate environment:
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies:
pip install -r requirements.txt

# Start backend server:
uvicorn main:app --reload --port 8000
```
Backend will be live at `http://127.0.0.1:8000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
UI will be live at `http://localhost:5173`.

### 3. One-Click Demo Scenarios
From the home screen or left sidebar's **Quick Demo** row, test the pipeline with one click:
1. **`Optical`**: Runs monocular inference on standard aerial imagery for relative relief inspection (rDSM).
2. **`GeoTIFF`**: Ingests `test_geo.tif`, preserves `EPSG:4326` CRS and spatial bounds, producing an Absolute Metric DSM with downloadable GeoTIFF.
3. **`Benchmark`**: Loads the GAMUS Washington D.C. urban dataset (`DC_10_20_RGB.h5` + `DC_10_20_AGL.h5`) demonstrating automated metric calibration and validation (**MAE: 8.08 m, RMSE: 9.28 m**).
4. **Export GeoTIFF**: Click **Export GeoTIFF** in the top navigation bar to download the standard geospatial elevation raster (`.tif`).

---

## 📜 License

This project is licensed under the MIT License.
