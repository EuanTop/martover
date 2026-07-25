import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import PotatoSpecimen from '../../Components/PotatoSpecimen/PotatoSpecimen';
import {
  BREEDING_STAGES,
  CRATER_ZONES,
  getCraterZoneOptions,
  INTERVENTION_TYPES,
} from '../simulation/breedingSimulation';
import { calculateCraterPosition } from './worldCoordinates';
import { useCursorStore } from '../../store';

const TERRAIN_RADIUS = 1.02;

const stableHash = (value) => {
  let hash = 2166136261;
  const text = String(value);

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const smoothStep = (value) => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};

const getCraterSeed = (crater) => stableHash(
  crater?.id || crater?.CRATER_ID || 'martover-crater'
);

const getTerrainHeight = (radius, angle, seed) => {
  const normalizedRadius = radius / TERRAIN_RADIUS;
  const phase = (seed % 997) / 997;
  const irregularity = (
    Math.sin(angle * 3 + phase * 11)
    + Math.sin(angle * 7 - phase * 5) * 0.45
    + Math.cos(angle * 11 + phase * 17) * 0.2
  );
  const rimNoise = irregularity * 0.018;

  if (normalizedRadius < 0.27) {
    return -0.235 + normalizedRadius * 0.045 + rimNoise * 0.16;
  }

  if (normalizedRadius < 0.7) {
    const slope = smoothStep((normalizedRadius - 0.27) / 0.43);
    return THREE.MathUtils.lerp(-0.223, 0.085, slope) + rimNoise * slope;
  }

  if (normalizedRadius < 0.84) {
    const rim = (normalizedRadius - 0.7) / 0.14;
    return 0.085 + Math.sin(rim * Math.PI) * 0.068 + rimNoise;
  }

  const apron = smoothStep((normalizedRadius - 0.84) / 0.16);
  return THREE.MathUtils.lerp(0.055 + rimNoise * 0.45, 0.004, apron);
};

const getTerrainColor = (normalizedRadius, height, layerCount) => {
  const floor = new THREE.Color('#6d2716');
  const slope = new THREE.Color('#ad4323');
  const rim = new THREE.Color('#e06a37');
  const apron = new THREE.Color('#9d3c21');
  let color;

  if (normalizedRadius < 0.3) {
    color = floor.clone().lerp(slope, normalizedRadius / 0.3 * 0.25);
  } else if (normalizedRadius < 0.72) {
    color = floor.clone().lerp(
      slope,
      smoothStep((normalizedRadius - 0.3) / 0.42)
    );
  } else if (normalizedRadius < 0.86) {
    color = slope.clone().lerp(
      rim,
      smoothStep((normalizedRadius - 0.72) / 0.14)
    );
  } else {
    color = rim.clone().lerp(
      apron,
      smoothStep((normalizedRadius - 0.86) / 0.14)
    );
  }

  const band = Math.sin(normalizedRadius * Math.PI * Math.max(2, layerCount) * 2);
  color.offsetHSL(0, 0, band * 0.025 + height * 0.035);
  return color;
};

