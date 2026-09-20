# 🌍 DepthWizard

**Single-View Height Estimation & Interactive 3D Terrain Analysis**

DepthWizard is an advanced geospatial AI pipeline that transforms single 2D images (like satellite imagery or drone photos) into fully interactive, metric-calibrated 3D Digital Surface Models (DSMs). 

Built to bridge the gap between traditional remote sensing and modern monocular depth estimation, DepthWizard automatically calibrates AI depth maps using sparse reference data (like SRTM or GCPs) to provide true, measurable elevation analysis.

---

## ✨ Core Features

*   **📤 Intelligent Ingestion:** Supports standard images (JPG/PNG), geospatial imagery (GeoTIFFs with CRS), and scientific remote sensing datasets (GAMUS `.h5` files).
*   **🧠 AI Depth Engine:** Powered by the state-of-the-art **Depth Anything V2** monocular depth model for high-resolution relative depth extraction.
*   **📐 Metric Calibration:** Employs linear regression algorithms ($Z = aD + b$) against reference DSMs to scale relative AI depth into true physical elevation (meters).
*   **📊 Quantitative Validation:** Dynamically calculates Mean Absolute Error (MAE) and Root Mean Square Error (RMSE) against ground truth references for scientific validity.
*   **🌍 Interactive 3D Terrain Viewer:** Extrudes the generated DSM into a 3D mesh utilizing React Three Fiber, wrapping the original optical RGB image over the topography.
*   **🎮 Flythrough & First-Person Navigation:** Navigate your generated terrain using an automated cinematic flythrough, or explore it manually in First-Person (WASD) mode.
*   **📏 Real-Time Measurement Tools:** Click any two points on the 3D mesh to instantly calculate physical Building Height or Terrain Slope.
*   **🟣 Confidence & Uncertainty Mapping:** Automatically generates a heuristic uncertainty map (highlighting sharp edges and complex structures) to identify areas of low AI confidence.

---

## 🏗️ Technical Architecture

DepthWizard operates on a decoupled client-server architecture:

### 🐍 Backend (Python / FastAPI)
*   **Framework:** FastAPI for high-performance REST APIs.
*   **AI / Inference:** PyTorch, Transformers, Depth Anything V2.
*   **Geospatial:** Rasterio, PyProj (for CRS handling).
*   **Data Processing:** NumPy, SciPy, scikit-learn, h5py.

### ⚛️ Frontend (React.js)
*   **Framework:** React (Vite).
*   **Styling:** Tailwind CSS for a sleek, modern, dark-mode UI.
*   **3D Rendering:** Three.js, React Three Fiber, React Three Drei.

---

## 🚀 Quick Start Guide

### 1. Backend Setup

Open a terminal and navigate to the `backend` directory:
```bash
cd backend
```

Create a virtual environment (optional but recommended):
```bash
python -m venv .venv
# Activate on Windows:
.\.venv\Scripts\activate
# Activate on Mac/Linux:
source .venv/bin/activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Run the FastAPI server:
```bash
uvicorn main:app --reload
```
*The backend will now run on `http://127.0.0.1:8000`.*

### 2. Frontend Setup

Open a **new** terminal and navigate to the `frontend` directory:
```bash
cd frontend
```

Install Node packages:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```
*The UI will now run on `http://localhost:3000` (or `http://localhost:5173`).*

---

## 🎯 How to Use DepthWizard

1.  **Upload:** Drag and drop an image (JPG, PNG, TIF, or H5) into the left sidebar.
2.  **Reference (Optional):** Upload a corresponding reference DSM to enable true metric scaling and error validation.
3.  **Process:** Click "Process". The backend will run inference, calibrate the data, and return a DSM.
4.  **Analyze:** View the metadata, elevation statistics, and validation metrics in the sidebar.
5.  **Explore:** Interact with the 3D Terrain Viewer. Use the toolbar to measure structures, switch to the Confidence texture, or trigger an automated flythrough!

---
*Built as a Minimum Viable Product (MVP) demonstrating applied AI in the geospatial domain.*
