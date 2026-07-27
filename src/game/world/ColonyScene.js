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
  sampleTerrain,
} from './CraterCultivationScene';
import {
  getCraterDisplayScale,
  getCraterMountRadius,
} from './craterVisualModel';
import SuperPotato, { PLANT_LABEL_HEIGHT } from './SuperPotato';
import FacilityModel from './FacilityModels';
import FactoryConnections from './FactoryConnections';
import { calculateCraterPosition } from './worldCoordinates';
import { createCellLattice } from '../economy/baseLayout';
import { canApplyTool } from '../economy/colonyEconomy';
import {
  FACILITY_SPECS,
  FACILITY_TYPES,
  getZoneSpec,
  POTATO_STATUS,
} from '../economy/colonyState';
import { useCursorStore } from '../../store';

// 标签只在需要时渲染，避免 26 个常驻 troika Text 互相重叠。
const LABEL_FONT_SIZE = 0.016;

// 规则层的 footprintRadius 只负责格间无碰撞，不能直接当建筑视觉尺寸。
// 工厂模型按环带获得稳定体量：越靠外可用空间越大，建筑也更高、更清楚。
const getFactoryVisualRadius = (layout) => {
  const ringRadii = [0.13, 0.075, 0.095, 0.105, 0.115];
  return ringRadii[layout.ring] || Math.max(layout.footprintRadius, 0.075);
};

const getCellTone = (cell, base) => {
  if (!cell.cleared) return '#c8916a';
  if (cell.isPlantingBed) {
    if (base.potato?.status === POTATO_STATUS.READY) return '#ffd27f';
    if (base.potato) return '#8fae6f';
    return '#f0dcc0';
  }
  if (cell.facility) return '#c4a184';
  return '#e8c9a8';
};