const createCraterTerrainGeometry = (crater) => {
  const radialSegments = 30;
  const angularSegments = 96;
  const seed = getCraterSeed(crater);
  const layerCount = Number(crater?.layerNumber) || 1;
  const positions = [0, getTerrainHeight(0, 0, seed), 0];
  const colors = [];
  const indices = [];
  const centerColor = getTerrainColor(0, positions[1], layerCount);

  colors.push(centerColor.r, centerColor.g, centerColor.b);

  for (let ring = 1; ring <= radialSegments; ring += 1) {
    const normalizedRadius = ring / radialSegments;

    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = (segment / angularSegments) * Math.PI * 2;
      const phase = (seed % 1543) / 1543;
      const contourNoise = (
        Math.sin(angle * 5 + phase * 13)
        + Math.cos(angle * 9 - phase * 7) * 0.38
      ) * 0.018;
      const radius = TERRAIN_RADIUS
        * normalizedRadius
        * (1 + contourNoise * Math.sin(normalizedRadius * Math.PI));
      const height = getTerrainHeight(radius, angle, seed);
      const color = getTerrainColor(normalizedRadius, height, layerCount);

      positions.push(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let segment = 0; segment < angularSegments; segment += 1) {
    indices.push(
      0,
      1 + segment,
      1 + ((segment + 1) % angularSegments)
    );
  }

  for (let ring = 1; ring < radialSegments; ring += 1) {
    const currentStart = 1 + (ring - 1) * angularSegments;
    const nextStart = currentStart + angularSegments;

    for (let segment = 0; segment < angularSegments; segment += 1) {
      const nextSegment = (segment + 1) % angularSegments;
      const a = currentStart + segment;
      const b = currentStart + nextSegment;
      const c = nextStart + segment;
      const d = nextStart + nextSegment;

      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const zoneLayout = Object.freeze({
  [CRATER_ZONES.RIM]: {
    radius: 0.74,
    angle: 0.28,
    color: '#fff3e5',
  },
  [CRATER_ZONES.SHADOW]: {
    radius: 0.49,
    angle: 3.72,
    color: '#d75b32',
  },
  [CRATER_ZONES.FLOOR]: {
    radius: 0.14,
    angle: 5.1,
    color: '#7c2c18',
  },
});

const getZonePosition = (zone, seed) => {
  const layout = zoneLayout[zone];
  const x = Math.cos(layout.angle) * layout.radius;
  const z = Math.sin(layout.angle) * layout.radius;

  return [
    x,
    getTerrainHeight(layout.radius, layout.angle, seed) + 0.035,
    z,
  ];
};

const PlantingTarget = ({ option, seed, onPlantInZone }) => {
  const setCursorType = useCursorStore((state) => state.setType);
  const layout = zoneLayout[option.value];
  const position = getZonePosition(option.value, seed);
  const targetRef = useRef();

  useFrame((state) => {
    if (!targetRef.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.4) * 0.08;
    targetRef.current.scale.setScalar(pulse);
  });

  return (
    <group position={position}>
      <group
        ref={targetRef}
        onClick={(event) => {
          event.stopPropagation();
          onPlantInZone(option.value);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setCursorType('hover');
        }}
        onPointerOut={() => setCursorType('default')}
      >
        <mesh>
          <sphereGeometry args={[0.13, 18, 12]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.095, 0.009, 10, 48]} />
          <meshBasicMaterial color={layout.color} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.025, 16, 12]} />
          <meshStandardMaterial
            color={layout.color}
            emissive={layout.color}
            emissiveIntensity={0.22}
          />
        </mesh>
      </group>
      <Billboard
        position={[0, 0.16, 0]}
        follow
        lockZ={false}
        renderOrder={20}
      >
        <Text
          fontSize={0.068}
          color="#fff6ea"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#562913"
          depthOffset={-2}
        >
          {option.label}
        </Text>
        <Text
          position={[0, -0.075, 0]}
          fontSize={0.032}
          color="#f8c8ad"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.003}
          outlineColor="#562913"
          depthOffset={-2}
        >
          {option.hint}
        </Text>
      </Billboard>
    </group>
  );
};

const RootLines = ({ maturity, stress }) => {
  const rootColor = stress > 58 ? '#b74a2b' : '#f1d7c6';

  return (
    <group>
      {[0.2, 2.35, 4.45].map((angle, index) => {
        const length = 0.075 + maturity * (0.12 + index * 0.015);

        return (
          <Line
            key={angle}
            points={[
              [0, 0.008, 0],
              [
                Math.cos(angle + 0.2) * length * 0.55,
                0.002,
                Math.sin(angle + 0.2) * length * 0.55,
              ],
              [
                Math.cos(angle) * length,
                -0.006,
                Math.sin(angle) * length,
              ],
            ]}
            color={rootColor}
            transparent
            opacity={0.48 + maturity * 0.36}
            lineWidth={0.8}
          />
        );
      })}
    </group>
  );
};

