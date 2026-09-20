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
      const response = await fetch(`http://localhost:8000/process?mode=${mode}&calibration=${calibration}`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed. Is the backend running?')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="app-container">
      <header>
        <h1>DepthWizard</h1>
        <p>Single-Image → Calibrated DSM → Interactive 3D Terrain</p>
      </header>

      <main>
        <section className="sidebar">
          <div className="controls">
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>Upload Image/GeoTIFF/H5:</label>
                <input type="file" onChange={(e) => setFile(e.target.files[0])} accept="image/*,.tif,.tiff,.h5" />
              </div>
              <div className="form-group">
                <label>Reference DSM (Optional):</label>
                <input type="file" onChange={(e) => setReferenceFile(e.target.files[0])} accept=".tif,.tiff" />
              </div>
              
              <div className="form-group">
                <label>Mode:</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="auto">Auto (Detect GeoTIFF)</option>
                  <option value="relative">Relative (Force JPG/PNG)</option>
                </select>
              </div>

              <button type="submit" disabled={!file || processing}>
                {processing ? 'Processing...' : 'Generate Terrain'}
              </button>
            </form>
          </div>

          {result && (
            <div className="metrics-panel">
              <h3>Image Information</h3>
              <ul className="info-list" style={{listStyle: 'none', padding: 0, fontSize: '0.9em', color: 'var(--text-muted)'}}>
                <li><strong style={{color: 'var(--text-main)'}}>Width:</strong> {result.width}</li>
                <li><strong style={{color: 'var(--text-main)'}}>Height:</strong> {result.height}</li>
                <li><strong style={{color: 'var(--text-main)'}}>Format:</strong> {result.is_h5 ? 'HDF5 (GAMUS)' : result.is_geotiff ? 'GeoTIFF' : 'Standard Image'}</li>
                <li><strong style={{color: 'var(--text-main)'}}>Georeferenced:</strong> {result.is_geotiff ? '✅ Yes' : '❌ No'}</li>
              </ul>
              
              <h3>DSM Analysis</h3>
              <div className="metric-grid">
                <div className="metric-box">
                  <span className="label">Min Elev</span>
                  <span className="value">{result.min_elev?.toFixed(1)} {result.dsm_type === 'metric' ? 'm' : 'u'}</span>
                </div>
                <div className="metric-box">
                  <span className="label">Max Elev</span>
                  <span className="value">{result.max_elev?.toFixed(1)} {result.dsm_type === 'metric' ? 'm' : 'u'}</span>
                </div>
                <div className="metric-box">
                  <span className="label">Mean</span>
                  <span className="value">{result.mean_elev?.toFixed(1)} {result.dsm_type === 'metric' ? 'm' : 'u'}</span>
                </div>
                <div className="metric-box">
                  <span className="label">Range</span>
                  <span className="value">{result.range_elev?.toFixed(1)} {result.dsm_type === 'metric' ? 'm' : 'u'}</span>
                </div>
              </div>

              {result.dsm_type === 'metric' && (
                <>
                  <h3>Validation vs Reference</h3>
                  <div className="metric-grid">
                    <div className="metric-box highlight">
                      <span className="label">MAE</span>
                      <span className="value">{result.mae?.toFixed(2)} m</span>
                    </div>
                    <div className="metric-box highlight">
                      <span className="label">RMSE</span>
                      <span className="value">{result.rmse?.toFixed(2)} m</span>
                    </div>
                    <div className="metric-box highlight">
                      <span className="label">Corr</span>
                      <span className="value">{result.correlation?.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <section className="main-content">
          {result ? (
            <div className="dashboard">
              <div className="image-preview-row">
                <div className="image-card">
                  <h4>Original Image</h4>
                  <img src={`data:image/png;base64,${result.rgb_base64}`} alt="Original" />
                </div>
                <div className="image-card">
                  <h4>Depth Map</h4>
                  <img src={`data:image/png;base64,${result.depth_base64}`} alt="Depth" />
                </div>
                <div className="image-card">
                  <h4>Confidence</h4>
                  <img src={`data:image/png;base64,${result.confidence_base64}`} alt="Confidence" />
                </div>
                {result.error_base64 && (
                  <div className="image-card">
                    <h4>Error Map</h4>
                    <img src={`data:image/png;base64,${result.error_base64}`} alt="Error Map" />
                  </div>
                )}
              </div>

              <div className="viewer-wrapper">
                <div className="viewer-toolbar">
                  <button className={viewerMode === 'orbit' ? 'active' : ''} onClick={() => setViewerMode('orbit')}>Orbit</button>
                  <button className={viewerMode === 'first_person' ? 'active' : ''} onClick={() => setViewerMode('first_person')}>First Person (WASD)</button>
                  <button className={viewerMode === 'fly' ? 'active' : ''} onClick={() => setViewerMode('fly')}>▶ Flythrough</button>
                  <button className={viewerMode === 'measure_height' ? 'active' : ''} onClick={() => setViewerMode('measure_height')}>Measure Height</button>
                  <button className={viewerMode === 'measure_slope' ? 'active' : ''} onClick={() => setViewerMode('measure_slope')}>Measure Slope</button>
                  <select value={textureMode} onChange={(e) => setTextureMode(e.target.value)}>
                    <option value="rgb">RGB Texture</option>
                    <option value="confidence">Confidence Map</option>
                  </select>
                </div>
                
                <div className="viewer-container">
                  <Canvas camera={{ position: [0, 100, 150], fov: 60 }}>
                    <TerrainViewer 
                      heightData={result.dsm_data} 
                      width={result.width} 
                      height={result.height} 
                      textureBase64={textureMode === 'rgb' ? result.rgb_base64 : result.confidence_base64}
                      mode={viewerMode}
                    />
                  </Canvas>
                </div>
              </div>
            </div>
          ) : (
            <div className="placeholder">
              <p>Upload an image to see the 3D terrain</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
