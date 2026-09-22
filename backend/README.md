---
title: DepthWizard Backend
emoji: 🛰️
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# DepthWizard Backend API

Single-View Height Estimation & 3D Flythrough Pipeline (ISRO Problem Statement 26175).
Powered by FastAPI, PyTorch, Depth-Anything-V2, and GDAL/rasterio.

## Endpoints:
- `GET /health` or `GET /`: Health check and service status
- `POST /process`: Upload satellite image / GeoTIFF and generate calibrated DSM with elevation metrics
- `GET /download-dsm/{filename}`: Download generated GeoTIFF DSM