const CellRing = ({ cell, base, radius }) => {
  const ringRef = React.useRef();
  const isReady = cell.isPlantingBed
    && base.potato?.status === POTATO_STATUS.READY;

  useFrame((state) => {
    if (!ringRef.current) return;
    ringRef.current.scale.setScalar(
      isReady ? 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.06 : 1
    );
  });

  return (
    <mesh ref={ringRef} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.82, radius * 1.06, 28]} />
      <meshBasicMaterial
        color={getCellTone(cell, base)}
        transparent
        opacity={cell.cleared ? 0.92 : 0.7}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const FactoryPad = ({ cell, radius, dimmed }) => {
  if (!cell.cleared) {
    return (
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.3, radius * 0.42, 20]} />
        <meshBasicMaterial
          color="#d7986f"
          transparent
          opacity={dimmed ? 0.055 : 0.17}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.009, 0]} receiveShadow>
        <cylinderGeometry args={[radius * 0.82, radius * 0.92, 0.018, 24]} />
        <meshStandardMaterial
          color={cell.facility ? '#75442f' : '#8d553c'}
          roughness={0.62}
          metalness={0.32}
          transparent
          opacity={dimmed ? 0.48 : 0.94}
        />
      </mesh>
      <mesh position={[0, 0.019, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.57, radius * 0.72, 24]} />
        <meshBasicMaterial
          color={cell.facility ? '#e1a272' : '#c9845d'}
          transparent
          opacity={dimmed ? 0.18 : 0.52}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[0, Math.PI / 2].map((angle) => (
        <mesh
          key={angle}
          position={[0, 0.021, 0]}
          rotation={[-Math.PI / 2, 0, angle]}
        >
          <planeGeometry args={[radius * 1.2, 0.006]} />
          <meshBasicMaterial
            color="#f0bb91"
            transparent
            opacity={dimmed ? 0.1 : 0.38}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// 种植核心是整座工厂的汇点，不表现成普通建筑格。
const PlantingBedMarker = ({ radius }) => (
  <group>
    <mesh position={[0, 0.008, 0]} receiveShadow>
      <cylinderGeometry args={[radius * 0.76, radius * 0.9, 0.016, 32]} />
      <meshStandardMaterial
        color="#6c3d2b"
        roughness={0.82}
        metalness={0.18}
      />
    </mesh>
    {[0.55, 0.76, 1].map((scale, index) => (
      <mesh
        key={scale}
        position={[0, 0.019 + index * 0.001, 0]}
        rotation={[-Math.PI / 2, 0, index * 0.38]}
      >
        <ringGeometry args={[radius * scale, radius * (scale + 0.055), 32]} />
        <meshBasicMaterial
          color={index === 2 ? '#ffe0b8' : '#d78b5a'}
          transparent
          opacity={index === 2 ? 0.55 : 0.34}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    ))}
  </group>
);

// 工具选中时的可用格高亮环。
const EligibleRing = ({ radius, onActivate }) => {
  const ringRef = React.useRef();
  const beamRef = React.useRef();
  const beaconRef = React.useRef();

  useFrame((state) => {
    if (!ringRef.current) return;
    const wave = Math.sin(state.clock.elapsedTime * 4.4);
    ringRef.current.rotation.z = state.clock.elapsedTime * 0.42;
    ringRef.current.scale.setScalar(1 + wave * 0.045);
    ringRef.current.material.opacity = 0.78 + wave * 0.16;
    if (beamRef.current) {
      beamRef.current.material.opacity = 0.2 + (wave + 1) * 0.075;
    }
    if (beaconRef.current) {
      beaconRef.current.position.y = radius * (1.2 + wave * 0.12);
      beaconRef.current.rotation.y += 0.018;
    }
  });

  return (
    <group onClick={onActivate}>
      <mesh position={[0, 0.024, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.86, 28]} />
        <meshBasicMaterial
          color="#ffb16f"
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh
        ref={ringRef}
        position={[0, 0.029, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[radius * 0.88, radius * 1.2, 32, 1, 0, Math.PI * 1.7]} />
        <meshBasicMaterial
          color="#fff0d6"
          transparent
          opacity={0.9}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={beamRef} position={[0, radius * 0.55, 0]}>
        <cylinderGeometry args={[radius * 0.48, radius * 0.9, radius * 1.08, 24, 1, true]} />
        <meshBasicMaterial
          color="#ffc48d"
          transparent
          opacity={0.28}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => (
        <mesh
          key={angle}
          position={[
            Math.cos(angle) * radius * 0.78,
            radius * 0.42,
            Math.sin(angle) * radius * 0.78,
          ]}
        >
          <boxGeometry args={[radius * 0.055, radius * 0.78, radius * 0.055]} />
          <meshBasicMaterial
            color="#ffe4c2"
            transparent
            opacity={0.82}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh ref={beaconRef} position={[0, radius * 1.2, 0]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[radius * 0.16, 0]} />
        <meshBasicMaterial
          color="#fff4de"
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </mesh>
    </group>
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

const getCellCaption = (cell, base) => {
  if (!cell.cleared) return '待开垦';
  if (cell.isPlantingBed) {
    if (base.potato?.status === POTATO_STATUS.READY) return '可收获';
    if (base.potato) return `${Math.round(base.potato.growth)}%`;
    return '种植床 · 空';
  }
  if (cell.facility) {
    const label = FACILITY_SPECS[cell.facility.type].label;
    if (cell.facility.buildRemaining > 0) {
      return `${label} · 施工 ${cell.facility.buildRemaining}`;
    }
    if (cell.facility.integrity < 65) {
      return `${label} · ${cell.facility.integrity}%`;
    }
    return label;
  }
  return '空地';
};

const ColonyCell = ({
  cell, layout, colony, base, seed, selectedTool, onCellAction,
}) => {
  const setCursorType = useCursorStore((state) => state.setType);
  const [hovered, setHovered] = useState(false);
  const interactionRadius = Math.max(
    layout.footprintRadius * 1.35,
    getFactoryVisualRadius(layout)
  );
  const visualRadius = getFactoryVisualRadius(layout);
  const eligible = selectedTool
    ? canApplyTool(colony, cell.id, selectedTool)
    : false;
  const dimmed = Boolean(selectedTool) && !eligible;
  const isReady = cell.isPlantingBed
    && base.potato?.status === POTATO_STATUS.READY;

  // 标签按需渲染：26 个常驻 troika Text 太费，且在新尺寸下会重叠。
  // 种植床永远显示 —— 它是全坑唯一的产出口。
  const showLabel = hovered || eligible || isReady || cell.isPlantingBed;

  return (
    <group
      position={[layout.x, layout.height + 0.004, layout.z]}
      onClick={(event) => {
        if (selectedTool && !eligible) return;
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
      {!cell.isPlantingBed && (
        <FactoryPad cell={cell} radius={visualRadius} dimmed={dimmed} />
      )}
      <CellRing
        cell={cell}
        base={base}
        radius={cell.isPlantingBed ? visualRadius : visualRadius * 0.94}
      />
      {cell.isPlantingBed && <PlantingBedMarker radius={visualRadius} />}
      {eligible && (
        <EligibleRing
          radius={visualRadius}
          onActivate={(event) => {
            event.stopPropagation();
            onCellAction(cell.id);
          }}
        />
      )}

      {cell.facility?.type === FACILITY_TYPES.SHIELD
        && cell.facility.buildRemaining === 0 && (
        <CoverageDisc radius={visualRadius} color="#cfe4f2" />
      )}
      {cell.facility?.type === FACILITY_TYPES.HEATER
        && cell.facility.buildRemaining === 0 && (
        <CoverageDisc radius={visualRadius} color="#ff9d55" />
      )}

      {/* 全坑唯一的那棵超级土豆。按坑半径标定，不受格子大小约束 ——
          它是坑内的视觉主体，设施模型只有它的几十分之一。 */}
      {cell.isPlantingBed && base.potato && (
        <SuperPotato
          growth={base.potato.growth}
          quality={base.potato.quality}
          seed={seed}
        />
      )}

      {cell.facility && (
        <FacilityModel
          facility={cell.facility}
          radius={visualRadius}
          facilitiesIdle={base.facilitiesIdle}
        />
      )}

      {showLabel && (
        <Billboard
          position={[
            0,
            // 种植床的标签要抬到植株之上，否则会被叶丛盖住。
            cell.isPlantingBed && base.potato
              ? PLANT_LABEL_HEIGHT
              : visualRadius * 0.92 + 0.055,
            0,
          ]}
        >
          <Text
            fontSize={cell.isPlantingBed ? LABEL_FONT_SIZE * 1.8 : LABEL_FONT_SIZE}
            color={cell.cleared ? '#fff4e8' : '#d8b294'}
            outlineColor="#3f1d0d"
            outlineWidth={0.002}
            anchorX="center"
            anchorY="middle"
          >
            {cell.isPlantingBed
              ? getCellCaption(cell, base)
              : `${getZoneSpec(cell.zone).label} · ${getCellCaption(cell, base)}`}
          </Text>
        </Billboard>
      )}

      {/* 命中区：必须保持 visible（three 射线检测跳过不可见物体，
          旧写法 visible=false 让地块点击完全失效），用透明材质隐形。 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.014, 0]}
      >
        <circleGeometry args={[interactionRadius * 1.1, 20]} />
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
      <FactoryConnections base={base} layouts={layouts} />

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
