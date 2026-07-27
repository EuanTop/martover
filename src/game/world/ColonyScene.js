// 基地场景：26 格晶格、设施简模、点击执行当前工具。
// 地形、碎石与植株全部复用 CraterCultivationScene 的构建器，
// 保证经营视图与育种视图是同一个坑。
//
// 布局来自 economy/baseLayout 的推导式晶格。旧实现用 id → 弧度的
// 硬编码表且无回退，未知 id 会得到 NaN 坐标并静默消失。

import React, { useEffect, useMemo, useState } from 'react';
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
} from './craterVisualModel';
import { calculateCraterPosition } from './worldCoordinates';
import { createCellLattice } from '../economy/baseLayout';
import { canApplyTool, isShielded } from '../economy/colonyEconomy';
import {
  CROP_STATUS,
  FACILITY_SPECS,
  FACILITY_TYPES,
  getZoneSpec,
} from '../economy/colonyState';
import { seededUnit, stableHash } from '../util/deterministic';
import { useCursorStore } from '../../store';

// 26 格之下每格只有 0.043-0.060 局部单位，标签字号必须同步缩小，
// 且只在需要时渲染 —— 26 个常驻 troika Text 既费帧又互相重叠。
const LABEL_FONT_SIZE = 0.016;
// 每格最多两株：格子比旧的 6 格版小约 3 倍。
const PLANTS_PER_CELL = 2;

