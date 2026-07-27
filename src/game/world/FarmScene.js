// 经营切片的基地场景（策划 §19.5）：6 块地、设施简模、点击执行当前工具。
// 地形、碎石与植株全部复用 CraterCultivationScene 的构建器，
// 保证经营视图与育种视图是同一个坑。

import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  CraterDebris,
  createBlendTexture,
  createCraterTerrainGeometry,
  createRockDetailTexture,
  getCraterSeed,
  PotatoPlant,
  sampleTerrain,
} from './CraterCultivationScene';
import {
  getCraterDisplayScale,
  getCraterMountRadius,
  ZONE_BANDS,
} from './craterVisualModel';
import { calculateCraterPosition } from './worldCoordinates';
import {
  canApplyTool,
  FACILITY_TYPES,
  getZoneSpec,
  PLOT_STATUS,
} from '../economy/farmEconomy';
import { seededUnit } from '../util/deterministic';
import { useCursorStore } from '../../store';

// 每块地在坑内的角度位置：同区两块地相隔约半圈。
const PLOT_ANGLES = Object.freeze({
  'floor-a': 0.9,
  'floor-b': 4.1,
  'shadow-a': 2.3,
  'shadow-b': 5.5,
  'rim-a': 0.4,
  'rim-b': 3.6,
});

const PLOT_RADII = Object.freeze({
  floor: 0.16,
  shadow: 0.13,
  rim: 0.11,
});

const STATUS_COLORS = Object.freeze({
  [PLOT_STATUS.LOCKED]: '#5c4438',
  [PLOT_STATUS.EMPTY]: '#e8c9a8',
  [PLOT_STATUS.GROWING]: '#8fae6f',
  [PLOT_STATUS.READY]: '#ffd27f',
});

const getPlotPlacement = (plot, seed) => {
  const band = ZONE_BANDS[plot.zone];
  const normalizedRadius = (band.inner + band.outer) / 2;
  const angle = PLOT_ANGLES[plot.id]
    + (seededUnit(seed, 700 + plot.id.length) - 0.5) * 0.3;

  return { ...sampleTerrain(normalizedRadius, angle, seed), angle };
};

const HarvesterModel = () => (
  <group>
    <mesh position={[0, 0.03, 0]}>
      <cylinderGeometry args={[0.028, 0.036, 0.06, 8]} />
      <meshStandardMaterial color="#8a6a52" roughness={0.7} metalness={0.35} />
    </mesh>
    <mesh position={[0, 0.075, 0]}>
      <coneGeometry args={[0.02, 0.038, 8]} />
      <meshStandardMaterial
        color="#bfd8e2"
        roughness={0.25}
        metalness={0.5}
        emissive="#7fb4c9"
        emissiveIntensity={0.25}
      />
    </mesh>
  </group>
);

const HeaterModel = () => {
  return (
    <group>
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.09, 6]} />
        <meshStandardMaterial color="#6d4433" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.096, 0]}>
        <sphereGeometry args={[0.016, 12, 12]} />
        <meshStandardMaterial
          color="#ffb469"
          emissive="#ff8a3c"
          emissiveIntensity={1.4}
          roughness={0.3}
        />
      </mesh>
      <pointLight
        position={[0, 0.1, 0]}
        intensity={0.35}
        distance={0.5}
        color="#ff9d55"
      />
    </group>
  );
};

