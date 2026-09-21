import React, { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, FlyControls, Html } from '@react-three/drei'
import * as THREE from 'three'

export default function TerrainViewer({ 
  heightData, 
  width, 
  height, 
  textureBase64,
  mode = 'orbit', // 'orbit', 'first_person', 'fly', 'measure_height', 'measure_slope'
  dsmType = 'relative',
  rangeElev = null,
  wireframe = false,
  resetTrigger = 0
}) {
  const meshRef = useRef()
  const geometryRef = useRef()
  const controlsRef = useRef()
  const { camera } = useThree()
  
  const [points, setPoints] = useState([])
  const [measurement, setMeasurement] = useState(null)
  const flyProgress = useRef(0)

  // 1. Create texture from base64
  const texture = useMemo(() => {
    if (!textureBase64) return null
    const tex = new THREE.TextureLoader().load(`data:image/png;base64,${textureBase64}`)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [textureBase64])

  // 2. Displace geometry
  useEffect(() => {
    if (!geometryRef.current || !heightData || heightData.length === 0) return
    const positions = geometryRef.current.attributes.position.array
    
    const maxH = Math.max(...heightData)
    const minH = Math.min(...heightData)
    const range = maxH - minH || 1
    
    for (let i = 0; i < positions.length / 3; i++) {
      const h = heightData[i] || 0
      // Scale height relative to the terrain width for an aesthetically balanced relief
      const zScale = 0.22 * width 
      positions[i * 3 + 2] = ((h - minH) / range) * zScale
    }
    
    geometryRef.current.computeVertexNormals()
    geometryRef.current.attributes.position.needsUpdate = true
  }, [heightData, width, height])

  // 3. Reset Camera Trigger
  useEffect(() => {
    if (resetTrigger > 0) {
      camera.position.set(0, width * 0.7, width * 0.9)
      camera.lookAt(0, 0, 0)
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0)
        controlsRef.current.update()
      }
    }
  }, [resetTrigger, camera, width])

  // 4. Flythrough & Camera Animation
  useFrame((state, delta) => {
    if (mode === 'fly') {
      if (controlsRef.current) controlsRef.current.enabled = false
      flyProgress.current += delta * 0.2
      if (flyProgress.current > Math.PI * 2) flyProgress.current = 0
      
      const radius = Math.max(width, height) * 0.8
      camera.position.x = Math.sin(flyProgress.current) * radius
      camera.position.y = radius * 0.35
      camera.position.z = Math.cos(flyProgress.current) * radius
      camera.lookAt(0, 0, 0)
    } else if (mode === 'first_person') {
      // FlyControls handles movement
    } else if (mode === 'measure_height' || mode === 'measure_slope') {
      if (controlsRef.current) controlsRef.current.enabled = false
    } else {
      if (controlsRef.current) controlsRef.current.enabled = true
    }
  })

  // 5. Raycasting for Structure & Terrain Measurement
  const handlePointerDown = (e) => {
    if (mode !== 'measure_height' && mode !== 'measure_slope') return
    e.stopPropagation()
    
    const point = e.point.clone()
    
    if (points.length === 1) {
      const p1 = points[0]
      const p2 = point
      
      const dX = p2.x - p1.x
      const dY = p2.y - p1.y
      const dZ = p2.z - p1.z
      const dist2D = Math.sqrt(dX * dX + dZ * dZ)
      
      const zScale = 0.22 * width
      const actualRange = (rangeElev !== null && rangeElev !== undefined && rangeElev > 0) 
        ? rangeElev 
        : (Math.max(...heightData) - Math.min(...heightData) || 1.0)
      const realHeightDiff = (Math.abs(dY) / zScale) * actualRange
      const unit = dsmType === 'metric' ? 'm' : 'units'
      
      if (mode === 'measure_height') {
        setMeasurement({
          text: `Height Difference: ${realHeightDiff.toFixed(2)} ${unit}`,
          p1,
          p2
        })
      } else {
        const slope = Math.atan2(Math.abs(dY), dist2D) * (180 / Math.PI)
        setMeasurement({
          text: `Slope: ${slope.toFixed(1)}° (${realHeightDiff.toFixed(1)} ${unit} rise / ${dist2D.toFixed(1)} run)`,
          p1,
          p2
        })
      }
      setPoints([p1, p2])
      
      setTimeout(() => {
        setPoints([])
        setMeasurement(null)
      }, 6000)
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
        <FlyControls movementSpeed={width * 0.6} rollSpeed={0.5} dragToLook={true} />
      ) : (
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.05} />
      )}
      
      {/* Dynamic Lighting Rig for Rich Topographic Relief */}
      <ambientLight intensity={0.5} />
      <hemisphereLight intensity={0.4} groundColor="#0f172a" />
      <directionalLight position={[20, 40, 20]} intensity={1.4} castShadow />
      <directionalLight position={[-20, 30, -20]} intensity={0.5} />
      
      <mesh 
        ref={meshRef} 
        rotation={[-Math.PI / 2, 0, 0]} 
        onPointerDown={handlePointerDown}
      >
        <planeGeometry 
          ref={geometryRef} 
          args={[width, height, width - 1, height - 1]} 
        />
        {texture ? (
          <meshStandardMaterial 
            map={texture} 
            wireframe={wireframe} 
            roughness={0.7}
            metalness={0.05}
            side={THREE.DoubleSide} 
          />
        ) : (
          <meshStandardMaterial 
            color="#3b82f6" 
            wireframe={true} 
            side={THREE.DoubleSide} 
          />
        )}
      </mesh>

      {/* Interactive 3D Measurement Visuals */}
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y + 0.5, p.z]}>
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
          <lineBasicMaterial color="#fbbf24" linewidth={3} />
        </line>
      )}

      {measurement && points.length === 2 && (
        <Html position={[points[1].x, points[1].y + 4, points[1].z]} center distanceFactor={180}>
          <div className="measurement-3d-tag">
            <span className="tag-badge">📐 Measurement</span>
            <span className="tag-val">{measurement.text}</span>
          </div>
        </Html>
      )}
    </group>
  )
}
