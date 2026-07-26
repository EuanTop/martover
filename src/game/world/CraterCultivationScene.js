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
import {
  FLOOR_DEPTH,
  getCraterDisplayScale,
  getCraterMountRadius,
  TERRAIN_BANDS,
  TERRAIN_RADIUS,
  ZONE_BANDS,
} from './craterVisualModel';
import { calculateCraterPosition } from './worldCoordinates';
import { useCursorStore } from '../../store';


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

// 网格顶点的世界半径是 TERRAIN_RADIUS * normalizedRadius * ellipticity
// * (1 + contourNoise * smoothStep)，所以直接把世界半径当归一化半径
// 传给 getTerrainHeight 会差一个 0.92 因子及椭圆度项，实测垂直误差
// 0.011-0.013，与代码里 +0.018 的抬升余量同量级 —— 植株随机穿地或悬空。
const getContourFactors = (angle, seed) => {
  const phase = (seed % 1543) / 1543;
  const contourNoise = (
    Math.sin(angle * 3 + phase * 13) * 0.54
    + Math.cos(angle * 7 - phase * 7) * 0.3
    + Math.sin(angle * 11 + phase * 19) * 0.16
  ) * 0.055;
  const ellipticity = 1 + Math.cos(angle * 2 + phase * 4) * 0.035;

  return { contourNoise, ellipticity };
};

