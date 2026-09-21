import React, { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import TerrainViewer from './TerrainViewer'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [referenceFile, setReferenceFile] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [mode, setMode] = useState('auto')
  const [calibration, setCalibration] = useState('srtm')
  const [viewerMode, setViewerMode] = useState('orbit')
  const [textureMode, setTextureMode] = useState('rgb')
  const [layoutMode, setLayoutMode] = useState('split') // 'split' | '3d' | '2d'
  const [lightbox, setLightbox] = useState(null) // { title, src }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setProcessing(true)
    const formData = new FormData()
    formData.append('file', file)
    if (referenceFile) {
      formData.append('reference_file', referenceFile)
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${API_URL}/process?mode=${mode}&calibration=${calibration}`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Upload failed:', error)
      alert(`Processing failed: ${error.message}. Please make sure the backend is running.`)
    } finally {
      setProcessing(false)
    }
  }

  const openLightbox = (title, base64) => {
    if (!base64) return
    setLightbox({ title, src: `data:image/png;base64,${base64}` })
  }

  const loadSample = async () => {
    try {
      const res = await fetch('/sample.jpg')
      const blob = await res.blob()
      const sampleFile = new File([blob], 'satellite_sample.jpg', { type: 'image/jpeg' })
      setFile(sampleFile)
    } catch (err) {
      console.error('Failed to load sample:', err)
    }
  }

  const loadBenchmarkSample = async () => {
    try {
      const resRgb = await fetch('/demo_rgb.h5')
      const blobRgb = await resRgb.blob()
      const sampleRgb = new File([blobRgb], 'DC_10_20_RGB.h5', { type: 'application/x-hdf' })
      setFile(sampleRgb)

      const resRef = await fetch('/demo_ref.h5')
      const blobRef = await resRef.blob()
      const sampleRef = new File([blobRef], 'DC_10_20_AGL.h5', { type: 'application/x-hdf' })
      setReferenceFile(sampleRef)
    } catch (err) {
      console.error('Failed to load benchmark sample:', err)
    }
  }

  return (
    <div className="app-shell">
      {/* Top Navigation Bar */}
      <header className="top-navbar">
        <div className="nav-brand">
          <div className="brand-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div className="brand-title">
            <h1>DepthWizard</h1>
            <span className="brand-badge">SIH 2026 • AI Satellite DSM</span>
          </div>
        </div>

        {result && (
          <div className="nav-chips">
            <span className="chip"><span className="dot online"></span> {result.width} × {result.height} px</span>
            <span className="chip">{result.is_geotiff ? '🌐 GeoTIFF' : result.is_h5 ? '📦 HDF5' : '📷 RGB Image'}</span>
            <span className="chip highlight">Elev: {result.min_elev?.toFixed(0)}m – {result.max_elev?.toFixed(0)}m</span>
          </div>
        )}

        {result && (
          <div className="layout-switcher">
            <button 
              className={`switcher-btn ${layoutMode === 'split' ? 'active' : ''}`}
              onClick={() => setLayoutMode('split')}
              title="Dual View: 2D Maps and 3D Terrain side-by-side"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="8" height="18" rx="2" />
                <rect x="13" y="3" width="8" height="18" rx="2" />
              </svg>
              Dual View
            </button>
            <button 
              className={`switcher-btn ${layoutMode === '3d' ? 'active' : ''}`}
              onClick={() => setLayoutMode('3d')}
              title="3D Studio: Maximized 3D terrain canvas"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M3.6 9h16.8" />
                <path d="M3.6 15h16.8" />
                <path d="M12 3a14 14 0 0 1 0 18" />
                <path d="M12 3a14 14 0 0 0 0 18" />
              </svg>
              3D Studio
            </button>
            <button 
              className={`switcher-btn ${layoutMode === '2d' ? 'active' : ''}`}
              onClick={() => setLayoutMode('2d')}
              title="2D Maps: High-resolution map comparison"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              2D Maps
            </button>
          </div>
        )}
      </header>

      {/* Main Workspace Body */}
      <div className="app-body">
        {/* Left Sidebar: Controls & Analytics */}
        <aside className="sidebar">
          <div className="panel-card controls-card">
            <h3 className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Input Data
            </h3>
            
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>Source Satellite / Aerial Imagery <span className="req">*</span></label>
                <div className="file-input-wrapper">
                  <input 
                    type="file" 
                    id="source-image" 
                    onChange={(e) => setFile(e.target.files[0])} 
                    accept="image/*,.tif,.tiff,.h5" 
                  />
                  <div className="file-display">
                    {file ? (
                      <span className="file-name" title={file.name}>📄 {file.name}</span>
                    ) : (
                      <span className="file-placeholder">Choose image or GeoTIFF (.tif, .png, .jpg)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Reference DSM (Optional Benchmark)</label>
                <div className="file-input-wrapper">
                  <input 
                    type="file" 
                    id="ref-image" 
                    onChange={(e) => setReferenceFile(e.target.files[0])} 
                    accept=".tif,.tiff,.h5" 
                  />
                  <div className="file-display">
                    {referenceFile ? (
                      <span className="file-name" title={referenceFile.name}>📊 {referenceFile.name}</span>
                    ) : (
                      <span className="file-placeholder">Ground truth DSM (.tif, .h5) for validation</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label>Pipeline Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className="select-input">
                  <option value="auto">Auto (Detect GeoTIFF & Calibration)</option>
                  <option value="relative">Relative Monocular (Force Standard)</option>
                </select>
              </div>

              <button type="submit" className="submit-btn" disabled={!file || processing}>
                {processing ? (
                  <span className="btn-content">
                    <span className="spinner"></span> Processing AI Inference...
                  </span>
                ) : (
                  <span className="btn-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Generate 3D Terrain
                  </span>
                )}
              </button>

              <div className="sample-loader-row">
                <button type="button" className="sample-btn" onClick={loadSample}>
                  ⚡ Load Demo Scene
                </button>
                <button type="button" className="sample-btn benchmark-btn" onClick={loadBenchmarkSample}>
                  🎯 Load Benchmark Pair (Calibrated)
                </button>
              </div>
            </form>
          </div>

          {result && (
            <div className="panel-card metrics-card">
              <h3 className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                DSM Elevation Metrics
              </h3>
              
              <div className="metric-grid">
                <div className="metric-tile">
                  <span className="metric-label">Min Elevation</span>
                  <span className="metric-val">{result.min_elev?.toFixed(1)} <small>{result.dsm_type === 'metric' ? 'm' : 'u'}</small></span>
                </div>
                <div className="metric-tile">
                  <span className="metric-label">Max Elevation</span>
                  <span className="metric-val">{result.max_elev?.toFixed(1)} <small>{result.dsm_type === 'metric' ? 'm' : 'u'}</small></span>
                </div>
                <div className="metric-tile">
                  <span className="metric-label">Mean Elevation</span>
                  <span className="metric-val">{result.mean_elev?.toFixed(1)} <small>{result.dsm_type === 'metric' ? 'm' : 'u'}</small></span>
                </div>
                <div className="metric-tile highlight">
                  <span className="metric-label">Relief Range</span>
                  <span className="metric-val">{result.range_elev?.toFixed(1)} <small>{result.dsm_type === 'metric' ? 'm' : 'u'}</small></span>
                </div>
              </div>

              {result.dsm_type === 'metric' && (
                <div className="validation-section">
                  <h4 className="sub-title">Benchmark Validation</h4>
                  <div className="metric-grid validation-grid">
                    <div className="metric-tile green">
                      <span className="metric-label">MAE</span>
                      <span className="metric-val">{result.mae?.toFixed(2)} <small>m</small></span>
                    </div>
                    <div className="metric-tile green">
                      <span className="metric-label">RMSE</span>
                      <span className="metric-val">{result.rmse?.toFixed(2)} <small>m</small></span>
                    </div>
                    <div className="metric-tile green">
                      <span className="metric-label">Pearson r</span>
                      <span className="metric-val">{result.correlation?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="metadata-list">
                <div className="meta-row">
                  <span>Raster Dimension:</span>
                  <strong>{result.width} × {result.height} px</strong>
                </div>
                <div className="meta-row">
                  <span>Input Format:</span>
                  <strong>{result.is_h5 ? 'HDF5' : result.is_geotiff ? 'GeoTIFF' : 'RGB Image'}</strong>
                </div>
                <div className="meta-row">
                  <span>Georeferenced:</span>
                  <strong className={result.is_geotiff ? 'text-accent' : ''}>
                    {result.is_geotiff ? '✅ Calibrated CRS' : 'ℹ️ Relative'}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Right Workspace: Dynamic Layout */}
        <main className="workspace">
          {result ? (
            <div className={`workspace-layout layout-${layoutMode}`}>
              {/* 2D Maps Section (Used in Split and 2D modes) */}
              {(layoutMode === 'split' || layoutMode === '2d') && (
                <div className="maps-panel">
                  <div className="map-card" onClick={() => openLightbox('Original Satellite Image', result.rgb_base64)}>
                    <div className="map-card-header">
                      <span>Original Image</span>
                      <button className="expand-btn" title="Click to inspect full resolution">🔍 Expand</button>
                    </div>
                    <div className="map-image-wrapper">
                      <img src={`data:image/png;base64,${result.rgb_base64}`} alt="Original Satellite" />
                    </div>
                  </div>

                  <div className="map-card" onClick={() => openLightbox('Estimated Depth / Elevation Map', result.depth_base64)}>
                    <div className="map-card-header">
                      <span>Depth Map (DSM)</span>
                      <button className="expand-btn" title="Click to inspect full resolution">🔍 Expand</button>
                    </div>
                    <div className="map-image-wrapper">
                      <img src={`data:image/png;base64,${result.depth_base64}`} alt="Depth Map" />
                    </div>
                  </div>

                  <div className="map-card" onClick={() => openLightbox('Model Confidence Map', result.confidence_base64)}>
                    <div className="map-card-header">
                      <span>Confidence Map</span>
                      <button className="expand-btn" title="Click to inspect full resolution">🔍 Expand</button>
                    </div>
                    <div className="map-image-wrapper">
                      <img src={`data:image/png;base64,${result.confidence_base64}`} alt="Confidence Map" />
                    </div>
                  </div>

                  {result.error_base64 && (
                    <div className="map-card" onClick={() => openLightbox('Ground Truth Error Map', result.error_base64)}>
                      <div className="map-card-header">
                        <span>Error Heatmap</span>
                        <button className="expand-btn" title="Click to inspect full resolution">🔍 Expand</button>
                      </div>
                      <div className="map-image-wrapper">
                        <img src={`data:image/png;base64,${result.error_base64}`} alt="Error Map" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3D Terrain Studio Section (Used in Split and 3D modes) */}
              {(layoutMode === 'split' || layoutMode === '3d') && (
                <div className="viewer-viewport">
                  {/* Floating 3D Toolbar */}
                  <div className="floating-toolbar">
                    <div className="toolbar-group">
                      <button 
                        className={`tool-btn ${viewerMode === 'orbit' ? 'active' : ''}`}
                        onClick={() => setViewerMode('orbit')}
                      >
                        Orbit
                      </button>
                      <button 
                        className={`tool-btn ${viewerMode === 'first_person' ? 'active' : ''}`}
                        onClick={() => setViewerMode('first_person')}
                      >
                        First Person (WASD)
                      </button>
                      <button 
                        className={`tool-btn ${viewerMode === 'fly' ? 'active' : ''}`}
                        onClick={() => setViewerMode('fly')}
                      >
                        ▶ Flythrough
                      </button>
                      <button 
                        className={`tool-btn ${viewerMode === 'measure_height' ? 'active' : ''}`}
                        onClick={() => setViewerMode('measure_height')}
                      >
                        Measure Height
                      </button>
                      <button 
                        className={`tool-btn ${viewerMode === 'measure_slope' ? 'active' : ''}`}
                        onClick={() => setViewerMode('measure_slope')}
                      >
                        Measure Slope
                      </button>
                    </div>

                    <div className="toolbar-divider"></div>

                    <div className="toolbar-texture">
                      <label>Texture:</label>
                      <select value={textureMode} onChange={(e) => setTextureMode(e.target.value)}>
                        <option value="rgb">RGB Satellite</option>
                        <option value="confidence">Confidence Map</option>
                      </select>
                    </div>
                  </div>

                  {/* 3D Canvas */}
                  <div className="canvas-container">
                    <Canvas camera={{ position: [0, 100, 150], fov: 60 }}>
                      <TerrainViewer 
                        heightData={result.dsm_data} 
                        width={result.width} 
                        height={result.height} 
                        textureBase64={textureMode === 'rgb' ? result.rgb_base64 : result.confidence_base64}
                        mode={viewerMode}
                      />
                    </Canvas>

                    {(viewerMode === 'measure_height' || viewerMode === 'measure_slope') && (
                      <div className="measurement-hint">
                        💡 Click two points on the terrain to measure {viewerMode === 'measure_height' ? 'height difference' : 'slope angle'}
                      </div>
                    )}

                    {viewerMode === 'first_person' && (
                      <div className="measurement-hint">
                        🕹️ Drag to look, use W/A/S/D to fly through the terrain
                      </div>
                    )}
                  </div>

                  {/* Quick Thumbnails Dock in 3D Mode */}
                  {layoutMode === '3d' && (
                    <div className="dock-thumbnails">
                      <div 
                        className={`dock-item ${textureMode === 'rgb' ? 'active' : ''}`}
                        onClick={() => setTextureMode('rgb')}
                        title="Texture: RGB Satellite (Click to apply / Double-click to expand)"
                        onDoubleClick={() => openLightbox('Original Satellite Image', result.rgb_base64)}
                      >
                        <img src={`data:image/png;base64,${result.rgb_base64}`} alt="RGB" />
                        <span>RGB</span>
                      </div>
                      <div 
                        className="dock-item"
                        onClick={() => openLightbox('Estimated Depth / DSM', result.depth_base64)}
                        title="Depth Map (Click to inspect)"
                      >
                        <img src={`data:image/png;base64,${result.depth_base64}`} alt="Depth" />
                        <span>Depth</span>
                      </div>
                      <div 
                        className={`dock-item ${textureMode === 'confidence' ? 'active' : ''}`}
                        onClick={() => setTextureMode('confidence')}
                        title="Texture: Confidence Heatmap (Click to apply)"
                        onDoubleClick={() => openLightbox('Confidence Map', result.confidence_base64)}
                      >
                        <img src={`data:image/png;base64,${result.confidence_base64}`} alt="Confidence" />
                        <span>Confidence</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="hero-placeholder">
              <div className="hero-content">
                <div className="hero-badge">
                  <span className="dot online"></span> Single-View Satellite Height Estimation
                </div>
                <h2>Interactive 3D Digital Surface Model Pipeline</h2>
                <p>
                  Transform monocular 2D optical satellite or aerial imagery into georeferenced, 
                  calibrated 3D terrains with real-time flythrough and spatial analysis.
                </p>

                <div className="feature-grid">
                  <div className="feature-card">
                    <div className="feature-icon">🛰️</div>
                    <h4>Single-View Depth</h4>
                    <p>Foundation AI model estimates high-resolution relative depth and relief.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">📏</div>
                    <h4>Metric DSM Calibration</h4>
                    <p>Converts relative disparity into absolute physical elevation in meters.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">🎮</div>
                    <h4>3D Flythrough & Probing</h4>
                    <p>Interactive 60fps orbit, drone flythrough, height and slope measurement.</p>
                  </div>
                </div>

                <div className="upload-prompt-badge">
                  <span>👈 Upload an aerial image or GeoTIFF from the sidebar, or</span>
                  <button type="button" className="hero-sample-btn" onClick={loadSample}>
                    ⚡ Load Demo Scene
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Lightbox Modal */}
      {lightbox && (
        <div className="lightbox-backdrop" onClick={() => setLightbox(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <h3>{lightbox.title}</h3>
              <button className="close-btn" onClick={() => setLightbox(null)}>✕</button>
            </div>
            <div className="lightbox-body">
              <img src={lightbox.src} alt={lightbox.title} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
