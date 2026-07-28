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
import { TERRAIN_RADIUS } from './terrainBands';
import SuperPotato, { PLANT_LABEL_HEIGHT } from './SuperPotato';
import FacilityModel from './FacilityModels';
import FactoryConnections from './FactoryConnections';
import { calculateCraterPosition } from './worldCoordinates';
import { createCellLattice } from '../economy/baseLayout';
import { canApplyTool } from '../economy/colonyEconomy';
import {
  FACILITY_SPECS,
  PLANTING_BED_ID,
  POTATO_STATUS,
  getZoneSpec,
} from '../economy/colonyState';
import { useCursorStore } from '../../store';

const LABEL_FONT_SIZE = 0.017;
const GRID_PITCH = TERRAIN_RADIUS * 0.4;
const GRID_CELL_SIZE = GRID_PITCH * 0.78;
const FACTORY_RADIUS = GRID_CELL_SIZE * 0.39;

// 7x7 方格的外环恰好提供 24 个建筑位，再在近侧中央追加一个
// 总线位。视觉网格围住坑体但不侵入坑内，规则邻接仍由 baseLayout
// 独立计算。
const GRID_COORDINATES = Object.freeze([
  ...Array.from({ length: 7 }, (_, index) => ({
    column: index - 3,
    row: -3,
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    column: 3,
    row: index - 2,
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    column: 2 - index,
    row: 3,
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    column: -3,
    row: 2 - index,
  })),
  { column: 0, row: 4 },
].map(Object.freeze));

const createExteriorVisualLayouts = (cells, seed) => {
  const layouts = new Map();
  const floor = sampleTerrain(0, 0, seed);
  const exteriorCells = cells.filter((cell) => cell.id !== PLANTING_BED_ID);

  layouts.set(PLANTING_BED_ID, {
    ...cells.find((cell) => cell.id === PLANTING_BED_ID),
    x: 0,
    z: 0,
    height: floor.height,
    visualKind: 'cultivation-core',
  });

  exteriorCells.forEach((cell, index) => {
    const { column, row } = GRID_COORDINATES[index];
    const x = column * GRID_PITCH;
    const z = row * GRID_PITCH;
    const angle = Math.atan2(z, x);
    const normalizedRadius = Math.hypot(x, z) / TERRAIN_RADIUS;
    const plain = sampleTerrain(normalizedRadius, angle, seed);

    layouts.set(cell.id, {
      ...cell,
      x,
      z,
      height: plain.height + 0.006,
      gridColumn: column,
      gridRow: row,
      visualKind: 'factory-grid',
    });
  });

  return layouts;
};

