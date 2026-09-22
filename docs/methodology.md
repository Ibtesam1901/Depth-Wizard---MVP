# DepthWizard 2.0: Methodology & Scientific Formulation
**Single-View Height Estimation & Geospatial Calibration**

## 1. Monocular Relative Depth Estimation
Standard optical satellite imagery from single-view sensors (e.g. Cartosat, Sentinel, Landsat) lacks direct stereoscopic parallax. DepthWizard 2.0 utilizes **Depth Anything V2**, a Vision Transformer (ViT) pre-trained on diverse scenes with high-capacity monocular depth priors.
- **Model Output:** $D_{\text{relative}} \in [0, 1]$, representing continuous structural disparity.
- **Uncertainty / Confidence Indicator:** Sobel spatial gradient analysis detects abrupt depth discontinuities (edges, shadows) to yield a dispersion index:
  $$C(x, y) = 1.0 - \min\left(1.0, \frac{\|\nabla D(x, y)\|_2}{\max \|\nabla D\|_2}\right)$$

## 2. Geospatial Elevation Calibration
To convert uncalibrated relative depth into metric height values (meters), DepthWizard operates in two modes:

### Mode A: Relative DSM (`rDSM`)
- Applicable to standard unreferenced images (`.jpg`, `.png`).
- Depth values are strictly normalized and labeled in **"Relative Height Units"** (never erroneously labeled as meters).

### Mode B: Calibrated Metric DSM (`DSM`)
- Applicable when sparse reference elevation constraints are available:
  1. **Low-Resolution DEM (SRTM / ASTER / Copernicus):** Coarse absolute elevation reference (e.g., 30m USGS SRTM).
  2. **Ground Control Points (GCPs):** Sparse surveyed coordinates $[(x_i, y_i) \to Z_i]$.
- **Calibration Equation:**
  $$Z_{\text{metric}} = a \cdot D_{\text{relative}} + b$$
  where $a$ represents the topographic vertical scale factor and $b$ represents the datum base elevation offset.
- **Robust Huber / RANSAC Regression:**
  To prevent clouds, shadows, and water bodies from distorting linear regression, DepthWizard optimizes:
  $$\min_{a, b} \sum_{i} \rho\left(Z_i - (a \cdot D_i + b)\right)$$
  where $\rho$ is the Huber loss function:
  $$\rho(r) = \begin{cases} \frac{1}{2}r^2 & |r| \le \delta \\ \delta(|r| - \frac{1}{2}\delta) & |r| > \delta \end{cases}$$

## 3. Topographic Slope Map Formulation
From the calibrated DSM, spatial surface gradients are derived along orthogonal axes using central finite differences scaled by ground sample distance ($\Delta x, \Delta y$ in meters):
$$\frac{\partial z}{\partial x} = \frac{z(x+1, y) - z(x-1, y)}{2 \Delta x}, \quad \frac{\partial z}{\partial y} = \frac{z(x, y+1) - z(x, y-1)}{2 \Delta y}$$
$$\text{Slope (degrees)} = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180^\circ}{\pi}$$

## 4. Quantitative Validation Metrics
Evaluated across resampled and aligned reference grids:
1. **Mean Absolute Error (MAE):**
   $$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |Z_{\text{pred}, i} - Z_{\text{ref}, i}|$$
2. **Root Mean Square Error (RMSE):**
   $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (Z_{\text{pred}, i} - Z_{\text{ref}, i})^2}$$
3. **Pearson Correlation Coefficient ($r$):**
   $$r = \frac{\sum (Z_{\text{pred}} - \bar{Z}_{\text{pred}})(Z_{\text{ref}} - \bar{Z}_{\text{ref}})}{\sqrt{\sum (Z_{\text{pred}} - \bar{Z}_{\text{pred}})^2 \sum (Z_{\text{ref}} - \bar{Z}_{\text{ref}})^2}}$$
