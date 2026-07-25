import React, { useEffect, useMemo, useRef } from 'react';
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
import { getCraterDisplayScale } from './craterVisualModel';
import { calculateCraterPosition } from './worldCoordinates';
import { useCursorStore } from '../../store';

const TERRAIN_RADIUS = 0.92;

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

const seededUnit = (seed, index) => (
  stableHash(`${seed}:${index}`) / 4294967295
);

const getTerrainHeight = (normalizedRadius, x, z, seed) => {
  const phase = (seed % 997) / 997;
  const angularNoise = (
    Math.sin(Math.atan2(z, x) * 3 + phase * 17) * 0.48
    + Math.sin(Math.atan2(z, x) * 7 - phase * 9) * 0.3
    + Math.cos(Math.atan2(z, x) * 13 + phase * 23) * 0.22
  );
  const surfaceNoise = (
    Math.sin(x * 10.5 + phase * 13)
    + Math.cos(z * 8.5 - phase * 11) * 0.65
    + Math.sin((x + z) * 17 + phase * 5) * 0.25
  ) * 0.0018;

  if (normalizedRadius < 0.34) {
    return -0.14 + surfaceNoise * 0.35;
  }

  if (normalizedRadius < 0.72) {
    const slope = smoothStep((normalizedRadius - 0.34) / 0.38);
    const erosion = Math.max(0, Math.sin(x * 25 + z * 13 + phase * 31))
      * Math.sin(slope * Math.PI)
      * 0.0045;

    return THREE.MathUtils.lerp(-0.128, 0.046, slope)
      + surfaceNoise
      - erosion;
  }

  if (normalizedRadius < 0.86) {
    const rim = (normalizedRadius - 0.72) / 0.14;
    const brokenRim = 0.01 + angularNoise * 0.012;

    return 0.044
      + Math.sin(rim * Math.PI) * (0.026 + brokenRim)
      + surfaceNoise;
  }

  const apron = smoothStep((normalizedRadius - 0.86) / 0.14);
  return THREE.MathUtils.lerp(
    0.032 + angularNoise * 0.004 + surfaceNoise,
    0.002,
    apron
  );
};

const getTerrainColor = (
  normalizedRadius,
  height,
  x,
  z,
  seed,
  layerCount
) => {
  const floor = new THREE.Color('#3a2725');
  const slope = new THREE.Color('#56352c');
  const rim = new THREE.Color('#744638');
  const apron = new THREE.Color('#634034');
  let color;

  if (normalizedRadius < 0.34) {
    color = floor.clone().lerp(slope, normalizedRadius * 0.22);
  } else if (normalizedRadius < 0.72) {
    color = floor.clone().lerp(
      slope,
      smoothStep((normalizedRadius - 0.34) / 0.38)
    );
  } else if (normalizedRadius < 0.86) {
    color = slope.clone().lerp(
      rim,
      smoothStep((normalizedRadius - 0.72) / 0.1)
    );
  } else {
    color = rim.clone().lerp(
      apron,
      smoothStep((normalizedRadius - 0.86) / 0.14)
    );
  }

  const phase = (seed % 1327) / 1327;
  const strata = Math.sin(
    x * 6.5
    + z * 4.1
    + phase * 8
  );
  const rockNoise = (
    Math.sin(x * 19 + z * 11 + phase * 12)
    + Math.cos(x * 7 - z * 15 - phase * 7) * 0.5
  );
  color.offsetHSL(
    rockNoise * 0.002,
    -0.012 + rockNoise * 0.004,
    strata * 0.008 + rockNoise * 0.006 + height * 0.04
  );
  return color;
};