const ExtractorModel = () => (
  <group>
    <mesh position={[0, 0.012, 0]}>
      <cylinderGeometry args={[0.011, 0.014, 0.024, 8]} />
      <meshStandardMaterial color="#8a6a52" roughness={0.7} metalness={0.35} />
    </mesh>
    <mesh position={[0, 0.03, 0]}>
      <coneGeometry args={[0.008, 0.015, 8]} />
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

const SolarModel = () => (
  <group>
    <mesh position={[0, 0.008, 0]}>
      <cylinderGeometry args={[0.003, 0.003, 0.016, 6]} />
      <meshStandardMaterial color="#6d4433" roughness={0.8} />
    </mesh>
    <mesh position={[0, 0.018, 0]} rotation={[-0.5, 0, 0]}>
      <boxGeometry args={[0.042, 0.002, 0.028]} />
      <meshStandardMaterial
        color="#2f4a63"
        roughness={0.25}
        metalness={0.6}
        emissive="#31536e"
        emissiveIntensity={0.3}
      />
    </mesh>
  </group>
);

const BatteryModel = () => (
  <group>
    <mesh position={[0, 0.011, 0]}>
      <boxGeometry args={[0.03, 0.022, 0.022]} />
      <meshStandardMaterial color="#7a5442" roughness={0.6} metalness={0.4} />
    </mesh>
    <mesh position={[0, 0.024, 0]}>
      <boxGeometry args={[0.02, 0.004, 0.014]} />
      <meshStandardMaterial
        color="#ffd27f"
        emissive="#ffb44a"
        emissiveIntensity={0.8}
      />
    </mesh>
  </group>
);

const HeaterModel = () => (
  <group>
    <mesh position={[0, 0.018, 0]}>
      <cylinderGeometry args={[0.004, 0.006, 0.036, 6]} />
      <meshStandardMaterial color="#6d4433" roughness={0.8} />
    </mesh>
    <mesh position={[0, 0.04, 0]}>
      <sphereGeometry args={[0.008, 10, 10]} />
      <meshStandardMaterial
        color="#ffb469"
        emissive="#ff8a3c"
        emissiveIntensity={1.4}
        roughness={0.3}
      />
    </mesh>
  </group>
);

const ShieldModel = ({ radius }) => (
  <mesh position={[0, 0.004, 0]}>
    <sphereGeometry
      args={[radius * 1.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
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
  [FACILITY_TYPES.EXTRACTOR]: ExtractorModel,
  [FACILITY_TYPES.SOLAR]: SolarModel,
  [FACILITY_TYPES.BATTERY]: BatteryModel,
  [FACILITY_TYPES.HEATER]: HeaterModel,
  [FACILITY_TYPES.SHIELD]: ShieldModel,
});

const getCellTone = (cell) => {
  if (!cell.cleared) return '#4a3226';
  if (cell.crop?.status === CROP_STATUS.READY) return '#ffd27f';
  if (cell.crop) return '#8fae6f';
  if (cell.facility) return '#c4a184';
  return '#e8c9a8';
};

// 待收获时脉冲，把「该点这里了」推到玩家眼前。
const CellRing = ({ cell, radius }) => {
  const ringRef = React.useRef();
  const isReady = cell.crop?.status === CROP_STATUS.READY;

  useFrame((state) => {
    if (!ringRef.current) return;
    ringRef.current.scale.setScalar(
      isReady ? 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.06 : 1
    );
  });

  return (
    <mesh ref={ringRef} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.9, radius * 1.02, 24]} />
      <meshBasicMaterial
        color={getCellTone(cell)}
        transparent
        opacity={cell.cleared ? 0.85 : 0.3}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// 工具选中时的可用格高亮环。
const EligibleRing = ({ radius }) => {
  const ringRef = React.useRef();

  useFrame((state) => {
    if (!ringRef.current) return;
    const wave = Math.sin(state.clock.elapsedTime * 4.4);
    ringRef.current.scale.setScalar(1 + wave * 0.1);
    ringRef.current.material.opacity = 0.55 + wave * 0.3;
  });

  return (
    <mesh ref={ringRef} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 1.08, radius * 1.26, 24]} />
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

// 邻接覆盖盘：让「这座设施罩住了哪几格」在 3D 里直接可读，
// 而不是只存在于数值里。
const CoverageDisc = ({ radius, color }) => (
  <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <circleGeometry args={[radius * 1.5, 20]} />
    <meshBasicMaterial
      color={color}
      transparent
      opacity={0.13}
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  </mesh>
);

const getCellCaption = (cell) => {
  if (!cell.cleared) return '待开垦';
  if (cell.crop?.status === CROP_STATUS.READY) return '可收获';
  if (cell.crop) return `${Math.round(cell.crop.growth)}%`;
  if (cell.facility) return FACILITY_SPECS[cell.facility.type].label;
  return '空地';
};

const ColonyCell = ({
  cell, layout, colony, base, seed, selectedTool, onCellAction,
}) => {
  const setCursorType = useCursorStore((state) => state.setType);
  const [hovered, setHovered] = useState(false);
  const radius = layout.footprintRadius;
  const FacilityModel = cell.facility
    ? FACILITY_MODELS[cell.facility.type]
    : null;
  const eligible = selectedTool
    ? canApplyTool(colony, cell.id, selectedTool)
    : false;
  const dimmed = Boolean(selectedTool) && !eligible;
  const isReady = cell.crop?.status === CROP_STATUS.READY;

  const plants = useMemo(() => (
    Array.from({ length: PLANTS_PER_CELL }, (_, index) => ({
      position: [
        Math.cos(index * 2.6 + layout.angle) * radius * 0.4,
        0,
        Math.sin(index * 2.6 + layout.angle) * radius * 0.4,
      ],
      // 抖动下标用 stableHash(id)：旧实现用 id.length，同长度的 id
      // 会拿到完全相同的抖动。
      variant: 0.9 + seededUnit(seed, stableHash(`${cell.id}|${index}`)) * 0.2,
    }))
  ), [cell.id, layout.angle, radius, seed]);

  // 标签按需渲染：26 个常驻 troika Text 太费，且在新尺寸下会重叠。
  const showLabel = hovered || eligible || isReady;

  return (
    <group position={[layout.x, layout.height + 0.004, layout.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[radius, 20]} />
        <meshStandardMaterial
          color={cell.cleared ? '#5e3c2c' : '#46312a'}
          transparent
          opacity={cell.cleared ? (dimmed ? 0.55 : 0.95) : 0.4}
          roughness={1}
          depthWrite={false}
        />
      </mesh>

      <CellRing cell={cell} radius={radius} />
      {eligible && <EligibleRing radius={radius} />}

      {cell.facility?.type === FACILITY_TYPES.SHIELD && (
        <CoverageDisc radius={radius} color="#cfe4f2" />
      )}
      {cell.facility?.type === FACILITY_TYPES.HEATER && (
        <CoverageDisc radius={radius} color="#ff9d55" />
      )}

      {cell.crop && cell.crop.growth >= 12 && plants.map((plant, index) => (
        <PotatoPlant
          key={index}
          basePosition={plant.position}
          index={index}
          growth={cell.crop.growth / 100}
          vigor={80}
          stress={isShielded(base, cell.id) ? 20 : 32}
          variant={plant.variant}
        />
      ))}

      {FacilityModel && <FacilityModel radius={radius} />}

      {showLabel && (
        <Billboard position={[0, radius * 0.9 + 0.03, 0]}>
          <Text
            fontSize={LABEL_FONT_SIZE}
            color={cell.cleared ? '#fff4e8' : '#d8b294'}
            outlineColor="#3f1d0d"
            outlineWidth={0.002}
            anchorX="center"
            anchorY="middle"
          >
            {getZoneSpec(cell.zone).label}
            {' · '}
            {getCellCaption(cell)}
          </Text>
        </Billboard>
      )}

      {/* 命中区：必须保持 visible（three 射线检测跳过不可见物体，
          旧写法 visible=false 让地块点击完全失效），用透明材质隐形。 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.014, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onCellAction(cell.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          setCursorType('hover');
        }}
        onPointerOut={() => {
          setHovered(false);
          setCursorType('default');
        }}
      >
        <circleGeometry args={[radius * 1.2, 16]} />
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

const ColonyScene = ({ crater, colony, base, selectedTool, onCellAction }) => {
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

  // 晶格按基地种子推导一次，再按 id 与状态里的格子配对。
  // 地形采样用坑的 seed，与地形网格本身保持一致。
  const layouts = useMemo(() => {
    const map = new Map();
    createCellLattice(base.seed).forEach((cell) => {
      map.set(cell.id, {
        ...cell,
        ...sampleTerrain(cell.normalizedRadius, cell.angle, seed),
      });
    });
    return map;
  }, [base.seed, seed]);

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

      {base.cells.map((cell) => {
        const layout = layouts.get(cell.id);
        if (!layout) return null;

        return (
          <ColonyCell
            key={cell.id}
            cell={cell}
            layout={layout}
            colony={colony}
            base={base}
            seed={seed}
            selectedTool={selectedTool}
            onCellAction={onCellAction}
          />
        );
      })}

      <pointLight
        position={[0.38, 0.8, 0.24]}
        intensity={0.22}
        distance={2}
        color="#ffd2b5"
      />
    </group>
  );
};

export default React.memo(ColonyScene);
