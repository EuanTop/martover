// 基地地块网格。26 格极坐标晶格，取代旧的 6 格硬编码角度表。
//
// 旧实现（FarmScene.PLOT_ANGLES）是 id → 弧度的硬编码映射且无回退：
// 任何不在表里的地块 id 会得到 undefined → NaN 坐标 → 该格静默消失。
// 这里改为从环定义推导，未知 id 结构上不可能出现。
//
// 本文件不 import three：邻接判定属于游戏规则，经济层与其测试
// 都要用，不能被 3D 依赖拖累。分带常量来自 world/terrainBands.js。

import { stableHash, seededUnit } from '../util/deterministic';
import { ZONE_BANDS } from '../world/terrainBands';

const TAU = Math.PI * 2;

// 每环的扇区数与角度偏移。inner/outer 严格落在 ZONE_BANDS 的三个
// 区间内（见下方 assertRingsWithinZones），因此「坑底」的格子真的
// 在坑底地形上。offset 让相邻环互相错开，避免所有格连成一条辐条。
export const CELL_RINGS = Object.freeze([
  { zone: 'floor', ring: 0, sectors: 3, inner: 0.06, outer: 0.18, offset: 0.4 },
  { zone: 'floor', ring: 1, sectors: 5, inner: 0.18, outer: 0.3, offset: 0.18 },
  { zone: 'shadow', ring: 2, sectors: 6, inner: 0.4, outer: 0.54, offset: 0.52 },
  { zone: 'shadow', ring: 3, sectors: 6, inner: 0.54, outer: 0.68, offset: 0 },
  { zone: 'rim', ring: 4, sectors: 6, inner: 0.74, outer: 0.84, offset: 0.52 },
].map(Object.freeze));

export const CELL_COUNT = CELL_RINGS.reduce(
  (total, ring) => total + ring.sectors,
  0
);

// 视觉抖动上限，以扇区宽度为单位。必须严格小于邻接阈值
// （NEIGHBOUR_ANGLE_FACTOR），否则抖动会改变邻接关系 —— 邻接是
// 游戏规则（设施覆盖、劳力折扣、基因干预向量都读它），不能随机。
const JITTER_SECTOR_FRACTION = 0.25;

// 跨环邻接的角度阈值，以较粗那一环的扇区宽度为单位。
const NEIGHBOUR_ANGLE_FACTOR = 0.5;

// 格子外接圆相对可用空间的收缩系数，留出格间视觉间隙。
const FOOTPRINT_MARGIN = 0.86;

export const getCellId = (zone, ring, sector) => `${zone}-${ring}-${sector}`;

const getRingSpec = (ring) => CELL_RINGS.find((spec) => spec.ring === ring);

// 标称角（不含抖动）。邻接判定只用这个值。
const getNominalAngle = (spec, sector) => (
  (spec.offset + (TAU * sector) / spec.sectors) % TAU
);

// 格子外接圆半径：径向不超过环宽的一半，切向不超过半个扇区弧长。
const getFootprintRadius = (spec) => {
  const midRadius = (spec.inner + spec.outer) / 2;
  const radialLimit = (spec.outer - spec.inner) / 2;
  const tangentialLimit = (Math.PI / spec.sectors) * midRadius;

  return Math.min(radialLimit, tangentialLimit) * FOOTPRINT_MARGIN;
};

// 生成全部格子。angle 含视觉抖动，nominalAngle 供邻接判定。
export const createCellLattice = (seed) => CELL_RINGS.flatMap((spec) => (
  Array.from({ length: spec.sectors }, (_, sector) => {
    const id = getCellId(spec.zone, spec.ring, sector);
    // 抖动的下标用 stableHash(id)。旧实现用 plot.id.length，
    // 同长度的 id 会拿到完全相同的抖动。
    const jitterLimit = JITTER_SECTOR_FRACTION * (TAU / spec.sectors);
    const jitter = (seededUnit(seed, stableHash(id)) - 0.5) * 2 * jitterLimit;
    const nominalAngle = getNominalAngle(spec, sector);

    return Object.freeze({
      id,
      zone: spec.zone,
      ring: spec.ring,
      sector,
      sectors: spec.sectors,
      nominalAngle,
      angle: (nominalAngle + jitter + TAU) % TAU,
      normalizedRadius: (spec.inner + spec.outer) / 2,
      footprintRadius: getFootprintRadius(spec),
    });
  })
));

// 两角之间的最短夹角。
const angularGap = (a, b) => {
  const raw = Math.abs(a - b);
  return Math.min(raw, TAU - raw);
};

// 邻接表：同环左右相邻 + 跨一环且标称角足够接近。
// 用标称角而非抖动后的角，保证邻接与 seed 无关。
const buildNeighbourMap = () => {
  const cells = CELL_RINGS.flatMap((spec) => (
    Array.from({ length: spec.sectors }, (_, sector) => ({
      id: getCellId(spec.zone, spec.ring, sector),
      ring: spec.ring,
      sector,
      sectors: spec.sectors,
      nominalAngle: getNominalAngle(spec, sector),
    }))
  ));

  const map = new Map(cells.map((cell) => [cell.id, []]));

  cells.forEach((cell) => {
    cells.forEach((other) => {
      if (other.id === cell.id) return;

      if (other.ring === cell.ring) {
        const step = (other.sector - cell.sector + cell.sectors) % cell.sectors;
        if (step === 1 || step === cell.sectors - 1) {
          map.get(cell.id).push(other.id);
        }
        return;
      }

      if (Math.abs(other.ring - cell.ring) !== 1) return;

      // 阈值用较粗（扇区少）那一环的扇区宽度，两个方向判定一致，
      // 邻接关系因此天然对称。
      const coarseSectors = Math.min(other.sectors, cell.sectors);
      const threshold = (TAU / coarseSectors) * NEIGHBOUR_ANGLE_FACTOR;

      if (angularGap(cell.nominalAngle, other.nominalAngle) < threshold) {
        map.get(cell.id).push(other.id);
      }
    });
  });

  return map;
};

// 邻接表与 seed 无关，因此模块级算一次即可。
const NEIGHBOUR_MAP = buildNeighbourMap();

export const getNeighbourIds = (cellId) => NEIGHBOUR_MAP.get(cellId) || [];

// 每环是否落在自己 zone 的分带内。测试用，也是改环定义时的护栏。
export const assertRingsWithinZones = () => CELL_RINGS.every((spec) => {
  const band = ZONE_BANDS[spec.zone];
  return Boolean(band) && spec.inner >= band.inner && spec.outer <= band.outer;
});
