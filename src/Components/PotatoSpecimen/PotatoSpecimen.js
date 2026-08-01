import React from 'react';
import { MeshDistortMaterial } from '@react-three/drei';
import { a } from '@react-spring/three';
import * as THREE from 'three';

const AnimatedDistortMaterial = a(MeshDistortMaterial);

const PotatoSpecimen = ({
  animated = false,
  meshRef,
  outlineRef,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  outlineScale,
  color = '#ffffff',
  outlineColor = '#000000',
  opacity = 0.92,
  outlineOpacity = 1,
  distort = 0.4,
  speed = 1,
  metalness = 0.5,
  roughness = 0.18,
  clearcoat = 1,
  clearcoatRoughness = 0,
  map,
  emissive = '#000000',
  emissiveIntensity = 0,
  geometryDetail = 40,
  onClick,
  onPointerOver,
  onPointerOut,
}) => {
  const MeshComponent = animated ? a.mesh : 'mesh';
  const MaterialComponent = animated
    ? AnimatedDistortMaterial
    : MeshDistortMaterial;

  return (
    <group position={position} rotation={rotation}>
      <MeshComponent
        ref={outlineRef}
        scale={outlineScale ?? scale}
      >
        <sphereGeometry args={[1, geometryDetail, geometryDetail]} />
        <MeshDistortMaterial
          color={outlineColor}
          side={THREE.BackSide}
          distort={distort}
          speed={speed}
          transparent={outlineOpacity < 1}
          opacity={outlineOpacity}
        />
      </MeshComponent>

      <MeshComponent
        ref={meshRef}
        scale={scale}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <sphereGeometry args={[1, geometryDetail, geometryDetail]} />
        <MaterialComponent
          color={color}
          map={map}
          transparent={opacity < 1}
          opacity={opacity}
          distort={distort}
          speed={speed}
          metalness={metalness}
          roughness={roughness}
          clearcoat={clearcoat}
          clearcoatRoughness={clearcoatRoughness}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </MeshComponent>
    </group>
  );
};

export default PotatoSpecimen;