const ShieldModel = ({ radius }) => (
  <mesh position={[0, 0.01, 0]}>
    <sphereGeometry
      args={[radius * 1.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
    />
    <meshStandardMaterial
      color="#f2c8ae"
      transparent
      opacity={0.22}
      roughness={0.4}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  </mesh>
);

const FACILITY_MODELS = Object.freeze({
  [FACILITY_TYPES.HARVESTER]: HarvesterModel,
  [FACILITY_TYPES.HEATER]: HeaterModel,
  [FACILITY_TYPES.SHIELD]: ShieldModel,
});

const PlotStatusRing = ({ plot, radius }) => {
  const ringRef = React.useRef();
  const isReady = plot.status === PLOT_STATUS.READY;

  useFrame((state) => {
    if (!ringRef.current) return;
    const pulse = isReady
      ? 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.06
      : 1;
    ringRef.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={ringRef} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.94, radius * 1.04, 40]} />
      <meshBasicMaterial
        color={STATUS_COLORS[plot.status]}
        transparent
        opacity={plot.status === PLOT_STATUS.LOCKED ? 0.28 : 0.85}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const PLOT_STATUS_LABELS = Object.freeze({
  [PLOT_STATUS.LOCKED]: '未解锁',
  [PLOT_STATUS.EMPTY]: '空地',
  [PLOT_STATUS.GROWING]: '生长中',
  [PLOT_STATUS.READY]: '可收获',
});

// 工具选中时的可用地块高亮环。
const EligibleRing = ({ radius }) => {
  const ringRef = React.useRef();

  useFrame((state) => {
    if (!ringRef.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 4.4) * 0.1;
    ringRef.current.scale.setScalar(pulse);
    ringRef.current.material.opacity = 0.55
      + Math.sin(state.clock.elapsedTime * 4.4) * 0.3;
  });

  return (
    <mesh
      ref={ringRef}
      position={[0, 0.02, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[radius * 1.1, radius * 1.24, 40]} />
      <meshBasicMaterial
        color="#fff2dd"
        transparent
        opacity={0.7}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const FarmPlot = ({ plot, farm, seed, selectedTool, onPlotAction }) => {
  const setCursorType = useCursorStore((state) => state.setType);
  const placement = useMemo(() => getPlotPlacement(plot, seed), [plot.id, seed]);
  const radius = PLOT_RADII[plot.zone];
  const FacilityModel = plot.facility ? FACILITY_MODELS[plot.facility] : null;
  const locked = plot.status === PLOT_STATUS.LOCKED;
  const eligible = selectedTool
    ? canApplyTool(farm, plot.id, selectedTool)
    : false;
  const dimmedByTool = selectedTool && !eligible;
  const plants = useMemo(() => (
    Array.from({ length: 3 }, (_, index) => ({
      position: [
        Math.cos(index * 2.1 + placement.angle) * radius * 0.45,
        0,
        Math.sin(index * 2.1 + placement.angle) * radius * 0.45,
      ],
      variant: 0.9 + seededUnit(seed, index + plot.id.length * 7) * 0.2,
    }))
  ), [placement.angle, plot.id, radius, seed]);
  const furrows = useMemo(() => [0.34, 0.56, 0.78], []);

  return (
    <group position={[placement.x, placement.height + 0.004, placement.z]}>
      {/* 开垦土面 + 垄沟 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <circleGeometry args={[radius, 36]} />
        <meshStandardMaterial
          color={locked ? '#46312a' : '#5e3c2c'}
          transparent
          opacity={locked ? 0.42 : dimmedByTool ? 0.55 : 0.95}
          roughness={1}
          depthWrite={false}
        />
      </mesh>
      {!locked && furrows.map((factor) => (
        <mesh
          key={factor}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.008, 0]}
        >
          <ringGeometry args={[radius * factor, radius * (factor + 0.05), 32]} />
          <meshBasicMaterial
            color="#402a20"
            transparent
            opacity={dimmedByTool ? 0.25 : 0.5}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      <PlotStatusRing plot={plot} radius={radius} />
      {eligible && <EligibleRing radius={radius} />}

      {(plot.status === PLOT_STATUS.GROWING
        || plot.status === PLOT_STATUS.READY) && plants.map((plant, index) => (
        <PotatoPlant
          key={index}
          basePosition={plant.position}
          index={index}
          growth={plot.growth / 100}
          vigor={80}
          stress={plot.stormHalved ? 70 : 26}
          variant={plant.variant}
        />
      ))}

      {FacilityModel && (
        <group position={[radius * 0.62, 0, -radius * 0.62]}>
          <FacilityModel radius={radius} />
        </group>
      )}

      {/* 常驻地块标签：区位 + 状态。玩家必须一眼看出哪里可以点。 */}
      <Billboard position={[0, radius * 0.9 + 0.06, 0]}>
        <Text
          fontSize={0.03}
          color={locked ? '#d8b294' : '#fff4e8'}
          outlineColor="#3f1d0d"
          outlineWidth={0.003}
          anchorX="center"
          anchorY="middle"
        >
          {getZoneSpec(plot.zone).label}
          {' · '}
          {plot.status === PLOT_STATUS.GROWING
            ? `${Math.round(plot.growth)}%`
            : PLOT_STATUS_LABELS[plot.status]}
        </Text>
      </Billboard>

      {/* 命中区：必须保持 visible（three 射线检测跳过不可见物体，
          旧写法 visible=false 让地块点击完全失效），用透明材质隐形。 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.018, 0]}
        onClick={(event) => {
          event.stopPropagation();
          if (!locked) onPlotAction(plot.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          if (!locked) setCursorType('hover');
        }}
        onPointerOut={() => setCursorType('default')}
      >
        <circleGeometry args={[radius * 1.25, 24]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

const FarmScene = ({ crater, farm, selectedTool, onPlotAction }) => {
  const seed = useMemo(() => getCraterSeed(crater), [crater.id]);
  const displayScale = useMemo(
    () => getCraterDisplayScale(crater),
    [crater.id]
  );
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
  const terrainGeometry = useMemo(
    () => createCraterTerrainGeometry(crater),
    [crater.id]
  );
  const blendTexture = useMemo(() => createBlendTexture(seed), [seed]);
  const detailTexture = useMemo(() => createRockDetailTexture(seed), [seed]);

  useEffect(() => () => {
    terrainGeometry.dispose();
    blendTexture.dispose();
    detailTexture.dispose();
  }, [blendTexture, detailTexture, terrainGeometry]);

  return (
    <group position={position} quaternion={quaternion} scale={displayScale}>
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          color="#a05a41"
          map={detailTexture}
          alphaMap={blendTexture}
          transparent
          alphaTest={0.025}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      <CraterDebris seed={seed} />

      {farm.plots.map((plot) => (
        <FarmPlot
          key={plot.id}
          plot={plot}
          farm={farm}
          seed={seed}
          selectedTool={selectedTool}
          onPlotAction={onPlotAction}
        />
      ))}

      <pointLight
        position={[0.38, 0.8, 0.24]}
        intensity={0.22}
        distance={2}
        color="#ffd2b5"
      />
    </group>
  );
};

export default React.memo(FarmScene);
