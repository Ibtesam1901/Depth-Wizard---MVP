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
  rangeElev = null
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
      // Scale height relative to the terrain width for a decent visual aspect ratio
      const zScale = 0.2 * width 
      positions[i * 3 + 2] = ((h - minH) / range) * zScale
    }
    
    geometryRef.current.computeVertexNormals()
    geometryRef.current.attributes.position.needsUpdate = true
  }, [heightData, width, height])

  // 3. Flythrough Animation
  useFrame((state, delta) => {
    if (mode === 'fly') {
      if (controlsRef.current) controlsRef.current.enabled = false
      flyProgress.current += delta * 0.2
      if (flyProgress.current > Math.PI * 2) flyProgress.current = 0
      
      const radius = Math.max(width, height) * 0.8
      camera.position.x = Math.sin(flyProgress.current) * radius
      camera.position.y = radius * 0.3
      camera.position.z = Math.cos(flyProgress.current) * radius
      camera.lookAt(0, 0, 0)
    } else if (mode === 'first_person') {
      // FlyControls handles movement internally
    } else {
      if (controlsRef.current) controlsRef.current.enabled = true
    }
  })

  // 4. Raycasting for Measurement
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
      const dist2D = Math.sqrt(dX*dX + dZ*dZ) // XZ is the ground plane
      
      if (mode === 'measure_height') {
        const zScale = 0.2 * width
        const actualRange = rangeElev !== null && rangeElev !== undefined ? rangeElev : (Math.max(...heightData) - Math.min(...heightData) || 1.0)
        const realHeightDiff = (Math.abs(dY) / zScale) * actualRange
        const unit = dsmType === 'metric' ? 'm' : 'units'
        setMeasurement(`Height Diff: ${realHeightDiff.toFixed(2)} ${unit}`)
      } else {
        const slope = Math.atan2(Math.abs(dY), dist2D) * (180 / Math.PI)
        setMeasurement(`Slope: ${slope.toFixed(1)}°`)
      }
      setPoints([p1, p2])
      
      setTimeout(() => {
        setPoints([])
        setMeasurement(null)
      }, 4000)
    } else {
      setPoints([point])
      setMeasurement(null)
    }
  }

  return (
    <group>
      {mode === 'first_person' ? (
        <FlyControls movementSpeed={width * 0.5} rollSpeed={0.5} dragToLook={true} />
      ) : (
        <OrbitControls ref={controlsRef} />
      )}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} />
      
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
          <meshStandardMaterial map={texture} wireframe={false} side={THREE.DoubleSide} />
        ) : (
          <meshStandardMaterial color="#4CAF50" wireframe={true} side={THREE.DoubleSide} />
        )}
      </mesh>

      {/* Measurement Markers */}
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="red" />
        </mesh>
      ))}

      {measurement && points.length === 2 && (
        <Html position={[points[1].x, points[1].y, points[1].z]} center>
          <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '4px 8px', borderRadius: '4px', whiteSpace: 'nowrap', marginTop: '-20px' }}>
            {measurement}
          </div>
        </Html>
      )}
    </group>
  )
}