// 由归一化半径与角度求出真实的世界平面坐标与贴地高度。
// 所有放置逻辑（植株、干预标记、碎石）都必须走这里。
const sampleTerrain = (normalizedRadius, angle, seed) => {
  const { contourNoise, ellipticity } = getContourFactors(angle, seed);
  const radius = TERRAIN_RADIUS
    * normalizedRadius
    * ellipticity
    * (1 + contourNoise * smoothStep(normalizedRadius));
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  return {
    x,
    z,
    radius,
    height: getTerrainHeight(normalizedRadius, x, z, seed),
  };
};

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

  if (normalizedRadius < TERRAIN_BANDS.floor) {
    return -FLOOR_DEPTH + surfaceNoise * 0.35;
  }

  if (normalizedRadius < TERRAIN_BANDS.slope) {
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

// 地形色板与暂存色提到模块级。旧实现每个顶点都 new 四个
// THREE.Color 再 clone 一次，3265 个顶点约 1.3 万次分配，
// 每次进入近景都要走一遍。
const TERRAIN_PALETTE = Object.freeze({
  floor: new THREE.Color('#3a2725'),
  slope: new THREE.Color('#56352c'),
  rim: new THREE.Color('#744638'),
  apron: new THREE.Color('#634034'),
});

const getTerrainColor = (
  normalizedRadius,
  height,
  x,
  z,
  seed,
  layerCount,
  // 调用方传入复用的 Color 实例；缺省时才新建。
  target = new THREE.Color()
) => {
  const { floor, slope, rim, apron } = TERRAIN_PALETTE;
  const color = target;

  if (normalizedRadius < TERRAIN_BANDS.floor) {
    color.copy(floor).lerp(slope, normalizedRadius * 0.22);
  } else if (normalizedRadius < TERRAIN_BANDS.slope) {
    color.copy(floor).lerp(
      slope,
      smoothStep((normalizedRadius - 0.34) / 0.38)
    );
  } else if (normalizedRadius < TERRAIN_BANDS.rim) {
    color.copy(slope).lerp(
      rim,
      smoothStep((normalizedRadius - 0.72) / 0.1)
    );
  } else {
    color.copy(rim).lerp(
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

  // 单个复用实例贯穿全部顶点。
  const scratchColor = new THREE.Color();

  for (let ring = 1; ring <= radialSegments; ring += 1) {
    const normalizedRadius = ring / radialSegments;

    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = (segment / angularSegments) * Math.PI * 2;
      const { x, z, height } = sampleTerrain(normalizedRadius, angle, seed);
      const color = getTerrainColor(
        normalizedRadius,
        height,
        x,
        z,
        seed,
        layerCount,
        scratchColor
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

// 坑缘遮罩必须不规则（策划 247 行禁止规则圆环）。
// 旧实现是严格同心圆渐变，把地形网格已经做出的不规则外沿
// 又抹回成一个完美的圆。这里改为按角度调制淡出半径，
// 并与地形轮廓噪声同源同相位，使遮罩边界跟着地貌起伏。
const createBlendTexture = (seed = 1) => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const center = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const { contourNoise, ellipticity } = getContourFactors(angle, seed);
      // 淡出区间随角度移动，因此没有任何一圈是完美的圆。
      const edge = ellipticity * (1 + contourNoise * 1.9);
      const inner = edge * 0.66;
      const alpha = 1 - smoothStep(
        (distance - inner) / Math.max(0.0001, edge - inner)
      );
      const offset = (y * size + x) * 4;
      const value = Math.round(THREE.MathUtils.clamp(alpha, 0, 1) * 255);

      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

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
      // 归一化半径收进 0.62-0.97：旧值 0.7-1.0 是世界半径，
      // 超出网格外沿 0.92，实测 11/30 块碎石飘在裸火星球面上。
      const radius = 0.62 + seededUnit(seed, index * 4 + 1) * 0.35;
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
      const sample = sampleTerrain(rock.radius, rock.angle, seed);
      position.set(
        sample.x,
        sample.height + rock.size * 0.35,
        sample.z
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

// 种植前的区域标记落在该区植株群落的重心上，
// 因此玩家点选的位置就是植株之后真正出现的位置。
const getZonePosition = (zone, seed) => {
  const anchor = getZoneAnchor(zone, seed);

  return [
    anchor.position[0],
    anchor.position[1] + 0.025,
    anchor.position[2],
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

const ROOT_ANGLES = [0.2, 2.35, 4.45];

// 三条根须合并成一个 lineSegments，而不是三个 drei <Line>。
// 每个 <Line> 都是完整的 Line2，自带材质与 resolution uniform；
// 12 株时仅根须就是 36 个绘制单元。
const RootLines = ({ maturity, stress }) => {
  const geometryRef = useRef();
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const positions = useMemo(() => {
    const points = [];

    ROOT_ANGLES.forEach((angle, index) => {
      const length = 0.075 + maturity * (0.12 + index * 0.015);
      const mid = [
        Math.cos(angle + 0.2) * length * 0.55,
        0.002,
        Math.sin(angle + 0.2) * length * 0.55,
      ];
      const tip = [
        Math.cos(angle) * length,
        -0.006,
        Math.sin(angle) * length,
      ];

      points.push(0, 0.008, 0, ...mid, ...mid, ...tip);
    });

    return new Float32Array(points);
  }, [maturity]);

  useEffect(() => {
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    geometry.attributes.position.needsUpdate = true;
  }, [geometry, positions]);

  return (
    <lineSegments geometry={geometry} ref={geometryRef}>
      <lineBasicMaterial
        color={stress > 58 ? '#b74a2b' : '#f1d7c6'}
        transparent
        opacity={0.48 + maturity * 0.36}
        depthWrite={false}
      />
    </lineSegments>
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
              // 块茎在地下且尺寸很小，28 段细分在 12 株时是
              // 6 万顶点；16 段视觉上无差别。
              geometryDetail={16}
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

// 三个种植区必须有互不相同的分布形态（策划 251-254 行）。
// 旧实现三个分支共用同一个黄金角递推，实测角覆盖都是 ~266°，
// 也就是三种区域都是绕坑一整圈的均匀环，画面上无法区分；
// 且 floor 分支半径落在 0.519-0.663，按地形分带全在坑壁上，
// 选「坑底」时没有一株真的种在坑底。
const getGrowthPositions = (zone, seed, plantCount = 6) => {
  const band = ZONE_BANDS[zone] || ZONE_BANDS.shadow;
  const spanAngle = zoneLayout[zone]?.angle ?? 0;

  return Array.from({ length: plantCount }, (_, index) => {
    const spread = plantCount > 1 ? index / (plantCount - 1) : 0.5;
    const jitterA = seededUnit(seed, index * 5) - 0.5;
    const jitterR = seededUnit(seed, index * 5 + 1);
    let angle;
    let normalizedRadius;

    if (zone === CRATER_ZONES.RIM) {
      // 坑缘：沿破碎外缘展开的弧带，只占约 96° 的受限扇区。
      angle = spanAngle + (spread - 0.5) * 1.68 + jitterA * 0.12;
      normalizedRadius = band.inner
        + (band.outer - band.inner) * (0.35 + jitterR * 0.65);
    } else if (zone === CRATER_ZONES.SHADOW) {
      // 坑壁：沿坡面等高线的弯曲带，半径随弧长缓慢下降。
      angle = spanAngle + (spread - 0.5) * 1.34 + jitterA * 0.1;
      normalizedRadius = band.outer
        - (band.outer - band.inner) * (spread * 0.72 + jitterR * 0.24);
    } else {
      // 坑底：有间距的散点群落，用黄金角散布在整个坑底盘内。
      angle = index * 2.399963 + jitterA * 0.5;
      normalizedRadius = band.inner
        + Math.sqrt((index + jitterR) / plantCount)
          * (band.outer - band.inner);
    }

    const { x, z, height } = sampleTerrain(normalizedRadius, angle, seed);

    return {
      position: [x, height + 0.006, z],
      normalizedRadius,
      angle,
      variant: 0.88 + seededUnit(seed, index * 5 + 4) * 0.22,
      emergenceDelay: index * 0.07 + seededUnit(seed, index * 5 + 3) * 0.11,
    };
  });
};

// 干预标记锚定到植株群落的实际重心，而不是另一套 zoneLayout 半径。
// 旧实现 floor 标记在 r=0.18、植株在 0.519-0.663，偏离 0.34-0.48，
// 遮蔽穹顶罩在空地上，被保护的植株露在穹顶外面。
const getZoneAnchor = (zone, seed, plantCount = 6) => {
  const plants = getGrowthPositions(zone, seed, plantCount);
  const meanRadius = plants.reduce(
    (total, plant) => total + plant.normalizedRadius,
    0
  ) / plants.length;
  const meanAngle = Math.atan2(
    plants.reduce((total, plant) => total + Math.sin(plant.angle), 0),
    plants.reduce((total, plant) => total + Math.cos(plant.angle), 0)
  );
  const { x, z, height } = sampleTerrain(meanRadius, meanAngle, seed);
  // 群落的角向与径向跨度，供作用范围包住全部植株。
  const spread = Math.max(
    ...plants.map((plant) => Math.hypot(
      plant.position[0] - x,
      plant.position[2] - z
    ))
  );

  return {
    position: [x, height, z],
    normalizedRadius: meanRadius,
    angle: meanAngle,
    spread,
  };
};

// 收获后用真实块茎数；收获前按坑体规模与活力做一个稳定的预估，
// 这样植株数量在整代内不会跳动。
const getPlantCount = (simulation) => {
  if (simulation.harvestResult) {
    return THREE.MathUtils.clamp(simulation.harvestResult.tuberCount, 1, 12);
  }

  return THREE.MathUtils.clamp(
    Math.round(4 + simulation.vigor / 22),
    3,
    10
  );
};

const GrowthPatch = ({ simulation, seed }) => {
  const maturity = simulation.growth / 100;
  // 植株数量由本代实际块茎数驱动，而不是固定 6 株。
  // 收获前用环境预估的产量，收获后与 tuberCount 对齐。
  const plantCount = getPlantCount(simulation);
  const plants = useMemo(
    () => getGrowthPositions(simulation.zone, seed, plantCount),
    [seed, simulation.zone, plantCount]
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

// 遮蔽旧色 #f7d6c4 与未选中默认色 #fff0df 的 RGB 距离只有 38.3
// （水 116.8、热 157.8），选中遮蔽后画面几乎没有变化，
// 玩家无法确认工具已选中。改为明确的紫罗兰色，
// 并与执行反馈 ShieldSignal 统一为同一个值。
const INTERVENTION_COLORS = Object.freeze({
  [INTERVENTION_TYPES.WATER]: '#8ed7ef',
  [INTERVENTION_TYPES.HEAT]: '#ff9b5a',
  [INTERVENTION_TYPES.SHIELD]: '#b98cf0',
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
            color="#b98cf0"
            transparent
            opacity={0.14}
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
            color="#b98cf0"
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
          color="#b98cf0"
          transparent
          opacity={0.14}
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
  const seed = useMemo(() => getCraterSeed(crater), [crater.id]);
  const displayScale = useMemo(
    () => getCraterDisplayScale(crater),
    [crater.id]
  );
  // 挂载点下沉，使坑底真正低于球面而不是浮在球面之上。
  // 旧值 1.006 让所有 12 km 以下的坑坑底都在球面外侧。
  const mountRadius = useMemo(
    () => getCraterMountRadius(crater),
    [crater.id]
  );
  const position = useMemo(() => (
    new THREE.Vector3(...calculateCraterPosition(
      crater.latitude,
      crater.longitude,
      mountRadius
    ))
  ), [crater.latitude, crater.longitude, mountRadius]);
  const quaternion = useMemo(() => (
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      position.clone().normalize()
    )
  ), [position]);
  // 依赖 crater.id 而非整个 crater 对象：上游任何重建都会
  // 触发 3265 顶点的全量地形重算。
  const terrainGeometry = useMemo(
    () => createCraterTerrainGeometry(crater),
    [crater.id]
  );
  const blendTexture = useMemo(() => createBlendTexture(seed), [seed]);
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
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
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