const IndustrialGrid = ({ layouts }) => {
  const factoryLayouts = [...layouts.values()]
    .filter((layout) => layout.visualKind === 'factory-grid');
  if (factoryLayouts.length === 0) return null;

  const coordinateMap = new Map(factoryLayouts.map((layout) => [
    `${layout.gridColumn}|${layout.gridRow}`,
    layout,
  ]));
  const links = factoryLayouts.flatMap((layout) => (
    [
      coordinateMap.get(`${layout.gridColumn + 1}|${layout.gridRow}`),
      coordinateMap.get(`${layout.gridColumn}|${layout.gridRow + 1}`),
    ].filter(Boolean).map((neighbour) => ({
      key: `${layout.id}|${neighbour.id}`,
      x: (layout.x + neighbour.x) / 2,
      z: (layout.z + neighbour.z) / 2,
      y: (layout.height + neighbour.height) / 2 + 0.003,
      horizontal: layout.gridRow === neighbour.gridRow,
    }))
  ));

  return (
    <group>
      {factoryLayouts.map((layout) => (
        <group
          key={layout.id}
          position={[layout.x, layout.height - 0.002, layout.z]}
        >
          <mesh raycast={() => null}>
            <boxGeometry args={[GRID_CELL_SIZE, 0.014, GRID_CELL_SIZE]} />
            <meshStandardMaterial
              color="#633724"
              roughness={0.74}
              metalness={0.3}
              transparent
              opacity={0.82}
            />
          </mesh>
          <mesh
            position={[0, 0.008, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <ringGeometry
              args={[GRID_CELL_SIZE * 0.39, GRID_CELL_SIZE * 0.47, 4]}
            />
            <meshBasicMaterial
              color="#b76d48"
              transparent
              opacity={0.2}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      {links.map((link) => (
        <mesh
          key={link.key}
          position={[link.x, link.y, link.z]}
          raycast={() => null}
        >
          <boxGeometry
            args={[
              link.horizontal ? GRID_PITCH - GRID_CELL_SIZE : 0.018,
              0.012,
              link.horizontal ? 0.018 : GRID_PITCH - GRID_CELL_SIZE,
            ]}
          />
          <meshStandardMaterial
            color="#70402c"
            roughness={0.68}
            metalness={0.38}
          />
        </mesh>
      ))}
    </group>
  );
};

const GridFace = ({ active, hovered, dimmed }) => {
  const ref = React.useRef();

  useFrame((state) => {
    if (!ref.current || !active) return;
    ref.current.material.opacity = 0.22
      + Math.sin(state.clock.elapsedTime * 3.6) * 0.08;
  });

  if (!active && !hovered) return null;

  return (
    <>
      <group position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh ref={ref}>
          <planeGeometry args={[GRID_CELL_SIZE, GRID_CELL_SIZE]} />
          <meshBasicMaterial
            color={active ? '#ffd4ad' : '#c67b57'}
            transparent
            opacity={dimmed ? 0.035 : active ? 0.3 : 0.1}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={active ? THREE.AdditiveBlending : THREE.NormalBlending}
            toneMapped={false}
          />
        </mesh>
        {active && (
          <mesh position={[0, 0, 0.001]}>
            <ringGeometry
              args={[GRID_CELL_SIZE * 0.41, GRID_CELL_SIZE * 0.49, 4]}
            />
            <meshBasicMaterial
              color="#fff0dd"
              transparent
              opacity={0.78}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        )}
      </group>
      {active && (
        <mesh position={[0, 0.074, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.009, 0.018, 0.12, 8]} />
          <meshBasicMaterial
            color="#fff1df"
            transparent
            opacity={0.62}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}
    </>
  );
};

const CoreSignal = ({ ready }) => {
  const ref = React.useRef();

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = state.clock.elapsedTime * 0.16;
    ref.current.material.opacity = ready
      ? 0.62 + Math.sin(state.clock.elapsedTime * 3) * 0.2
      : 0.2;
  });

  return (
    <mesh ref={ref} position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.18, 0.188, 64, 1, 0, Math.PI * 1.68]} />
      <meshBasicMaterial
        color={ready ? '#fff1c9' : '#a65d3e'}
        transparent
        opacity={0.2}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
};

const getCellCaption = (cell, base) => {
  if (!cell.cleared) return '待开垦';
  if (cell.isPlantingBed) {
    if (base.potato?.status === POTATO_STATUS.READY) return '可收获';
    if (base.potato) return `${Math.round(base.potato.growth)}%`;
    return '培育核心';
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
  const eligible = selectedTool
    ? canApplyTool(colony, cell.id, selectedTool)
    : false;
  const dimmed = Boolean(selectedTool) && !eligible;
  const isCore = cell.id === PLANTING_BED_ID;
  const isReady = isCore && base.potato?.status === POTATO_STATUS.READY;
  const showLabel = hovered || eligible || isReady;

  return (
    <group
      position={[layout.x, layout.height + 0.004, layout.z]}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (selectedTool && !eligible) return;
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
      {isCore ? (
        <>
          <CoreSignal ready={isReady} />
          {base.potato && (
            <SuperPotato
              growth={base.potato.growth}
              quality={base.potato.quality}
              seed={seed}
            />
          )}
        </>
      ) : (
        <>
          <GridFace active={eligible} hovered={hovered} dimmed={dimmed} />
          {cell.facility && (
            <FacilityModel
              facility={cell.facility}
              radius={FACTORY_RADIUS}
              facilitiesIdle={base.facilitiesIdle}
            />
          )}
        </>
      )}

      {showLabel && (
        <Billboard
          position={[
            0,
            isCore && base.potato
              ? PLANT_LABEL_HEIGHT
              : FACTORY_RADIUS * 1.45,
            0,
          ]}
        >
          <Text
            fontSize={isCore ? LABEL_FONT_SIZE * 1.35 : LABEL_FONT_SIZE}
            color="#fff0e2"
            outlineColor="#3f1d0d"
            outlineWidth={0.002}
            anchorX="center"
            anchorY="middle"
          >
            {isCore
              ? getCellCaption(cell, base)
              : `${getZoneSpec(cell.zone).label} · ${getCellCaption(cell, base)}`}
          </Text>
        </Billboard>
      )}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.012, 0]}
      >
        {isCore
          ? <circleGeometry args={[0.21, 28]} />
          : <planeGeometry args={[GRID_PITCH, GRID_PITCH]} />}
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
  const seed = useMemo(() => getCraterSeed(crater), [crater]);
  const displayScale = useMemo(
    () => getCraterDisplayScale(crater),
    [crater]
  );
  const mountRadius = useMemo(
    () => getCraterMountRadius(crater),
    [crater]
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
    [crater]
  );
  const blendTexture = useMemo(() => createBlendTexture(seed), [seed]);
  const detailTexture = useMemo(() => createRockDetailTexture(seed), [seed]);
  const layouts = useMemo(
    () => createExteriorVisualLayouts(createCellLattice(base.seed), seed),
    [base.seed, seed]
  );

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
      <IndustrialGrid layouts={layouts} />
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
