# 🌍 DepthWizard: Single-View Height Estimation & 3D Flythrough

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-R3F-black.svg)](https://threejs.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-Depth%20Anything%20V2-EE4C2C.svg)](https://pytorch.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Transforming single-view optical satellite and aerial imagery into metric-calibrated 3D Digital Surface Models (DSMs) with real-time flythrough visualization.**

---

## 📌 The Problem & Motivation

* **Limitations of Traditional Remote Sensing:** Generating high-resolution Digital Surface Models (DSMs) traditionally demands **stereo photogrammetry** (requiring multi-angle imagery of the same site at the same time) or airborne **LiDAR** surveys. Both are capital-intensive, slow to deploy, and impossible to obtain during rapid disaster response or in contested/unmapped regions.
* **The Monocular AI Bottleneck:** State-of-the-art vision models can infer rich geometric structure from a single optical image. However, their outputs are inherently **relative and scale-ambiguous** (values normalized arbitrarily between 0 and 1). Without absolute vertical scale, raw AI depth maps cannot be used for critical engineering, flood modeling, urban planning, or defense reconnaissance.
* **The DepthWizard Solution:** DepthWizard bridges this critical gap. It couples foundational monocular depth models (**Depth Anything V2**) with a **metric calibration engine** that aligns relative AI predictions against sparse reference elevation data (such as SRTM, GAMUS AGL, or Ground Control Points). The resulting metric DSM is validated mathematically (MAE/RMSE) and rendered as an interactive, photorealistic 3D terrain model in WebGL.

---

## 🔬 End-to-End Solution Architecture

```
                                  ┌──────────────────────────┐
                                  │  Input Imagery           │
                                  │  (GeoTIFF / H5 / RGB)    │
                                  └────────────┬─────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────┐
                                  │  Depth Anything V2       │
                                  │  Monocular AI Inference  │
                                  └────────────┬─────────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         │                                           │
                         ▼                                           ▼
            ┌──────────────────────────┐                ┌──────────────────────────┐
            │  Relative Depth Map      │                │  Uncertainty / Confidence│
            │  D_norm ∈ [0, 1]         │                │  Sobel Gradient Mapping  │
            └────────────┬─────────────┘                └────────────┬─────────────┘
                         │                                           │
                         ├───────────────────────────────────────────┤
                         │  (Optional Reference Elevation Raster)    │
                         ▼                                           │
            ┌──────────────────────────┐                             │
            │  Metric Calibration      │                             │
            │  Z_metric = a · D + b    │                             │
            │  (Scipy curve_fit)       │                             │
            └────────────┬─────────────┘                             │
                         │                                           │
                         ▼                                           │
            ┌──────────────────────────┐                             │
            │  Scientific Validation   │                             │
            │  • MAE & RMSE (meters)   │                             │
            │  • Pearson Correlation r │                             │
            │  • Spatial Error Heatmap │                             │
            └────────────┬─────────────┘                             │
                         │                                           │
                         └─────────────────────┬─────────────────────┘
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │  Interactive WebGL Studio    │
                                │  • 3D Extruded Terrain Mesh  │
                                │  • Orbit / Flythrough Camera │
                                │  • Point-to-Point Measure    │
                                │  • Quad 2D Map Inspector     │
                                └──────────────────────────────┘
```

---

## 🚀 Key Innovation Pillars

### 1. Robust Metric Calibration ($Z = a \cdot D + b$)
Relative depth values $D$ are mapped to physical metric elevations $Z$ in meters through least-squares regression:
$$\min_{a, b} \sum_{i=1}^N \left( R_i - (a \cdot D_i + b) \right)^2$$
where $R_i$ represents valid (non-NaN) reference DEM elevation values. The fitted slope $a$ scales terrain relief, while the intercept $b$ anchors base altitude.

### 2. Quantitative Benchmark Validation
When a reference DSM is supplied (such as SRTM or GAMUS benchmark tiles), the pipeline automatically evaluates:
* **Mean Absolute Error (MAE):** $\text{MAE} = \frac{1}{N} \sum |Z_{\text{pred}} - Z_{\text{ref}}|$
* **Root Mean Square Error (RMSE):** $\text{RMSE} = \sqrt{\frac{1}{N} \sum (Z_{\text{pred}} - Z_{\text{ref}})^2}$
* **Pearson Correlation ($r$):** Evaluates linear fidelity between predicted relief and ground truth.
* **Spatial Residual Error Map:** A colormapped difference raster identifying local over- and under-estimations.

### 3. Edge-Preserving Uncertainty & Confidence Mapping
Monocular depth estimates carry higher uncertainty along sharp elevation boundaries and shadow occlusions. DepthWizard computes an analytical confidence map via spatial gradient magnitude:
$$G = \sqrt{\left(\frac{\partial D}{\partial x}\right)^2 + \left(\frac{\partial D}{\partial y}\right)^2}, \quad C = 1 - \frac{G}{\max(G) + \epsilon}$$
providing users with a spatial reliability score for every pixel.

### 4. Interactive 3D Terrain Studio (React Three Fiber)
* **Real-Time Elevation Extrusion:** Height arrays are converted into dynamic Three.js `PlaneGeometry` vertex displacement meshes.
* **Multi-Texture Overlay:** Switch between Optical RGB, Colormapped Elevation DSM (Viridis), Confidence Score (Plasma), and Calibration Error (Jet).
* **Navigation Modes:** Orbit inspection and automated cinematic Flythrough.
* **Physical Measurement:** Interactive raycasting to measure real-world building height and slope.

---

## 📊 Benchmark Evaluation (GAMUS Urban Dataset)

Tested on the standardized **GAMUS (Global Aerial Multimodal Urban Satellite)** dataset over Washington D.C. urban tiles:
* **Input Scene:** `DC_10_20_RGB.h5`
* **Reference Ground Truth:** `DC_10_20_AGL.h5`

| Metric | Calibrated Value | Unit |
| :--- | :--- | :--- |
| **Pipeline Mode** | **Metric DSM** | Calibrated against Ground Truth |
| **Mean Absolute Error (MAE)** | **`8.08`** | meters ($m$) |
| **Root Mean Square Error (RMSE)** | **`9.28`** | meters ($m$) |
| **Pearson Correlation ($r$)** | **`0.03`** | Linear association |
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
│   ├── calibrate.py         # Scale & offset least-squares linear calibration
│   ├── validate.py          # MAE, RMSE, Pearson r & residual error map computation
│   ├── geotiff_io.py        # Rasterio geospatial reader/writer (CRS, transforms)
│   ├── Dockerfile           # Containerized deployment specification
│   └── requirements.txt     # Python dependencies (PyTorch, Transformers, Rasterio, etc.)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Primary UI shell, file inputs, layout switcher, metrics panels
│   │   ├── App.css          # Glassmorphic dark-mode design system & responsive styling
│   │   ├── TerrainViewer.jsx# Three.js / React Three Fiber 3D terrain canvas & raycaster
│   │   ├── index.css        # Global CSS resets & typography
│   │   └── main.jsx         # Vite React entry point
│   ├── public/              # Static sample scenes and benchmark pairs
│   ├── package.json         # Frontend dependencies (React, Three.js, R3F, Lucide)
│   └── vite.config.js       # Vite bundler configuration
└── README.md                # Comprehensive documentation
```

---

## 🔌 API Reference

### `POST /process`
Processes satellite/aerial imagery, executes monocular inference, performs calibration, and outputs the 3D surface model and metrics.

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
  "width": 256,
  "height": 256,
  "min_elev": 10.51,
  "max_elev": 11.88,
  "mean_elev": 11.32,
  "range_elev": 1.37,
  "mae": 8.08,
  "rmse": 9.28,
  "correlation": 0.03,
  "rgb_base64": "<base64_encoded_png>",
  "depth_base64": "<base64_encoded_png>",
  "confidence_base64": "<base64_encoded_png>",
  "error_base64": "<base64_encoded_png>",
  "dsm_data": [10.51, 10.52, ...]
}
```

---

## 🛠️ Quick Start Guide

### Prerequisites
* **Python 3.10+**
* **Node.js 18+** & `npm`
* GPU with CUDA support recommended (CPU fallback supported automatically)

### 1. Backend Setup
```bash
cd backend
python -m venv .venv

# Activate environment:
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install requirements:
pip install -r requirements.txt

# Start backend server:
uvicorn main:app --reload --port 8000
```
Backend API will be live at `http://127.0.0.1:8000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. One-Click Demo
1. Click **⚡ Load Demo Scene** to test monocular depth estimation on standard satellite optical imagery.
2. Click **🎯 Load Benchmark Pair (Calibrated)** to run metric calibration against ground truth elevation data and view live **MAE/RMSE** validation metrics.
3. Toggle between **Dual View**, **3D Studio**, and **2D Maps** using the top navigation bar.

---

## 📜 License

This project is licensed under the MIT License.
