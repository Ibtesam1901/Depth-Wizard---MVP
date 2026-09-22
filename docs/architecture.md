# DepthWizard 2.0: System Architecture
**ISRO Problem Statement 26175: Single-View Height Estimation and 3D Flythrough**

## 1. High-Level Architecture Diagram

```
                    DEPTHWIZARD 2.0
                           │
                           ▼
                ┌─────────────────────┐
                │   UPLOAD IMAGERY    │
                │ JPG / PNG / GeoTIFF │
                └──────────┬──────────┘
                           │
                  ┌────────▼────────┐
                  │ Metadata Parser │
                  │ (Rasterio/GDAL) │
                  └────────┬────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
            RGB/JPG/PNG            GeoTIFF
                │                     │
                ▼                     ▼
         Relative Depth         Relative Depth
       (Depth Anything V2)    (Depth Anything V2)
                │                     │
                ▼                     ▼
              rDSM                DEM / GCP
       (Relative Units)               │
                │                     ▼
                │             Scale Calibration
                │            (Robust Huber/RANSAC)
                │                     │
                │                     ▼
                │                    DSM
                │              (Metric Elevation)
                │                     │
                └──────────┬──────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
         GeoTIFF Export      Terrain Mesh Generator
         (Preserved CRS)     (Three.js BufferGeometry)
                                      │
                                      ▼
                             RGB Texture Projection
                                      │
                                      ▼
                             Interactive 3D World
                           ┌─────┼─────┬────────┐
                           ▼     ▼     ▼        ▼
                         Height Slope Flythrough Measurement
                         Diff   Map  (PointerLock) Inspector
                           │
                           ▼
                     Validation Engine
                     (Resample & Reproject)
                           │
                     ┌─────┼─────┐
                     ▼     ▼     ▼
                    MAE   RMSE   R
                           │
                     ┌─────┴─────┐
                     ▼           ▼
                 Error Map   Scatter Plot
                           │
                           ▼
                    SIH Export Center
```

## 2. Layered Component Breakdown

### 2.1 Frontend Presentation Layer (React + Three.js + Vite)
- **4-Stage Workflow Dashboard:**
  - `01 INPUT`: File ingestion, metadata chips (CRS, resolution, bounds), and demo dataset selector.
  - `02 AI ESTIMATION`: Real-time pipeline tracker, multi-layer viewer tabs (`[RGB]`, `[DEPTH]`, `[DSM]`, `[SLOPE]`, `[CONFIDENCE]`, `[ERROR]`).
  - `03 TERRAIN STUDIO`: 3D WebGL terrain mesh, RGB texture orthorectification, vertical exaggeration ($1\times - 10\times$), camera navigation (Orbit, First-Person PointerLock, Top View, Side View), height measurement tool, and spatial point inspector.
  - `04 VALIDATION & BENCHMARKS`: Quantitative error cards (RMSE, MAE, Pearson $r$), residual error heatmap, interactive scatter plot, and SIH 4-category benchmark matrix.
- **Export Center:** Download GeoTIFF DSM, NumPy `.npy`, Slope Map, and Printable Processing Report.

### 2.2 Backend Intelligence & Geospatial Engine (FastAPI + PyTorch + Rasterio)
- **Depth Anything V2 Backbone:** Vision Transformer (ViT) monocular depth estimation producing raw un-normalized depth arrays (`raw_depth.npy`) and visual normalized heatmaps.
- **Geospatial Layer (`rasterio`):** Extracts CRS, affine transformation matrices, spatial bounding boxes, and ground sample distance (GSD).
- **Metric Calibration Module:** Affine model $Z = a \cdot D + b$ fitted via robust regression (Huber/RANSAC) to reject outliers (clouds, shadows, water) and Ground Control Points (GCPs).
- **Topographic Slope Engine:** Surface gradients $\partial z / \partial x$ and $\partial z / \partial y$ converted to topographic slope in degrees.
- **Validation Engine:** Grid alignment/resampling computing MAE, RMSE, Pearson $r$, residual difference maps, and scatter-plot point samples.