const PotatoPlant = ({
  position,
  index,
  maturity,
  vigor,
  stress,
}) => {
  const plantRef = useRef();
  const stemHeight = 0.055 + maturity * 0.22;
  const leafCount = Math.max(1, Math.round(1 + maturity * 5));
  const wilt = THREE.MathUtils.clamp((stress - 48) / 50, 0, 0.75);
  const vitality = THREE.MathUtils.clamp(vigor / 100, 0.35, 1);
  const leafColor = stress > 62 ? '#d98963' : '#f4eadb';

  useFrame((state) => {
    if (!plantRef.current) return;
    plantRef.current.rotation.z = (
      Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.025
      + wilt * (index % 2 === 0 ? 0.12 : -0.12)
    );
  });

  return (
    <group ref={plantRef} position={position}>
      <RootLines maturity={maturity} stress={stress} />
      <mesh position={[0, stemHeight * 0.5, 0]}>
        <cylinderGeometry args={[0.009, 0.015, stemHeight, 10]} />
        <meshStandardMaterial
          color="#e7d3bf"
          roughness={0.82}
          emissive="#c95a31"
          emissiveIntensity={stress / 900}
        />
      </mesh>

      {Array.from({ length: leafCount }, (_, leafIndex) => {
        const side = leafIndex % 2 === 0 ? -1 : 1;
        const angle = leafIndex * 1.93 + index * 0.4;
        const y = stemHeight * (0.38 + leafIndex * 0.1);
        const leafScale = (0.55 + maturity * 0.6) * vitality;

        return (
          <mesh
            key={leafIndex}
            position={[
              Math.cos(angle) * 0.035 * leafScale,
              y,
              Math.sin(angle) * 0.035 * leafScale,
            ]}
            rotation={[
              0.2 + wilt * 0.75,
              -angle,
              side * (0.72 + wilt * 0.5),
            ]}
            scale={[
              0.052 * leafScale,
              0.015 * leafScale,
              0.025 * leafScale,
            ]}
          >
            <sphereGeometry args={[1, 16, 10]} />
            <meshStandardMaterial
              color={leafColor}
              roughness={0.74}
              emissive="#7b2c19"
              emissiveIntensity={stress > 70 ? 0.08 : 0}
            />
          </mesh>
        );
      })}

      {maturity > 0.55 && [0.5, 3].map((angle, tuberIndex) => {
        const size = 0.026 + maturity * 0.018;

        return (
          <PotatoSpecimen
            key={angle}
            position={[
              Math.cos(angle) * 0.055,
              -0.015 - tuberIndex * 0.004,
              Math.sin(angle) * 0.055,
            ]}
            rotation={[0.3, angle, 0.1]}
            scale={[size * 1.18, size, size * 0.9]}
            outlineScale={[
              size * 1.22,
              size * 1.04,
              size * 0.94,
            ]}
            color="#f7f0e4"
            opacity={0.92}
            outlineOpacity={0.72}
            distort={0.24}
            speed={0.7}
            metalness={0.18}
            roughness={0.54}
            geometryDetail={20}
          />
        );
      })}
    </group>
  );
};

const GrowthPatch = ({ simulation, seed }) => {
  const groupRef = useRef();
  const maturity = simulation.growth / 100;
  const count = Math.max(1, Math.ceil(maturity * 7));
  const zonePosition = getZonePosition(simulation.zone, seed);
  const positions = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => {
      const angle = index * 2.399;
      const radius = 0.035 + (index % 3) * 0.055;

      return [
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ];
    })
  ), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.035;
  });

  return (
    <group ref={groupRef} position={zonePosition}>
      {positions.slice(0, count).map((position, index) => (
        <PotatoPlant
          key={index}
          position={position}
          index={index}
          maturity={maturity}
          vigor={simulation.vigor}
          stress={simulation.stress}
        />
      ))}
    </group>
  );
};

