import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  FACILITY_STATUS,
  FACILITY_TYPES,
} from '../economy/colonyState';

const METAL = '#8f4e31';
const DARK_METAL = '#4d2a20';
const CERAMIC = '#e6b38c';
const ACTIVE = '#ffd084';
const WATER = '#9cd7df';
const MINERAL = '#d9aa62';
const NUTRIENT = '#a9cf71';

const Material = ({ color = METAL, active = false, opacity = 1 }) => (
  <meshStandardMaterial
    color={color}
    roughness={0.52}
    metalness={0.42}
    emissive={active ? color : '#000000'}
    emissiveIntensity={active ? 0.65 : 0}
    transparent={opacity < 1}
    opacity={opacity}
  />
);

const ConstructionScaffold = ({ radius, progress }) => {
  const height = radius * 1.7;
  const posts = [
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];

  return (
    <group>
      {posts.map(([x, z]) => (
        <mesh
          key={`${x}-${z}`}
          position={[x * radius * 0.58, height * 0.5, z * radius * 0.58]}
        >
          <cylinderGeometry args={[radius * 0.035, radius * 0.035, height, 6]} />
          <Material color={CERAMIC} />
        </mesh>
      ))}
      {[0.28, 0.72].map((level) => (
        <mesh key={level} position={[0, height * level, 0]}>
          <torusGeometry args={[radius * 0.78, radius * 0.035, 6, 24]} />
          <Material color={CERAMIC} />
        </mesh>
      ))}
      <mesh
        position={[0, 0.007, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry
          args={[
            radius * 0.94,
            radius * (0.94 + Math.max(0.03, progress) * 0.12),
            28,
          ]}
        />
        <meshBasicMaterial
          color={ACTIVE}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

const Extractor = ({ radius, active, rotorRef }) => (
  <group>
    <mesh position={[0, radius * 0.34, 0]}>
      <cylinderGeometry args={[radius * 0.3, radius * 0.42, radius * 0.68, 10]} />
      <Material color={DARK_METAL} />
    </mesh>
    <mesh ref={rotorRef} position={[0, radius * 0.73, 0]}>
      <torusGeometry args={[radius * 0.3, radius * 0.07, 8, 24]} />
      <Material color={WATER} active={active} />
    </mesh>
    {[0, Math.PI / 2].map((rotation) => (
      <mesh
        key={rotation}
        position={[0, radius * 0.73, 0]}
        rotation={[0, rotation, 0]}
      >
        <boxGeometry args={[radius * 0.62, radius * 0.055, radius * 0.08]} />
        <Material color={CERAMIC} />
      </mesh>
    ))}
  </group>
);

const Sifter = ({ radius, active, rotorRef }) => (
  <group>
    <mesh position={[0, radius * 0.2, 0]}>
      <boxGeometry args={[radius * 0.86, radius * 0.32, radius * 0.68]} />
      <Material color={DARK_METAL} />
    </mesh>
    <mesh
      ref={rotorRef}
      position={[0, radius * 0.54, 0]}
      rotation={[0, 0, Math.PI / 2]}
    >
      <cylinderGeometry
        args={[radius * 0.27, radius * 0.27, radius * 0.72, 14, 1, true]}
      />
      <meshStandardMaterial
        color={MINERAL}
        roughness={0.6}
        metalness={0.45}
        emissive={active ? MINERAL : '#000000'}
        emissiveIntensity={active ? 0.35 : 0}
        wireframe
      />
    </mesh>
  </group>
);

const Solar = ({ radius, active }) => (
  <group>
    <mesh position={[0, radius * 0.24, 0]}>
      <cylinderGeometry args={[radius * 0.06, radius * 0.09, radius * 0.48, 8]} />
      <Material color={DARK_METAL} />
    </mesh>
    <group position={[0, radius * 0.48, 0]} rotation={[-0.45, 0.18, 0]}>
      <mesh>
        <boxGeometry args={[radius * 1.25, radius * 0.06, radius * 0.76]} />
        <Material color="#344b55" active={active} />
      </mesh>
      {[-0.31, 0, 0.31].map((x) => (
        <mesh key={x} position={[x * radius, radius * 0.035, 0]}>
          <boxGeometry args={[radius * 0.025, radius * 0.012, radius * 0.7]} />
          <Material color={CERAMIC} />
        </mesh>
      ))}
    </group>
  </group>
);

const Battery = ({ radius, active }) => (
  <group>
    {[-0.3, 0, 0.3].map((x, index) => (
      <mesh key={x} position={[x * radius, radius * 0.42, 0]}>
        <cylinderGeometry args={[radius * 0.17, radius * 0.2, radius * 0.8, 8]} />
        <Material
          color={index === 1 ? CERAMIC : METAL}
          active={active && index === 1}
        />
      </mesh>
    ))}
    <mesh position={[0, radius * 0.84, 0]}>
      <boxGeometry args={[radius * 0.92, radius * 0.08, radius * 0.34]} />
      <Material color={ACTIVE} active={active} />
    </mesh>
  </group>
);

const Nutrient = ({ radius, active, rotorRef }) => (
  <group>
    <mesh position={[0, radius * 0.38, 0]}>
      <cylinderGeometry args={[radius * 0.38, radius * 0.45, radius * 0.74, 12]} />
      <Material color={DARK_METAL} />
    </mesh>
    <mesh position={[0, radius * 0.48, 0]}>
      <cylinderGeometry args={[radius * 0.27, radius * 0.27, radius * 0.42, 12]} />
      <Material color={NUTRIENT} active={active} opacity={0.82} />
    </mesh>
    <mesh ref={rotorRef} position={[0, radius * 0.86, 0]}>
      <torusGeometry args={[radius * 0.28, radius * 0.055, 8, 24]} />
      <Material color={ACTIVE} active={active} />
    </mesh>
  </group>
);

const RootFeeder = ({ radius, active, pulseRef }) => (
  <group>
    <mesh position={[0, radius * 0.18, 0]}>
      <cylinderGeometry args={[radius * 0.42, radius * 0.5, radius * 0.32, 12]} />
      <Material color={DARK_METAL} />
    </mesh>
    {[0, Math.PI * 2 / 3, Math.PI * 4 / 3].map((angle) => (
      <mesh
        key={angle}
        position={[
          Math.cos(angle) * radius * 0.34,
          radius * 0.48,
          Math.sin(angle) * radius * 0.34,
        ]}
      >
        <cylinderGeometry args={[radius * 0.085, radius * 0.12, radius * 0.52, 8]} />
        <Material color={WATER} active={active} />
      </mesh>
    ))}
    <mesh ref={pulseRef} position={[0, radius * 0.68, 0]}>
      <sphereGeometry args={[radius * 0.13, 12, 10]} />
      <Material color={NUTRIENT} active={active} />
    </mesh>
  </group>
);

const Heater = ({ radius, active, pulseRef }) => (
  <group>
    <mesh position={[0, radius * 0.48, 0]}>
      <cylinderGeometry args={[radius * 0.18, radius * 0.3, radius * 0.92, 10]} />
      <Material color={DARK_METAL} />
    </mesh>
    {[0.24, 0.48, 0.72].map((y) => (
      <mesh key={y} position={[0, radius * y, 0]}>
        <torusGeometry args={[radius * 0.25, radius * 0.045, 6, 18]} />
        <Material color="#ff8b45" active={active} />
      </mesh>
    ))}
    <mesh ref={pulseRef} position={[0, radius, 0]}>
      <sphereGeometry args={[radius * 0.16, 12, 10]} />
      <Material color={ACTIVE} active={active} />
    </mesh>
  </group>
);

const Shield = ({ radius, active, rotorRef }) => (
  <group>
    <mesh position={[0, radius * 0.25, 0]}>
      <cylinderGeometry args={[radius * 0.3, radius * 0.4, radius * 0.48, 10]} />
      <Material color={DARK_METAL} />
    </mesh>
    <mesh ref={rotorRef} position={[0, radius * 0.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius * 0.42, radius * 0.055, 8, 28]} />
      <Material color={WATER} active={active} />
    </mesh>
    <mesh position={[0, radius * 0.65, 0]}>
      <sphereGeometry args={[radius * 0.12, 12, 10]} />
      <Material color={ACTIVE} active={active} />
    </mesh>
  </group>
);

const DamageBeacon = ({ radius }) => (
  <mesh position={[radius * 0.42, radius * 0.92, 0]}>
    <octahedronGeometry args={[radius * 0.09, 0]} />
    <meshBasicMaterial color="#8a180e" />
  </mesh>
);

const StatusHalo = ({ radius, active, building, damaged }) => {
  const ringRef = useRef();
  const color = damaged ? '#8a180e' : building ? ACTIVE : '#f2b27d';

  useFrame((state, delta) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z += delta * (active ? 0.32 : 0.08);
    ringRef.current.material.opacity = active
      ? 0.55 + Math.sin(state.clock.elapsedTime * 3.4) * 0.16
      : building ? 0.48 : 0.22;
  });

  return (
    <mesh
      ref={ringRef}
      position={[0, radius * 0.055, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[radius * 0.69, radius * 0.83, 32, 1, 0, Math.PI * 1.72]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.35}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
};

const FacilityModel = ({ facility, radius, facilitiesIdle }) => {
  const rotorRef = useRef();
  const pulseRef = useRef();
  const status = facility.status || FACILITY_STATUS.RUNNING;
  const active = !facilitiesIdle && status === FACILITY_STATUS.RUNNING;
  const building = status === FACILITY_STATUS.BUILDING;
  const damaged = facility.integrity < 65;

  useFrame((state, delta) => {
    if (rotorRef.current && active) {
      rotorRef.current.rotation.y += delta * 1.8;
      rotorRef.current.rotation.z += delta * 0.55;
    }
    if (pulseRef.current) {
      const pulse = active
        ? 1 + Math.sin(state.clock.elapsedTime * 4.2) * 0.18
        : 0.82;
      pulseRef.current.scale.setScalar(pulse);
    }
  });

  const modelProps = { radius, active, rotorRef, pulseRef };
  const models = {
    [FACILITY_TYPES.EXTRACTOR]: <Extractor {...modelProps} />,
    [FACILITY_TYPES.SIFTER]: <Sifter {...modelProps} />,
    [FACILITY_TYPES.SOLAR]: <Solar {...modelProps} />,
    [FACILITY_TYPES.BATTERY]: <Battery {...modelProps} />,
    [FACILITY_TYPES.NUTRIENT]: <Nutrient {...modelProps} />,
    [FACILITY_TYPES.ROOT_FEEDER]: <RootFeeder {...modelProps} />,
    [FACILITY_TYPES.HEATER]: <Heater {...modelProps} />,
    [FACILITY_TYPES.SHIELD]: <Shield {...modelProps} />,
  };

  return (
    <group>
      <StatusHalo
        radius={radius}
        active={active}
        building={building}
        damaged={damaged}
      />
      <group
        scale={building ? 0.68 : 1}
        rotation={[0, facility.type.length * 0.17, 0]}
      >
        {models[facility.type]}
      </group>
      {building && (
        <ConstructionScaffold
          radius={radius}
          progress={1 / Math.max(1, facility.buildRemaining)}
        />
      )}
      {damaged && <DamageBeacon radius={radius} />}
    </group>
  );
};

export default React.memo(FacilityModel);
