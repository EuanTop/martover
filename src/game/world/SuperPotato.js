import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import PotatoSpecimen from '../../Components/PotatoSpecimen/PotatoSpecimen';
import { TERRAIN_RADIUS } from './terrainBands';

// The single tuber is the visual heart of the crater. It grows continuously
// from a buried pearl into the large liquid specimen used by the original app.
const MATURE_RADIUS = TERRAIN_RADIUS * 0.24;
const MIN_RADIUS = MATURE_RADIUS * 0.14;

export const PLANT_LABEL_HEIGHT = MATURE_RADIUS * 2.7;

const smoothGrowth = (growth) => {
  const normalized = THREE.MathUtils.clamp(growth / 100, 0, 1);
  return THREE.MathUtils.smootherstep(normalized, 0, 1);
};

const RootInterface = ({ radius, activity }) => {
  const scanRef = useRef();
  const pulseRef = useRef();

  useFrame((state, delta) => {
    if (scanRef.current) {
      scanRef.current.rotation.z -= delta * (0.18 + activity * 0.42);
      scanRef.current.material.opacity = 0.16
        + activity * 0.22
        + Math.sin(state.clock.elapsedTime * 2.2) * 0.05;
    }
    if (pulseRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.4) * 0.08;
      pulseRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      <mesh position={[0, 0.007, 0]} receiveShadow>
        <cylinderGeometry args={[radius * 0.82, radius, radius * 0.12, 40]} />
        <meshStandardMaterial
          color="#5f3124"
          roughness={0.72}
          metalness={0.3}
        />
      </mesh>
      <mesh
        ref={scanRef}
        position={[0, radius * 0.09, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[radius * 0.72, radius * 1.08, 48, 1, 0, Math.PI * 1.72]} />
        <meshBasicMaterial
          color="#ffd7ad"
          transparent
          opacity={0.3}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={pulseRef}
        position={[0, radius * 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[radius * 0.34, radius * 0.4, 36]} />
        <meshBasicMaterial
          color="#fff0d7"
          transparent
          opacity={0.62}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

const SuperPotato = ({ growth = 0, quality = 0.5, seed = 1 }) => {
  const groupRef = useRef();
  const specimenRef = useRef();
  const outlineRef = useRef();
  const growthRef = useRef(smoothGrowth(growth));
  const targetGrowth = smoothGrowth(growth);

  const phase = useMemo(() => (seed % 997) / 997 * Math.PI * 2, [seed]);
  const healthy = THREE.MathUtils.clamp(quality, 0, 1);
  const bodyColor = useMemo(() => {
    const stressed = new THREE.Color('#b66c49');
    const thriving = new THREE.Color('#f4b388');
    return `#${stressed.lerp(thriving, healthy).getHexString()}`;
  }, [healthy]);

  useFrame((state, delta) => {
    growthRef.current = THREE.MathUtils.damp(
      growthRef.current,
      targetGrowth,
      1.8,
      delta
    );

    if (!groupRef.current) return;

    const current = growthRef.current;
    const radius = THREE.MathUtils.lerp(MIN_RADIUS, MATURE_RADIUS, current);
    const breath = 1 + Math.sin(state.clock.elapsedTime * 1.35 + phase) * 0.025;
    groupRef.current.scale.set(
      radius * 1.2 * breath,
      radius * (0.88 + current * 0.12) * breath,
      radius * (1.02 + Math.sin(phase) * 0.04) * breath
    );
    groupRef.current.position.y = radius * (0.7 + current * 0.05);
    groupRef.current.rotation.y += delta * (0.035 + current * 0.045);

    if (specimenRef.current) {
      specimenRef.current.rotation.z = Math.sin(
        state.clock.elapsedTime * 0.42 + phase
      ) * 0.08;
    }
    if (outlineRef.current) {
      outlineRef.current.scale.setScalar(
        1.045 + Math.sin(state.clock.elapsedTime * 2.1) * 0.008
      );
    }
  });

  return (
    <group>
      <RootInterface radius={MATURE_RADIUS * 0.82} activity={targetGrowth} />
      <group ref={groupRef}>
        <PotatoSpecimen
          meshRef={specimenRef}
          outlineRef={outlineRef}
          scale={1}
          outlineScale={1.045}
          color={bodyColor}
          outlineColor="#5a241c"
          opacity={0.94}
          outlineOpacity={0.82}
          distort={0.34 + targetGrowth * 0.18}
          speed={0.8 + targetGrowth * 0.75}
          metalness={0.28}
          roughness={0.16}
          clearcoat={1}
          clearcoatRoughness={0.08}
          emissive={healthy > 0.58 ? '#7b2e1d' : '#3d170f'}
          emissiveIntensity={0.12 + healthy * 0.13}
          geometryDetail={48}
        />
        <mesh position={[0.34, 0.2, 0.76]} scale={[0.075, 0.035, 0.028]}>
          <sphereGeometry args={[1, 18, 12]} />
          <meshBasicMaterial
            color="#fff1df"
            transparent
            opacity={0.72}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
};

export default React.memo(SuperPotato);