const InterventionSignal = ({ simulation, seed }) => {
  const groupRef = useRef();
  const latestEvent = simulation.events.at(-1);
  const latestIntervention = simulation.interventions.at(-1);

  useFrame((state) => {
    if (!groupRef.current) return;
    const pulse = 0.92 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
    groupRef.current.scale.setScalar(pulse);
  });

  if (latestEvent?.kind !== 'intervention' || !latestIntervention) {
    return null;
  }

  const position = getZonePosition(simulation.zone, seed);
  const type = latestIntervention.type;
  const color = {
    [INTERVENTION_TYPES.WATER]: '#9ed9ee',
    [INTERVENTION_TYPES.HEAT]: '#fff0d4',
    [INTERVENTION_TYPES.SHIELD]: '#f2a888',
  }[type];

  return (
    <group ref={groupRef} position={position}>
      {type === INTERVENTION_TYPES.SHIELD ? (
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry
            args={[0.24, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.16}
            wireframe
          />
        </mesh>
      ) : (
        [0.11, 0.18, 0.25].map((radius, index) => (
          <mesh
            key={radius}
            position={[0, 0.018 + index * 0.015, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[radius, 0.005, 8, 48]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.7 - index * 0.16}
            />
          </mesh>
        ))
      )}
      <pointLight
        position={[0, 0.2, 0]}
        intensity={type === INTERVENTION_TYPES.HEAT ? 2.4 : 1}
        distance={0.8}
        color={color}
      />
    </group>
  );
};

const HarvestedTubers = ({
  assignments,
  selectedUse,
  onAssignTuber,
}) => {
  const setCursorType = useCursorStore((state) => state.setType);
  const assignmentColors = {
    seed: '#fff4d6',
    feed: '#ffffff',
    dissect: '#f08a61',
    preserve: '#b75232',
  };

  return (
    <group position={[0, -0.15, 0]}>
      {assignments.map((assignment, index) => {
        const angle = (index / assignments.length) * Math.PI * 2 + index * 0.31;
        const radius = 0.16 + (index % 3) * 0.115;
        const scale = [
          0.075 + (index % 2) * 0.014,
          0.055 + (index % 3) * 0.008,
          0.058 + ((index + 1) % 2) * 0.01,
        ];
        const assignmentColor = assignmentColors[assignment] || '#fffdf7';

        return (
          <group key={index}>
            {assignment && (
              <mesh
                position={[
                  Math.cos(angle) * radius,
                  0.006,
                  Math.sin(angle) * radius,
                ]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <torusGeometry args={[scale[0] * 1.25, 0.006, 8, 32]} />
                <meshBasicMaterial color={assignmentColor} />
              </mesh>
            )}
            <PotatoSpecimen
              position={[
                Math.cos(angle) * radius,
                0.075 + (index % 3) * 0.018,
                Math.sin(angle) * radius,
              ]}
              rotation={[
                index * 0.23,
                index * 0.61,
                index * 0.17,
              ]}
              scale={scale}
              outlineScale={scale.map((value) => value * 1.045)}
              color="#fffdf7"
              emissive={assignmentColor}
              emissiveIntensity={assignment ? 0.16 : 0}
              opacity={0.94}
              outlineOpacity={0.94}
              distort={0.3}
              speed={0.9 + (index % 4) * 0.08}
              metalness={0.35}
              roughness={0.26}
              geometryDetail={28}
              onClick={(event) => {
                event.stopPropagation();
                onAssignTuber(index, selectedUse);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                setCursorType('hover');
              }}
              onPointerOut={() => setCursorType('default')}
            />
          </group>
        );
      })}
    </group>
  );
};

const CraterCultivationScene = ({
  crater,
  simulation,
  selectedUse,
  onPlantInZone,
  onAssignTuber,
}) => {
  const position = useMemo(() => (
    new THREE.Vector3(...calculateCraterPosition(
      crater.latitude,
      crater.longitude,
      1.006
    ))
  ), [crater.latitude, crater.longitude]);
  const quaternion = useMemo(() => (
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      position.clone().normalize()
    )
  ), [position]);
  const terrainGeometry = useMemo(
    () => createCraterTerrainGeometry(crater),
    [crater]
  );
  const seed = useMemo(() => getCraterSeed(crater), [crater]);
  const options = getCraterZoneOptions();
  const isPlanting = simulation.stage === BREEDING_STAGES.PLANTING;
  const isGrowing = simulation.stage === BREEDING_STAGES.GROWING;
  const isAllocation = simulation.stage === BREEDING_STAGES.ALLOCATION;

  return (
    <group
      position={position}
      quaternion={quaternion}
      scale={0.42}
    >
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.96}
          metalness={0.015}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      <mesh position={[0, -0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.96, 1.16, 96]} />
        <meshStandardMaterial
          color="#9d3c21"
          transparent
          opacity={0.46}
          roughness={1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {isPlanting && options.map((option) => (
        <PlantingTarget
          key={option.value}
          option={option}
          seed={seed}
          onPlantInZone={onPlantInZone}
        />
      ))}

      {isGrowing && (
        <>
          <GrowthPatch simulation={simulation} seed={seed} />
          <InterventionSignal simulation={simulation} seed={seed} />
        </>
      )}

      {isAllocation && (
        <HarvestedTubers
          assignments={simulation.tuberAssignments}
          selectedUse={selectedUse}
          onAssignTuber={onAssignTuber}
        />
      )}

      <pointLight
        position={[0.28, 0.72, 0.2]}
        intensity={1.8}
        distance={2.5}
        color="#ffcfad"
      />
    </group>
  );
};

export default CraterCultivationScene;
