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
  const [wireframe, setWireframe] = useState(false)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [zExaggeration, setZExaggeration] = useState(1.0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [dragOverSource, setDragOverSource] = useState(false)
  const [processingStep, setProcessingStep] = useState(1)

  const handleUpload = async (e) => {
    e?.preventDefault?.()
    if (!file) return

    setProcessing(true)
    setProcessingStep(1)

    // Simulate multi-step progress animation for superior user feedback
    const stepTimer1 = setTimeout(() => setProcessingStep(2), 700)
    const stepTimer2 = setTimeout(() => setProcessingStep(3), 1800)
    const stepTimer3 = setTimeout(() => setProcessingStep(4), 2900)
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
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)
      clearTimeout(stepTimer3)
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
      setReferenceFile(null)
    } catch (err) {
      console.error('Failed to load sample:', err)
    }
  }

  const loadGeoTIFFSample = async () => {
    try {
      const res = await fetch('/demo_geotiff.tif')
      const blob = await res.blob()
      const sampleFile = new File([blob], 'test_geo.tif', { type: 'image/tiff' })
      setFile(sampleFile)
      setReferenceFile(null)
    } catch (err) {
      console.error('Failed to load GeoTIFF sample:', err)
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

  const downloadGeoTIFF = () => {
    if (!result?.geotiff_base64) return
    const byteCharacters = atob(result.geotiff_base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'image/tiff' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = result.export_filename || 'dsm_export.tif'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getActiveTexture = () => {
    if (!result) return null
    if (textureMode === 'depth') return result.depth_base64
    if (textureMode === 'confidence') return result.confidence_base64
    if (textureMode === 'error') return result.error_base64 || result.depth_base64
    return result.rgb_base64
  }

  return (
    <div className="app-shell">
      {/* Top Navigation Bar */}
      <header className="top-navbar">
        <div className="nav-left-cluster">
          <button 
            className={`sidebar-toggle-btn ${sidebarCollapsed ? 'collapsed' : ''}`}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar to Maximize Canvas"}
            aria-label="Toggle sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

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
              <span className="brand-badge">ISRO 26175 • Monocular 3D DSM</span>
            </div>
          </div>
        </div>

        <div className="nav-center-cluster">
          {processing ? (
            <div className="status-pill active-inference">
              <span className="pulsing-radar"></span>
              <span>Running Step {processingStep}/4: {
                processingStep === 1 ? 'Ingesting Raster Data...' :
                processingStep === 2 ? 'Depth Backbone Inference...' :
                processingStep === 3 ? 'Calibrating Metric Scale...' :
                'Synthesizing 3D Topography...'
              }</span>
            </div>
          ) : result ? (
            <div className="status-pill online">
              <span className="dot online"></span>
              <span>Model Ready • 3D Topography Active</span>
            </div>
          ) : (
            <div className="status-pill idle">
              <span className="dot idle"></span>
              <span>Awaiting Optical Satellite / GeoTIFF Input</span>
            </div>
          )}
        </div>

        {result && (
          <div className="nav-chips">
            <span className="chip"><span className="dot online"></span> {result.width} × {result.height} px</span>
            <span className="chip">{result.is_geotiff ? '🌐 GeoTIFF' : result.is_h5 ? '📦 HDF5' : '📷 Optical RGB'}</span>
            <span className="chip highlight">
              {result.dsm_type === 'metric' ? `Elev: ${result.min_elev?.toFixed(0)}m – ${result.max_elev?.toFixed(0)}m` : `Relief: ${result.range_elev?.toFixed(2)} (rDSM)`}
            </span>
          </div>
        )}

        {result && (
          <div className="nav-actions-group">
            <button 
              className="export-btn-top" 
              onClick={downloadGeoTIFF}
              title="Download Standard Geospatial GeoTIFF Raster (.tif)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export GeoTIFF
            </button>
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
        </div>
      )}
    </header>

      {/* Main Workspace Body */}
      <div className="app-body">
        {/* Left Sidebar: Controls & Analytics */}
        <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-card controls-card">
            <div className="card-header-row">
              <h3 className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Input Data
              </h3>
              <span className="source-counter-badge">{file ? '1 Loaded' : '0 Loaded'}</span>
            </div>
            
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>Source Satellite / Aerial Imagery <span className="req">*</span></label>
                <div 
                  className={`file-input-wrapper ${dragOverSource ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverSource(true); }}
                  onDragLeave={() => setDragOverSource(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSource(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <input 
                    type="file" 
                    id="source-image" 
                    onChange={(e) => setFile(e.target.files[0])} 
                    accept="image/*,.tif,.tiff,.h5" 
                  />
                  <div className="file-display">
                    {file ? (
                      <div className="file-selected-row">
                        <span className="file-name" title={file.name}>📄 {file.name}</span>
                        <button 
                          type="button" 
                          className="clear-file-btn" 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFile(null); }}
                          title="Remove file"
                        >✕</button>
                      </div>
                    ) : (
                      <span className="file-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{marginRight: '6px', verticalAlign: '-2px'}}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Drop image or GeoTIFF (.tif, .png, .jpg)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Reference DSM (Optional Benchmark)</label>
                <div className={`file-input-wrapper ${referenceFile ? 'has-file' : ''}`}>
                  <input 
                    type="file" 
                    id="ref-image" 
                    onChange={(e) => setReferenceFile(e.target.files[0])} 
                    accept=".tif,.tiff,.h5" 
                  />
                  <div className="file-display">
                    {referenceFile ? (
                      <div className="file-selected-row">
                        <span className="file-name" title={referenceFile.name}>📊 {referenceFile.name}</span>
                        <button 
                          type="button" 
                          className="clear-file-btn" 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReferenceFile(null); }}
                          title="Remove reference file"
                        >✕</button>
                      </div>
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
                    <span className="spinner"></span> Processing Pipeline...
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

              {/* Multi-stage interactive pipeline progress */}
              {processing && (
                <div className="processing-stepper">
                  <div className={`step-item ${processingStep >= 1 ? 'active' : ''} ${processingStep > 1 ? 'done' : ''}`}>
                    <div className="step-circle">{processingStep > 1 ? '✓' : '1'}</div>
                    <span className="step-text">Ingesting Raster Image</span>
                  </div>
                  <div className={`step-item ${processingStep >= 2 ? 'active' : ''} ${processingStep > 2 ? 'done' : ''}`}>
                    <div className="step-circle">{processingStep > 2 ? '✓' : '2'}</div>
                    <span className="step-text">Monocular Depth Inference</span>
                  </div>
                  <div className={`step-item ${processingStep >= 3 ? 'active' : ''} ${processingStep > 3 ? 'done' : ''}`}>
                    <div className="step-circle">{processingStep > 3 ? '✓' : '3'}</div>
                    <span className="step-text">Metric Scale Calibration</span>
                  </div>
                  <div className={`step-item ${processingStep >= 4 ? 'active' : ''}`}>
                    <div className="step-circle">{processingStep >= 4 ? '✓' : '4'}</div>
                    <span className="step-text">Synthesizing 3D Topography</span>
                  </div>
                </div>
              )}

              <div className="sample-loader-row">
                <button type="button" className="sample-btn" onClick={loadSample}>
                  ⚡ Load Optical RGB (rDSM)
                </button>
                <button type="button" className="sample-btn geotiff-btn" onClick={loadGeoTIFFSample}>
                  🌐 Load GeoTIFF (Georeferenced)
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
                  <span>Input Ingestion:</span>
                  <strong>{result.is_h5 ? 'HDF5 Scientific' : result.is_geotiff ? 'GeoTIFF (Geospatial)' : 'Optical RGB (PNG/JPG)'}</strong>
                </div>
                <div className="meta-row">
                  <span>DSM Model:</span>
                  <strong className={result.dsm_type === 'metric' ? 'text-accent' : ''}>
                    {result.dsm_type === 'metric' ? 'Absolute Metric DSM' : 'Relative DSM (rDSM)'}
                  </strong>
                </div>
                <div className="meta-row">
                  <span>Spatial Reference:</span>
                  <strong>{result.crs || 'Local Pixel Grid'}</strong>
                </div>
                <div className="meta-row">
                  <span>Calibration:</span>
                  <strong>
                    {result.calibration_method === 'ground_truth_regression' 
                      ? 'Ground Truth Regression' 
                      : result.calibration_method === 'scene_prior' 
                      ? 'Scene Prior Metric Scaling' 
                      : 'None (Visual Relief)'}
                  </strong>
                </div>

                <div className="export-action-box">
                  <button 
                    type="button" 
                    className="export-dsm-btn" 
                    onClick={downloadGeoTIFF}
                    title="Export the final high-fidelity DSM as a standard GeoTIFF"
                  >
                    💾 Export GeoTIFF DSM (.tif)
                  </button>
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
                        title="Orbit Camera: Click and drag to rotate terrain"
                      >
                        Orbit
                      </button>
                      <button 
                        className={`tool-btn ${viewerMode === 'first_person' ? 'active' : ''}`}
                        onClick={() => setViewerMode('first_person')}
                        title="WASD Drone Mode: Free-flight controls across 3D terrain"
                      >
                        Drone (WASD)
                      </button>
                      <button 
                        className={`tool-btn ${viewerMode === 'fly' ? 'active' : ''}`}
                        onClick={() => setViewerMode('fly')}
                        title="Autonomous 360° Cinematic Orbital Flythrough"
                      >
                        ▶ Flythrough
                      </button>
                      <button 
                        className={`tool-btn ${viewerMode === 'measure_height' ? 'active' : ''}`}
                        onClick={() => setViewerMode('measure_height')}
                        title="Probe Height: Click 2 points to measure vertical height difference"
                      >
                        Measure Height
                      </button>
                      <button 
                        className={`tool-btn ${viewerMode === 'measure_slope' ? 'active' : ''}`}
                        onClick={() => setViewerMode('measure_slope')}
                        title="Probe Slope: Click 2 points to calculate surface inclination angle"
                      >
                        Measure Slope
                      </button>
                      <button 
                        className={`tool-btn ${wireframe ? 'active' : ''}`}
                        onClick={() => setWireframe(!wireframe)}
                        title="Toggle 3D Triangular Surface Wireframe Mesh"
                      >
                        📐 Wireframe
                      </button>
                      <button 
                        className="tool-btn"
                        onClick={() => setResetTrigger(prev => prev + 1)}
                        title="Reset 3D camera to default viewpoint"
                      >
                        🔄 Reset
                      </button>
                    </div>

                    <div className="toolbar-divider"></div>

                    {/* Relief Vertical Exaggeration Slider */}
                    <div className="toolbar-relief-group" title="Topographic Vertical Relief Exaggeration Multiplier">
                      <span className="relief-label">Relief: <strong>{zExaggeration.toFixed(1)}×</strong></span>
                      <input 
                        type="range" 
                        min="0.2" 
                        max="3.0" 
                        step="0.1" 
                        value={zExaggeration} 
                        onChange={(e) => setZExaggeration(parseFloat(e.target.value))} 
                        className="relief-slider"
                      />
                    </div>

                    <div className="toolbar-divider"></div>

                    <div className="toolbar-texture">
                      <label>Texture:</label>
                      <select value={textureMode} onChange={(e) => setTextureMode(e.target.value)}>
                        <option value="rgb">Optical RGB</option>
                        <option value="depth">Elevation DSM (Viridis)</option>
                        <option value="confidence">Confidence Heatmap (Plasma)</option>
                        {result.error_base64 && <option value="error">Error Heatmap (Jet)</option>}
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
                        textureBase64={getActiveTexture()}
                        mode={viewerMode}
                        dsmType={result.dsm_type}
                        rangeElev={result.range_elev}
                        wireframe={wireframe}
                        resetTrigger={resetTrigger}
                        zExaggeration={zExaggeration}
                      />
                    </Canvas>

                    {/* Floating Topographic Elevation Legend */}
                    <div className="elevation-legend-widget">
                      <div className="legend-header">
                        <span className="legend-title">DSM Topography</span>
                        <span className="legend-unit">{result.dsm_type === 'metric' ? 'Elevation MSL (m)' : 'Normalized Disparity'}</span>
                      </div>
                      <div className="legend-bar-container">
                        <div className="legend-bar-gradient"></div>
                        <div className="legend-labels">
                          <span>{result.min_elev?.toFixed(0)}{result.dsm_type === 'metric' ? 'm' : ''}</span>
                          <span>{result.mean_elev?.toFixed(0)}{result.dsm_type === 'metric' ? 'm' : ''}</span>
                          <span>{result.max_elev?.toFixed(0)}{result.dsm_type === 'metric' ? 'm' : ''}</span>
                        </div>
                      </div>
                    </div>

                    {(viewerMode === 'measure_height' || viewerMode === 'measure_slope') && (
                      <div className="measurement-hint">
                        💡 Click two points on the terrain to measure {viewerMode === 'measure_height' ? 'height difference' : 'slope angle'}
                      </div>
                    )}

                    {viewerMode === 'first_person' && (
                      <div className="measurement-hint">
                        🕹️ Drag to look around • Use W / A / S / D keys to fly across the 3D surface
                      </div>
                    )}
                  </div>

                  {/* Quick Thumbnails Dock in 3D Mode */}
                  {layoutMode === '3d' && (
                    <div className="dock-thumbnails">
                      <div 
                        className={`dock-item ${textureMode === 'rgb' ? 'active' : ''}`}
                        onClick={() => setTextureMode('rgb')}
                        title="Texture: Optical RGB (Click to apply / Double-click to expand)"
                        onDoubleClick={() => openLightbox('Original Satellite Image', result.rgb_base64)}
                      >
                        <img src={`data:image/png;base64,${result.rgb_base64}`} alt="RGB" />
                        <span>RGB</span>
                      </div>
                      <div 
                        className={`dock-item ${textureMode === 'depth' ? 'active' : ''}`}
                        onClick={() => setTextureMode('depth')}
                        title="Texture: Elevation DSM (Click to apply / Double-click to expand)"
                        onDoubleClick={() => openLightbox('Estimated Depth / DSM', result.depth_base64)}
                      >
                        <img src={`data:image/png;base64,${result.depth_base64}`} alt="Depth" />
                        <span>DSM</span>
                      </div>
                      <div 
                        className={`dock-item ${textureMode === 'confidence' ? 'active' : ''}`}
                        onClick={() => setTextureMode('confidence')}
                        title="Texture: Confidence Heatmap (Click to apply / Double-click to expand)"
                        onDoubleClick={() => openLightbox('Confidence Map', result.confidence_base64)}
                      >
                        <img src={`data:image/png;base64,${result.confidence_base64}`} alt="Confidence" />
                        <span>Confidence</span>
                      </div>
                      {result.error_base64 && (
                        <div 
                          className={`dock-item ${textureMode === 'error' ? 'active' : ''}`}
                          onClick={() => setTextureMode('error')}
                          title="Texture: Error Heatmap (Click to apply / Double-click to expand)"
                          onDoubleClick={() => openLightbox('Error Heatmap', result.error_base64)}
                        >
                          <img src={`data:image/png;base64,${result.error_base64}`} alt="Error" />
                          <span>Error</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="hero-placeholder">
              <div className="hero-content">
                <div className="hero-badge">
                  <span className="dot online"></span> ISRO Problem Statement 26175 • End-to-End Pipeline
                </div>
                <h2>Single-View Height Estimation & 3D Flythrough</h2>
                <p className="hero-subtext">
                  Transform monocular 2D optical satellite imagery into high-precision, georeferenced 
                  Digital Surface Models (DSM) with real-time 3D orbital flythrough and spatial measurement.
                </p>

                {/* Hero Drag and Drop Zone */}
                <div 
                  className={`hero-dropzone ${dragOverSource ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverSource(true); }}
                  onDragLeave={() => setDragOverSource(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSource(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <div className="dropzone-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="dropzone-text-group">
                    <div className="dropzone-title">
                      {file ? `Selected: ${file.name}` : 'Drag & Drop Satellite or GeoTIFF Imagery Here'}
                    </div>
                    <div className="dropzone-desc">
                      Accepts standard optical RGB (.png, .jpg), Georeferenced GeoTIFF (.tif), or Scientific HDF5 (.h5)
                    </div>
                  </div>
                  <label className="hero-browse-label">
                    <span>{file ? 'Change File' : 'Browse Local Files'}</span>
                    <input 
                      type="file" 
                      onChange={(e) => setFile(e.target.files[0])} 
                      accept="image/*,.tif,.tiff,.h5" 
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {/* Scenario Cards */}
                <div className="scenario-section">
                  <div className="scenario-section-header">
                    <span>Or Explore Interactive Validation Scenarios:</span>
                  </div>
                  <div className="scenario-grid">
                    <div className="scenario-card" onClick={loadSample}>
                      <div className="scenario-icon-chip rgb">📷</div>
                      <div className="scenario-info">
                        <h4>Non-Georeferenced RGB</h4>
                        <p>Generates Relative Digital Surface Model (rDSM) & confidence heatmap</p>
                      </div>
                      <button type="button" className="scenario-btn">Load Scenario ⚡</button>
                    </div>

                    <div className="scenario-card" onClick={loadGeoTIFFSample}>
                      <div className="scenario-icon-chip geo">🌐</div>
                      <div className="scenario-info">
                        <h4>Georeferenced GeoTIFF</h4>
                        <p>Produces Absolute Metric DSM with affine spatial projection & export</p>
                      </div>
                      <button type="button" className="scenario-btn">Load Scenario ⚡</button>
                    </div>

                    <div className="scenario-card" onClick={loadBenchmarkSample}>
                      <div className="scenario-icon-chip benchmark">🎯</div>
                      <div className="scenario-info">
                        <h4>Calibrated Benchmark (GAMUS)</h4>
                        <p>Evaluates MAE, RMSE & Pearson correlation against ground truth DEM</p>
                      </div>
                      <button type="button" className="scenario-btn">Load Scenario ⚡</button>
                    </div>
                  </div>
                </div>

                {/* Pipeline Feature Architecture */}
                <div className="feature-grid">
                  <div className="feature-card">
                    <div className="feature-icon">🛰️</div>
                    <h4>Monocular Depth Backbone</h4>
                    <p>Extracts scale-agnostic geometric relief using foundation vision backbones.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">📏</div>
                    <h4>Metric Height Calibration</h4>
                    <p>Calculates absolute meters above sea level via regression & scene priors.</p>
                  </div>
                  <div className="feature-card">
                    <div className="feature-icon">🎮</div>
                    <h4>3D Flythrough & Spatial Probing</h4>
                    <p>Real-time 60fps drone navigation, slope estimation, and height difference vector probing.</p>
                  </div>
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
