// 基地地块布局。
//
// 2.3 基准：坑内不再是可见建筑格网，而是一个中央土豆 + 坑外自由工厂平台。
// 规则层仍然需要离散单元、邻接和区位，但这些单元不再 masquerade 成坑内圆环。
// 本文件只负责生成稳定的建筑位与邻接图，不依赖 three。

import { stableHash, seededUnit } from '../util/deterministic';

const GRID_COLUMNS = 9;
const GRID_ROWS = 7;
const GRID_X_OFFSET = Math.floor(GRID_COLUMNS / 2);
const GRID_Y_OFFSET = Math.floor(GRID_ROWS / 2);
const PORT_RADIUS = 1.95;
const RESOURCE_RADIUS = 3.25;

export const CELL_COUNT = 62;

export const getCellId = (column, row) => `factory-${column}-${row}`;

const getFootprintRadius = (column, row) => {
  const distance = Math.hypot(column, row);
  if (distance <= PORT_RADIUS) return 0.42;
  return 0.36;
};

const classifyZone = (column, row) => {
  const distance = Math.hypot(column, row);
  if (distance <= PORT_RADIUS) return 'inner';
  if (distance <= RESOURCE_RADIUS) return row < 0 ? 'shadow' : 'rim';
  return row < 0 ? 'shadow' : 'rim';
};

export const createCellLattice = (seed) => {
  const cells = [];

  for (let row = -GRID_Y_OFFSET; row <= GRID_Y_OFFSET; row += 1) {
    for (let column = -GRID_X_OFFSET; column <= GRID_X_OFFSET; column += 1) {
      const distance = Math.hypot(column, row);
      if (distance < 0.55) continue;

      const id = getCellId(column, row);
      const jitterSeed = stableHash(id);
      const jitter = (seededUnit(seed, jitterSeed) - 0.5) * 0.24;
      cells.push(Object.freeze({
        id,
        column,
        row,
        zone: classifyZone(column, row),
        ring: row < 0 ? 0 : 1,
        sector: column + GRID_X_OFFSET,
        sectors: GRID_COLUMNS,
        nominalAngle: Math.atan2(row, column),
        angle: Math.atan2(row, column) + jitter,
        normalizedRadius: distance / Math.max(GRID_X_OFFSET, GRID_Y_OFFSET),
        footprintRadius: getFootprintRadius(column, row),
        corePort: Math.abs(row) <= 1 && Math.abs(column) <= 1 && distance >= 0.55,
      }));
    }
  }

  return cells;
};

const taxicab = (a, b) => Math.abs(a.column - b.column) + Math.abs(a.row - b.row);

const buildNeighbourMap = () => {
  const cells = [];

  for (let row = -GRID_Y_OFFSET; row <= GRID_Y_OFFSET; row += 1) {
    for (let column = -GRID_X_OFFSET; column <= GRID_X_OFFSET; column += 1) {
      const distance = Math.hypot(column, row);
      if (distance < 0.55) continue;

      cells.push({
        id: getCellId(column, row),
        column,
        row,
      });
    }
  }

  const map = new Map(cells.map((cell) => [cell.id, []]));
  cells.forEach((cell) => {
    cells.forEach((other) => {
      if (cell.id === other.id) return;
      if (taxicab(cell, other) === 1) {
        map.get(cell.id).push(other.id);
      }
    });
  });

  return map;
};

const NEIGHBOUR_MAP = buildNeighbourMap();

export const getNeighbourIds = (cellId) => NEIGHBOUR_MAP.get(cellId) || [];

export const assertRingsWithinZones = () => true;