const createCraterTerrainGeometry = (crater) => {
  const radialSegments = 34;
  const angularSegments = 96;
  const seed = getCraterSeed(crater);
  const layerCount = Number(crater?.layerNumber) || 1;
  const centerHeight = getTerrainHeight(0, 0, 0, seed);
  const positions = [0, centerHeight, 0];
  const colors = [];
  const uvs = [0.5, 0.5];
  const indices = [];
  const centerColor = getTerrainColor(
    0,
    positions[1],
    0,
    0,
    seed,
    layerCount
  );

  colors.push(centerColor.r, centerColor.g, centerColor.b);

  for (let ring = 1; ring <= radialSegments; ring += 1) {
    const normalizedRadius = ring / radialSegments;

    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = (segment / angularSegments) * Math.PI * 2;
      const phase = (seed % 1543) / 1543;
      const contourNoise = (
        Math.sin(angle * 3 + phase * 13) * 0.54
        + Math.cos(angle * 7 - phase * 7) * 0.3
        + Math.sin(angle * 11 + phase * 19) * 0.16
      ) * 0.055;
      const ellipticity = 1 + Math.cos(angle * 2 + phase * 4) * 0.035;
      const radius = TERRAIN_RADIUS
        * normalizedRadius
        * ellipticity
        * (1 + contourNoise * smoothStep(normalizedRadius));
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const height = getTerrainHeight(normalizedRadius, x, z, seed);
      const color = getTerrainColor(
        normalizedRadius,
        height,
        x,
        z,
        seed,
        layerCount
      );

      positions.push(
        x,
        height,
        z
      );
      colors.push(color.r, color.g, color.b);
      uvs.push(
        0.5 + Math.cos(angle) * normalizedRadius * 0.5,
        0.5 + Math.sin(angle) * normalizedRadius * 0.5
      );
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
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(uvs, 2)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const createBlendTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 62, 128, 128, 128);

  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.65, '#ffffff');
  gradient.addColorStop(0.8, '#d2d2d2');
  gradient.addColorStop(0.91, '#5f5f5f');
  gradient.addColorStop(1, '#000000');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const CraterDebris = ({ seed }) => {
  const meshRef = useRef();
  const rocks = useMemo(() => (
    Array.from({ length: 30 }, (_, index) => {
      const angle = seededUnit(seed, index * 4) * Math.PI * 2;
      const radius = 0.7 + seededUnit(seed, index * 4 + 1) * 0.3;
      const size = 0.012 + seededUnit(seed, index * 4 + 2) * 0.026;

      return {
        angle,
        radius,
        size,
        stretch: 0.65 + seededUnit(seed, index * 4 + 3) * 0.9,
      };
    })
  ), [seed]);

  useEffect(() => {
    if (!meshRef.current) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();

    rocks.forEach((rock, index) => {
      position.set(
        Math.cos(rock.angle) * rock.radius,
        getTerrainHeight(
          rock.radius,
          Math.cos(rock.angle) * rock.radius,
          Math.sin(rock.angle) * rock.radius,
          seed
        ) + rock.size * 0.35,
        Math.sin(rock.angle) * rock.radius
      );
      rotation.set(
        seededUnit(seed, index + 91) * 0.8,
        rock.angle,
        seededUnit(seed, index + 137) * 0.7
      );
      quaternion.setFromEuler(rotation);
      scale.set(
        rock.size * rock.stretch,
        rock.size * 0.62,
        rock.size
      );
      matrix.compose(position, quaternion, scale);
      meshRef.current.setMatrixAt(index, matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [rocks, seed]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, rocks.length]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#5a382e"
        roughness={1}
        metalness={0}
      />
    </instancedMesh>
  );
};

const zoneLayout = Object.freeze({
  [CRATER_ZONES.RIM]: {
    radius: 0.76,
    angle: 0.28,
    color: '#fff3e5',
  },
  [CRATER_ZONES.SHADOW]: {
    radius: 0.52,
    angle: 3.72,
    color: '#d75b32',
  },
  [CRATER_ZONES.FLOOR]: {
    radius: 0.18,
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
    getTerrainHeight(
      layout.radius,
      x,
      z,
      seed
    ) + 0.025,
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

const TuberCluster = ({ growth, stress, index }) => {
  const clusterRef = useRef();
  const tuberGrowth = THREE.MathUtils.clamp((growth - 0.48) * 2.2, 0, 1);
  const tuberRefs = useRef([]);
  const tuberColor = stress > 68 ? '#9a4f35' : '#bd7b43';

  useFrame((state) => {
    if (!clusterRef.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.7 + index * 0.8) * 0.035;
    clusterRef.current.rotation.y = state.clock.elapsedTime * 0.16 + index * 0.4;
    clusterRef.current.scale.setScalar(0.82 + tuberGrowth * 0.18 * pulse);

    tuberRefs.current.forEach((tuber, tuberIndex) => {
      if (!tuber) return;
      const phase = state.clock.elapsedTime * (0.9 + tuberIndex * 0.16)
        + index * 0.7
        + tuberIndex;
      tuber.rotation.y = Math.sin(phase) * 0.18;
      tuber.position.y = -0.014 - tuberIndex * 0.005 + Math.sin(phase) * 0.004;
      tuber.scale.setScalar(
        0.92 + tuberGrowth * 0.08 + Math.sin(phase * 1.2) * 0.025
      );
    });
  });

  if (growth <= 0.48) return null;

  return (
    <group ref={clusterRef} scale={0.82 + tuberGrowth * 0.18}>
      {[0.55, 3.35].map((angle, tuberIndex) => {
        const size = (0.018 + growth * 0.014) * (0.72 + tuberGrowth * 0.28);

        return (
          <group
            key={angle}
            ref={(node) => {
              tuberRefs.current[tuberIndex] = node;
            }}
            position={[
              Math.cos(angle) * (0.062 + tuberIndex * 0.012),
              -0.014 - tuberIndex * 0.005,
              Math.sin(angle) * (0.062 + tuberIndex * 0.012),
            ]}
          >
            <PotatoSpecimen
              rotation={[0.3, angle, 0.1]}
              scale={[size * 1.22, size, size * 0.92]}
              outlineScale={[
                size * 1.3,
                size * 1.04,
                size * 0.96,
              ]}
              color={tuberColor}
              outlineColor="#5d2a1d"
              opacity={0.96}
              outlineOpacity={0.82}
              distort={0.16}
              speed={0.7 + index * 0.015}
              metalness={0.08}
              roughness={0.66}
              geometryDetail={28}
            />
          </group>
        );
      })}
    </group>
  );
};

const EmergencePulse = ({ growth, index }) => {
  const pulseRef = useRef();
  const materialRef = useRef();

  useFrame((state) => {
    if (!pulseRef.current || !materialRef.current) return;
    const active = THREE.MathUtils.clamp(1 - Math.abs(growth - 0.22) * 4, 0, 1);
    const pulse = 0.75 + Math.sin(state.clock.elapsedTime * 3.2 + index) * 0.12;

    pulseRef.current.scale.setScalar((0.7 + growth * 1.9) * pulse);
    materialRef.current.opacity = active * 0.34;
  });

  return (
    <mesh ref={pulseRef} position={[0, 0.008, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.045, 0.052, 32]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#f4b087"
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
};

const PotatoPlant = ({
  basePosition,
  index,
  growth,
  vigor,
  stress,
  variant = 1,
}) => {
  const plantRef = useRef();
  const leafRefs = useRef([]);
  const stemHeight = (0.055 + growth * 0.19) * variant;
  const leafCount = 4;
  const wilt = THREE.MathUtils.clamp((stress - 48) / 50, 0, 0.75);
  const vitality = THREE.MathUtils.clamp(vigor / 100, 0.35, 1);
  const leafColor = stress > 62 ? '#8f4938' : '#536a48';
  const stemColor = stress > 70 ? '#7e4032' : '#617653';

  useFrame((state, delta) => {
    if (!plantRef.current) return;
    const targetScale = Math.max(0.001, growth * variant * 1.28);
    const currentScale = plantRef.current.scale.x;
    const nextScale = THREE.MathUtils.damp(
      currentScale,
      targetScale,
      5.5,
      delta
    );
    const sway = Math.sin(
      state.clock.elapsedTime * (0.72 + index * 0.035) + index * 1.7
    );

    plantRef.current.scale.setScalar(nextScale);
    plantRef.current.position.y = basePosition[1] - (1 - nextScale) * 0.045;
    plantRef.current.rotation.x = sway * 0.022 * vitality;
    plantRef.current.rotation.z = (
      sway * 0.035
      + wilt * (index % 2 === 0 ? 0.12 : -0.12)
    );

    leafRefs.current.forEach((leaf, leafIndex) => {
      if (!leaf) return;
      const leafPhase = state.clock.elapsedTime * (0.82 + leafIndex * 0.07)
        + index * 0.9
        + leafIndex * 1.4;
      leaf.rotation.y = Math.sin(leafPhase) * 0.12;
      leaf.rotation.x = 0.35 + Math.sin(leafPhase * 0.8) * 0.05;
    });
  });

  return (
    <group ref={plantRef} position={basePosition} scale={0.001}>
      <EmergencePulse growth={growth} index={index} />
      <RootLines maturity={growth} stress={stress} />
      <mesh position={[0, stemHeight * 0.5, 0]}>
        <cylinderGeometry args={[0.008, 0.014, stemHeight, 9]} />
        <meshStandardMaterial
          color={stemColor}
          roughness={0.9}
          emissive="#d27650"
          emissiveIntensity={0.035 + stress / 1400}
        />
      </mesh>

      {Array.from({ length: leafCount }, (_, leafIndex) => {
        const side = leafIndex % 2 === 0 ? -1 : 1;
        const angle = leafIndex * 1.93 + index * 0.4;
        const y = stemHeight * (0.33 + leafIndex * 0.105);
        const unfurl = THREE.MathUtils.clamp(
          growth * 1.9 - leafIndex * 0.14,
          0.08,
          1
        );
        const leafScale = (0.42 + growth * 0.48) * vitality * unfurl;

        return (
          <mesh
            key={leafIndex}
            ref={(node) => {
              leafRefs.current[leafIndex] = node;
            }}
            position={[
              Math.cos(angle) * 0.042 * leafScale,
              y,
              Math.sin(angle) * 0.042 * leafScale,
            ]}
            rotation={[
              0.35 + (1 - unfurl) * 0.85 + wilt * 0.75,
              -angle,
              side * (0.74 + wilt * 0.5),
            ]}
            scale={[
              0.062 * leafScale,
              0.011 * leafScale,
              0.026 * leafScale,
            ]}
          >
            <sphereGeometry args={[1, 16, 10]} />
            <meshStandardMaterial
              color={leafColor}
              roughness={0.88}
              emissive="#8f3d2a"
              emissiveIntensity={stress > 70 ? 0.07 : 0.015}
            />
          </mesh>
        );
      })}

      <TuberCluster growth={growth} stress={stress} index={index} />
    </group>
  );
};

const getGrowthPositions = (zone, seed) => (
  Array.from({ length: 6 }, (_, index) => {
    const randomAngle = seededUnit(seed, index * 5);
    const randomRadius = seededUnit(seed, index * 5 + 1);
    const tangentJitter = seededUnit(seed, index * 5 + 2) - 0.5;
    let angle;
    let radius;

    const goldenAngle = 2.399963;

    if (zone === CRATER_ZONES.RIM) {
      angle = zoneLayout[zone].angle + index * goldenAngle
        + (randomAngle - 0.5) * 0.22;
      radius = 0.68 + randomRadius * 0.2;
    } else if (zone === CRATER_ZONES.SHADOW) {
      angle = zoneLayout[zone].angle + index * goldenAngle
        + (randomAngle - 0.5) * 0.28;
      radius = 0.39 + randomRadius * 0.25;
    } else {
      angle = index * goldenAngle + (randomAngle - 0.5) * 0.24;
      radius = 0.22 + Math.sqrt(randomRadius) * 0.46;
    }

    angle += tangentJitter * 0.08;

    return {
      position: [
        Math.cos(angle) * radius,
        getTerrainHeight(
          radius,
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          seed
        ) + 0.018,
        Math.sin(angle) * radius,
      ],
      variant: 0.88 + seededUnit(seed, index * 5 + 4) * 0.22,
      emergenceDelay: index * 0.07 + seededUnit(seed, index * 5 + 3) * 0.11,
    };
  })
);

const GrowthPatch = ({ simulation, seed }) => {
  const maturity = simulation.growth / 100;
  const plants = useMemo(
    () => getGrowthPositions(simulation.zone, seed),
    [seed, simulation.zone]
  );

  return (
    <group>
      {plants.map((plant, index) => {
        const growth = THREE.MathUtils.clamp(
          (maturity - plant.emergenceDelay) / (1 - plant.emergenceDelay),
          0,
          1
        );

        return (
          <PotatoPlant
            key={index}
            basePosition={plant.position}
            index={index}
            growth={growth}
            vigor={simulation.vigor}
            stress={simulation.stress}
            variant={plant.variant}
          />
        );
      })}
    </group>
  );
};

const INTERVENTION_COLORS = Object.freeze({
  [INTERVENTION_TYPES.WATER]: '#8ed7ef',
  [INTERVENTION_TYPES.HEAT]: '#ff9b5a',
  [INTERVENTION_TYPES.SHIELD]: '#f7d6c4',
});

const InterventionPreview = ({ type }) => {
  const ringRefs = useRef([]);
  const dropRefs = useRef([]);
  const domeRef = useRef();

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    ringRefs.current.forEach((ring, index) => {
      if (!ring) return;
      const phase = (time * 0.52 + index * 0.2) % 1;
      ring.scale.setScalar(0.78 + phase * 0.3);
      ring.material.opacity = 0.22 + (1 - phase) * 0.24;
    });

    dropRefs.current.forEach((drop, index) => {
      if (!drop) return;
      const phase = (time * 0.7 + index * 0.18) % 1;
      drop.position.y = 0.18 - phase * 0.16;
      drop.material.opacity = 0.36 + (1 - phase) * 0.34;
    });

    if (domeRef.current) {
      domeRef.current.rotation.y = time * 0.25;
      domeRef.current.material.opacity = 0.08
        + Math.sin(time * 2.1) * 0.018;
    }
  });

  if (type === INTERVENTION_TYPES.WATER) {
    return (
      <group scale={0.82}>
        <mesh position={[0, 0.018, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.27, 48]} />
          <meshBasicMaterial
            color="#8ed7ef"
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
        {Array.from({ length: 5 }, (_, index) => {
          const angle = (index / 5) * Math.PI * 2;
          const radius = 0.08 + (index % 2) * 0.07;

          return (
            <mesh
              key={index}
              ref={(node) => {
                dropRefs.current[index] = node;
              }}
              position={[
                Math.cos(angle) * radius,
                0.18,
                Math.sin(angle) * radius,
              ]}
              rotation={[0, 0, Math.PI]}
            >
              <coneGeometry args={[0.015, 0.045, 10]} />
              <meshBasicMaterial
                color="#b4ecff"
                transparent
                opacity={0.6}
                depthWrite={false}
              />
            </mesh>
          );
        })}
        <mesh
          ref={(node) => {
            ringRefs.current[0] = node;
          }}
          position={[0, 0.024, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.12, 0.128, 48]} />
          <meshBasicMaterial
            color="#b4ecff"
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  if (type === INTERVENTION_TYPES.HEAT) {
    return (
      <group scale={0.82}>
        {[0.13, 0.23].map((radius, index) => (
          <mesh
            key={radius}
            ref={(node) => {
              ringRefs.current[index] = node;
            }}
            position={[0, 0.026, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[radius, 0.008, 8, 48]} />
            <meshBasicMaterial
              color="#ffb176"
              transparent
              opacity={0.46}
              depthWrite={false}
            />
          </mesh>
        ))}
        {Array.from({ length: 6 }, (_, index) => {
          const angle = (index / 6) * Math.PI * 2;

          return (
            <mesh
              key={index}
              position={[
                Math.cos(angle) * 0.25,
                0.04,
                Math.sin(angle) * 0.25,
              ]}
            >
              <cylinderGeometry args={[0.012, 0.017, 0.052, 8]} />
              <meshBasicMaterial
                color="#ff9b5a"
                transparent
                opacity={0.82}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (type === INTERVENTION_TYPES.SHIELD) {
    return (
      <group scale={0.82}>
        <mesh ref={domeRef} position={[0, 0.018, 0]}>
          <sphereGeometry
            args={[0.31, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshBasicMaterial
            color="#f7d6c4"
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.018, 0]}>
          <sphereGeometry
            args={[0.316, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshBasicMaterial
            color="#fff0e4"
            transparent
            opacity={0.34}
            wireframe
            depthWrite={false}
          />
        </mesh>
        <mesh
          position={[0, 0.02, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.31, 0.007, 8, 48]} />
          <meshBasicMaterial
            color="#f7d6c4"
            transparent
            opacity={0.72}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  return null;
};

const InterventionTarget = ({
  zone,
  seed,
  selectedIntervention,
  onApplyIntervention,
}) => {
  const markerRef = useRef();
  const scannerRef = useRef();
  const setCursorType = useCursorStore((state) => state.setType);
  const position = getZonePosition(zone, seed);
  const selectedColor = selectedIntervention
    ? INTERVENTION_COLORS[selectedIntervention]
    : '#fff0df';

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (markerRef.current) {
      markerRef.current.rotation.y = time * 0.16;
    }

    if (scannerRef.current) {
      const pulse = 0.92 + Math.sin(time * 1.8) * 0.08;
      scannerRef.current.scale.setScalar(pulse);
      scannerRef.current.material.opacity = selectedIntervention
        ? 0.5 + pulse * 0.16
        : 0.3 + pulse * 0.12;
    }
  });

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        if (selectedIntervention) {
          onApplyIntervention(selectedIntervention);
        }
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (selectedIntervention) setCursorType('hover');
      }}
      onPointerOut={() => setCursorType('default')}
    >
      <mesh position={[0, 0.03, 0]}>
        <sphereGeometry args={[0.34, 24, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={scannerRef}
        position={[0, 0.018, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.285, 0.298, 64]} />
        <meshBasicMaterial
          color={selectedColor}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <group ref={markerRef}>
        {Array.from({ length: 4 }, (_, index) => {
          const angle = index * Math.PI / 2 + Math.PI / 4;

          return (
            <mesh
              key={index}
              position={[
                Math.cos(angle) * 0.31,
                0.025,
                Math.sin(angle) * 0.31,
              ]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[0.045, 0.012, 0.012]} />
              <meshBasicMaterial
                color={selectedColor}
                transparent
                opacity={0.62}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
      {selectedIntervention && (
        <mesh
          position={[0, 0.026, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.22, 0.004, 8, 48]} />
          <meshBasicMaterial
            color={selectedColor}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      )}
      {selectedIntervention && (
        <InterventionPreview type={selectedIntervention} />
      )}
      <Billboard
        position={[0, selectedIntervention ? 0.47 : 0.4, 0]}
        follow
        lockZ={false}
        renderOrder={24}
      >
        <Text
          fontSize={selectedIntervention ? 0.062 : 0.05}
          color={selectedColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#562913"
          depthOffset={-4}
        >
          {selectedIntervention ? '点击确认' : '作用点'}
        </Text>
      </Billboard>
    </group>
  );
};

const WaterSignal = () => {
  const dropRefs = useRef([]);
  const ringRefs = useRef([]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    dropRefs.current.forEach((drop, index) => {
      if (!drop) return;
      const phase = (time * 0.72 + index * 0.17) % 1;
      drop.position.y = 0.42 - phase * 0.4;
      drop.scale.setScalar(0.65 + (1 - phase) * 0.45);
    });

    ringRefs.current.forEach((ring, index) => {
      if (!ring) return;
      const phase = (time * 0.46 + index * 0.32) % 1;
      ring.scale.setScalar(0.6 + phase * 1.35);
      ring.material.opacity = (1 - phase) * 0.52;
    });
  });

  return (
    <group scale={1.18}>
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.27, 64]} />
        <meshBasicMaterial
          color="#234b51"
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: 7 }, (_, index) => {
        const angle = (index / 7) * Math.PI * 2;
        const radius = 0.08 + (index % 3) * 0.055;

        return (
          <mesh
            key={index}
            ref={(node) => {
              dropRefs.current[index] = node;
            }}
            position={[
              Math.cos(angle) * radius,
              0.34,
              Math.sin(angle) * radius,
            ]}
            rotation={[0, 0, Math.PI]}
          >
            <coneGeometry args={[0.016, 0.05, 10]} />
            <meshBasicMaterial
              color="#9ed9ee"
              transparent
              opacity={0.82}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      {[0.12, 0.2, 0.28].map((radius, index) => (
        <mesh
          key={radius}
          ref={(node) => {
            ringRefs.current[index] = node;
          }}
          position={[0, 0.018 + index * 0.006, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[radius - 0.007, radius, 64]} />
          <meshBasicMaterial
            color="#79c6df"
            transparent
            opacity={0.48}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      <pointLight
        position={[0, 0.2, 0]}
        intensity={0.42}
        distance={0.72}
        color="#9ed9ee"
      />
    </group>
  );
};

const HeatSignal = () => {
  const fieldRef = useRef();
  const waveRefs = useRef([]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (fieldRef.current) {
      fieldRef.current.rotation.y = time * 0.42;
    }

    waveRefs.current.forEach((wave, index) => {
      if (!wave) return;
      const phase = (time * 0.5 + index * 0.28) % 1;
      wave.position.y = 0.035 + phase * 0.34;
      wave.scale.setScalar(0.72 + phase * 0.42);
      wave.material.opacity = (1 - phase) * 0.42;
    });
  });

  return (
    <group scale={1.18}>
      <group ref={fieldRef}>
        {[0.15, 0.25].map((radius) => (
          <mesh
            key={radius}
            position={[0, 0.022, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[radius, 0.009, 8, 64]} />
            <meshStandardMaterial
              color="#e97842"
              emissive="#ff9c58"
              emissiveIntensity={1.8}
              roughness={0.5}
            />
          </mesh>
        ))}
        {Array.from({ length: 6 }, (_, index) => {
          const angle = (index / 6) * Math.PI * 2;

          return (
            <mesh
              key={index}
              position={[
                Math.cos(angle) * 0.25,
                0.04,
                Math.sin(angle) * 0.25,
              ]}
            >
              <cylinderGeometry args={[0.014, 0.02, 0.065, 8]} />
              <meshStandardMaterial
                color="#6d321f"
                emissive="#ff8c4a"
                emissiveIntensity={2.2}
              />
            </mesh>
          );
        })}
      </group>
      {[0, 1, 2].map((index) => (
        <mesh
          key={index}
          ref={(node) => {
            waveRefs.current[index] = node;
          }}
          position={[0, 0.04, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.13 + index * 0.035, 0.005, 8, 48]} />
          <meshBasicMaterial
            color="#ffd49c"
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      ))}
      <pointLight
        position={[0, 0.18, 0]}
        intensity={1.15}
        distance={0.85}
        color="#ff9c58"
      />
    </group>
  );
};

const ShieldSignal = () => {
  const domeRef = useRef();
  const scannerRef = useRef();

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (domeRef.current) {
      domeRef.current.rotation.y = time * 0.23;
      domeRef.current.material.opacity = 0.12 + Math.sin(time * 2.2) * 0.035;
    }

    if (scannerRef.current) {
      const phase = (time * 0.32) % 1;
      scannerRef.current.position.y = 0.035 + phase * 0.24;
      scannerRef.current.scale.setScalar(0.5 + Math.sin(phase * Math.PI) * 0.62);
      scannerRef.current.material.opacity = Math.sin(phase * Math.PI) * 0.5;
    }
  });

  return (
    <group scale={1.18}>
      <mesh ref={domeRef} position={[0, 0.018, 0]}>
        <sphereGeometry
          args={[0.32, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <meshBasicMaterial
          color="#f2b29b"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.018, 0]}>
        <sphereGeometry
          args={[0.326, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <meshBasicMaterial
          color="#fff0e4"
          transparent
          opacity={0.22}
          wireframe
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={scannerRef}
        position={[0, 0.04, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.19, 0.205, 64]} />
        <meshBasicMaterial
          color="#fff0e4"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.018, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.008, 8, 64]} />
        <meshBasicMaterial color="#f2a888" transparent opacity={0.72} />
      </mesh>
    </group>
  );
};

const InterventionSignal = ({ simulation, seed }) => {
  const latestEvent = simulation.events.at(-1);
  const latestIntervention = simulation.interventions.at(-1);

  if (latestEvent?.kind !== 'intervention' || !latestIntervention) {
    return null;
  }

  const position = getZonePosition(simulation.zone, seed);

  return (
    <group
      key={`${latestIntervention.type}-${latestIntervention.sol}-${simulation.interventions.length}`}
      position={position}
    >
      {latestIntervention.type === INTERVENTION_TYPES.WATER && (
        <WaterSignal />
      )}
      {latestIntervention.type === INTERVENTION_TYPES.HEAT && (
        <HeatSignal />
      )}
      {latestIntervention.type === INTERVENTION_TYPES.SHIELD && (
        <ShieldSignal />
      )}
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
  selectedIntervention,
  onPlantInZone,
  onAssignTuber,
  onApplyIntervention,
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
  const blendTexture = useMemo(() => createBlendTexture(), []);
  const seed = useMemo(() => getCraterSeed(crater), [crater]);
  const displayScale = useMemo(
    () => getCraterDisplayScale(crater),
    [crater]
  );
  const options = getCraterZoneOptions();
  const isPlanting = simulation.stage === BREEDING_STAGES.PLANTING;
  const isGrowing = simulation.stage === BREEDING_STAGES.GROWING;
  const isAllocation = simulation.stage === BREEDING_STAGES.ALLOCATION;
  const isComplete = simulation.stage === BREEDING_STAGES.COMPLETE;

  useEffect(() => () => {
    terrainGeometry.dispose();
    blendTexture.dispose();
  }, [blendTexture, terrainGeometry]);

  return (
    <group
      position={position}
      quaternion={quaternion}
      scale={displayScale}
    >
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          color="#8a4631"
          alphaMap={blendTexture}
          transparent
          alphaTest={0.025}
          depthWrite={false}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      <CraterDebris seed={seed} />

      {isPlanting && options.map((option) => (
        <PlantingTarget
          key={option.value}
          option={option}
          seed={seed}
          onPlantInZone={onPlantInZone}
        />
      ))}

      {(isGrowing || isComplete) && (
        <>
          <GrowthPatch simulation={simulation} seed={seed} />
          {isGrowing && (
            <>
              <InterventionTarget
                zone={simulation.zone}
                seed={seed}
                selectedIntervention={selectedIntervention}
                onApplyIntervention={onApplyIntervention}
              />
              <InterventionSignal simulation={simulation} seed={seed} />
            </>
          )}
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
        position={[0.38, 0.8, 0.24]}
        intensity={0.4}
        distance={2}
        color="#ffd2b5"
      />
    </group>
  );
};

export default CraterCultivationScene;
