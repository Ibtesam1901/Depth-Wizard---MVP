import React, { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PointerLockControls, Html } from '@react-three/drei'
import * as THREE from 'three'

export default function TerrainViewer({ 
  heightData, 
  width, 
  height, 
  textureBase64,
  depthBase64,
  slopeBase64,
  errorBase64,
  activeLayer = 'rgb', // 'rgb', 'depth', 'slope', 'error', 'wireframe'
  mode = 'orbit', // 'orbit', 'fly', 'first_person', 'top', 'side', 'measure_height', 'inspect'
  dsmType = 'relative',
  rangeElev = null,
  minElev = 0,
  maxElev = 100,
  resetTrigger = 0,
  zExaggeration = 1.0,
  onInspectPoint = null
}) {
  const meshRef = useRef()
  const geometryRef = useRef()
  const controlsRef = useRef()
  const pointerLockRef = useRef()
  const { camera } = useThree()
  
  const [points, setPoints] = useState([])
  const [measurement, setMeasurement] = useState(null)
  const [inspectedInfo, setInspectedInfo] = useState(null)
  const flyProgress = useRef(0)

  // Keyboard navigation for First-Person Fly Mode
  const keysPressed = useRef({})
  useEffect(() => {
    const handleKeyDown = (e) => { keysPressed.current[e.code] = true }
    const handleKeyUp = (e) => { keysPressed.current[e.code] = false }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // 1. Dynamic Texture Management based on active layer
  const activeTexture = useMemo(() => {
    let b64 = textureBase64
    if (activeLayer === 'depth' && depthBase64) b64 = depthBase64
    else if (activeLayer === 'slope' && slopeBase64) b64 = slopeBase64
    else if (activeLayer === 'error' && errorBase64) b64 = errorBase64
    else if (activeLayer === 'rgb' && textureBase64) b64 = textureBase64

    if (!b64) return null
    const tex = new THREE.TextureLoader().load(`data:image/png;base64,${b64}`)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [textureBase64, depthBase64, slopeBase64, errorBase64, activeLayer])

  // 2. Displace geometry vertices based on DSM elevation array
  useEffect(() => {
    if (!geometryRef.current || !heightData || heightData.length === 0) return
    const positions = geometryRef.current.attributes.position.array
    
    const maxH = maxElev !== undefined ? maxElev : Math.max(...heightData)
    const minH = minElev !== undefined ? minElev : Math.min(...heightData)
    const range = (maxH - minH) > 1e-6 ? (maxH - minH) : 1.0
    
    for (let i = 0; i < positions.length / 3; i++) {
      const h = heightData[i] !== undefined ? heightData[i] : 0
      const zScale = 0.22 * width * (zExaggeration || 1.0)
      positions[i * 3 + 2] = ((h - minH) / range) * zScale
    }
    
    geometryRef.current.computeVertexNormals()
    geometryRef.current.attributes.position.needsUpdate = true
  }, [heightData, width, height, zExaggeration, minElev, maxElev])

  // 3. View mode camera alignments
  useEffect(() => {
    if (mode === 'top') {
      camera.position.set(0, width * 1.3, 0)
      camera.lookAt(0, 0, 0)
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0)
        controlsRef.current.update()
      }
    } else if (mode === 'side') {
      camera.position.set(width * 1.3, width * 0.1, 0)
      camera.lookAt(0, 0, 0)
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0)
        controlsRef.current.update()
      }
    } else if (resetTrigger > 0 || mode === 'orbit') {
      camera.position.set(0, width * 0.7, width * 0.9)
      camera.lookAt(0, 0, 0)
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0)
        controlsRef.current.update()
      }
    }
  }, [resetTrigger, mode, camera, width])

  // 4. Animation loop: Flythrough & First-Person Controls
  useFrame((state, delta) => {
    if (mode === 'fly') {
      if (controlsRef.current) controlsRef.current.enabled = false
      flyProgress.current += delta * 0.2
      if (flyProgress.current > Math.PI * 2) flyProgress.current = 0
      
      const radius = Math.max(width, height) * 0.85
      camera.position.x = Math.sin(flyProgress.current) * radius
      camera.position.y = radius * 0.38
      camera.position.z = Math.cos(flyProgress.current) * radius
      camera.lookAt(0, 0, 0)
    } else if (mode === 'first_person') {
      if (controlsRef.current) controlsRef.current.enabled = false
      const speed = width * delta * 0.6
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize()

      if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) {
        camera.position.addScaledVector(dir, speed)
      }
      if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) {
        camera.position.addScaledVector(dir, -speed)
      }
      if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) {
        camera.position.addScaledVector(side, speed)
      }
      if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) {
        camera.position.addScaledVector(side, -speed)
      }
      if (keysPressed.current['Space']) {
        camera.position.y += speed * 0.8
      }
      if (keysPressed.current['ShiftLeft'] || keysPressed.current['ControlLeft']) {
        camera.position.y -= speed * 0.8
      }
    } else if (mode === 'measure_height' || mode === 'inspect') {
      if (controlsRef.current) controlsRef.current.enabled = false
    } else {
      if (controlsRef.current) controlsRef.current.enabled = true
    }
  })

  // 5. Raycasting for Height Measurement & Point Inspector
  const handlePointerDown = (e) => {
    if (mode !== 'measure_height' && mode !== 'inspect') return
    e.stopPropagation()
    
    const point = e.point.clone()

    // POINT INSPECTOR MODE
    if (mode === 'inspect') {
      if (!e.uv) return
      const pixelX = Math.min(Math.floor(e.uv.x * width), width - 1)
      const pixelY = Math.min(Math.floor((1.0 - e.uv.y) * height), height - 1)
      const idx = pixelY * width + pixelX
      const elev = heightData && heightData[idx] !== undefined ? heightData[idx] : 0

      // Calculate local slope
      const xPrev = Math.max(0, pixelX - 1)
      const xNext = Math.min(width - 1, pixelX + 1)
      const yPrev = Math.max(0, pixelY - 1)
      const yNext = Math.min(height - 1, pixelY + 1)
      const dz_dx = (heightData[pixelY * width + xNext] - heightData[pixelY * width + xPrev]) / Math.max(xNext - xPrev, 1)
      const dz_dy = (heightData[yNext * width + pixelX] - heightData[yPrev * width + pixelX]) / Math.max(yNext - yPrev, 1)
      const slopeDeg = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy)) * (180 / Math.PI)

      const info = {
        x: pixelX,
        y: pixelY,
        elevation: elev,
        slope: slopeDeg,
        worldPoint: point
      }
      setInspectedInfo(info)
      if (onInspectPoint) onInspectPoint(info)
      return
    }

    // HEIGHT MEASUREMENT MODE
    if (points.length === 1) {
      const p1 = points[0]
      const p2 = point
      const dY = p2.y - p1.y
      
      const zScale = 0.22 * width * (zExaggeration || 1.0)
      const actualRange = (rangeElev !== null && rangeElev !== undefined && rangeElev > 0) 
        ? rangeElev 
        : (Math.max(...heightData) - Math.min(...heightData) || 1.0)
      const realHeightDiff = (Math.abs(dY) / zScale) * actualRange
      const unit = dsmType === 'metric' ? 'm' : 'units'
      
      setMeasurement({
        text: `Height: ${realHeightDiff.toFixed(2)} ${unit}`,
        topElev: (Math.max(p1.y, p2.y) / zScale * actualRange + minElev).toFixed(1),
        groundElev: (Math.min(p1.y, p2.y) / zScale * actualRange + minElev).toFixed(1),
        unit,
        p1,
        p2
      })
      setPoints([p1, p2])
      
      setTimeout(() => {
        setPoints([])
        setMeasurement(null)
      }, 7000)
    } else {
      setPoints([point])
      setMeasurement(null)
    }
  }

  const linePositions = useMemo(() => {
    if (points.length !== 2) return null
    return new Float32Array([
      points[0].x, points[0].y, points[0].z,
      points[1].x, points[1].y, points[1].z
    ])
  }, [points])

  return (
    <group>
      {mode === 'first_person' ? (
        <PointerLockControls ref={pointerLockRef} />
      ) : (
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.06} />
      )}
      
      {/* Lighting Rig for High-Fidelity Relief */}
      <ambientLight intensity={0.55} />
      <hemisphereLight intensity={0.45} groundColor="#0f172a" />
      <directionalLight position={[25, 45, 25]} intensity={1.5} castShadow />
      <directionalLight position={[-25, 30, -25]} intensity={0.5} />
      
      <mesh 
        ref={meshRef} 
        rotation={[-Math.PI / 2, 0, 0]} 
        onPointerDown={handlePointerDown}
      >
        <planeGeometry 
          ref={geometryRef} 
          args={[width, height, width - 1, height - 1]} 
        />
        {activeTexture && activeLayer !== 'wireframe' ? (
          <meshStandardMaterial 
            map={activeTexture} 
            roughness={0.75}
            metalness={0.05}
            side={THREE.DoubleSide} 
          />
        ) : (
          <meshStandardMaterial 
            color="#38bdf8" 
            wireframe={true} 
            side={THREE.DoubleSide} 
          />
        )}
      </mesh>

      {/* Measurement Pins & Connecting Line */}
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y + 0.6, p.z]}>
          <sphereGeometry args={[Math.max(1.2, width * 0.012), 16, 16]} />
          <meshBasicMaterial color={i === 0 ? "#10b981" : "#ef4444"} />
        </mesh>
      ))}

      {linePositions && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={linePositions}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#f59e0b" linewidth={3} />
        </line>
      )}

      {/* 3D Measurement Overlay Card */}
      {measurement && points.length === 2 && (
        <Html position={[points[1].x, points[1].y + 4, points[1].z]} center distanceFactor={160}>
          <div className="measurement-3d-tag">
            <div className="tag-header">📏 Structure Height</div>
            <div className="tag-val">{measurement.text}</div>
            <div className="tag-sub">Top: {measurement.topElev} {measurement.unit} • Base: {measurement.groundElev} {measurement.unit}</div>
          </div>
        </Html>
      )}

      {/* 3D Point Inspector Tag */}
      {inspectedInfo && mode === 'inspect' && (
        <Html position={[inspectedInfo.worldPoint.x, inspectedInfo.worldPoint.y + 3, inspectedInfo.worldPoint.z]} center distanceFactor={160}>
          <div className="measurement-3d-tag inspect-tag">
            <div className="tag-header">📍 Point Inspector</div>
            <div className="tag-val">Z: {inspectedInfo.elevation.toFixed(1)} {dsmType === 'metric' ? 'm' : 'units'}</div>
            <div className="tag-sub">Pixel: ({inspectedInfo.x}, {inspectedInfo.y}) • Slope: {inspectedInfo.slope.toFixed(1)}°</div>
          </div>
        </Html>
      )}
    </group>
  )
}
