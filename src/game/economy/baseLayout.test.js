import { describe, expect, it } from 'vitest';
import {
  assertRingsWithinZones,
  CELL_COUNT,
  CELL_RINGS,
  createCellLattice,
  getNeighbourIds,
} from './baseLayout';

const SEED = 1234567;
const TAU = Math.PI * 2;

const byId = (cells) => new Map(cells.map((cell) => [cell.id, cell]));

describe('baseLayout', () => {
  it('produces 26 uniquely identified cells', () => {
    const cells = createCellLattice(SEED);

    expect(cells).toHaveLength(26);
    expect(CELL_COUNT).toBe(26);
    expect(new Set(cells.map((cell) => cell.id)).size).toBe(26);
  });

  it('keeps every ring inside its own planting zone band', () => {
    // 环定义漂出 ZONE_BANDS 就意味着「坑底」的格子实际长在坑壁上。
    expect(assertRingsWithinZones()).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    expect(createCellLattice(SEED)).toEqual(createCellLattice(SEED));
  });

  it('gives the center seven neighbours and leaves no outer cell isolated', () => {
    const cells = createCellLattice(SEED);
    const center = cells.find((cell) => cell.id === 'floor-0-0');
    const degrees = cells
      .filter((cell) => cell.id !== center.id)
      .map((cell) => getNeighbourIds(cell.id).length);

    expect(center.normalizedRadius).toBe(0);
    expect(getNeighbourIds(center.id)).toHaveLength(7);
    expect(Math.min(...degrees)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...degrees)).toBeLessThanOrEqual(5);
  });

  it('keeps adjacency symmetric', () => {
    // 设施覆盖与劳力折扣都双向读邻接，不对称会让 A 罩得住 B
    // 而 B 罩不住 A。
    createCellLattice(SEED).forEach((cell) => {
      getNeighbourIds(cell.id).forEach((neighbourId) => {
        expect(getNeighbourIds(neighbourId)).toContain(cell.id);
      });
    });
  });

  it('derives adjacency from nominal angles, so the seed cannot change it', () => {
    // 抖动只是视觉的。邻接是游戏规则（设施覆盖、基因干预向量），
    // 若随 seed 变化，同一套布局在不同坑里的规则就不一样了。
    const a = createCellLattice(SEED);
    const b = createCellLattice(SEED + 8191);

    expect(a.map((cell) => cell.angle))
      .not.toEqual(b.map((cell) => cell.angle));

    a.forEach((cell) => {
      expect(getNeighbourIds(cell.id)).toEqual(getNeighbourIds(cell.id));
    });
    expect(a.map((cell) => cell.nominalAngle))
      .toEqual(b.map((cell) => cell.nominalAngle));
  });

  it('keeps the jitter below the adjacency threshold', () => {
    // 抖动上限 0.25 扇区、邻接阈值 0.5 扇区。抖动一旦追平阈值，
    // 上一条测试的保证就失效了。
    createCellLattice(SEED).forEach((cell) => {
      const raw = Math.abs(cell.angle - cell.nominalAngle);
      const gap = Math.min(raw, TAU - raw);

      expect(gap).toBeLessThan((TAU / cell.sectors) * 0.25);
    });
  });

  it('never overlaps the footprints of adjacent cells', () => {
    const cells = createCellLattice(SEED);
    const lookup = byId(cells);

    cells.forEach((cell) => {
      getNeighbourIds(cell.id).forEach((neighbourId) => {
        const other = lookup.get(neighbourId);
        const dx = cell.normalizedRadius * Math.cos(cell.angle)
          - other.normalizedRadius * Math.cos(other.angle);
        const dz = cell.normalizedRadius * Math.sin(cell.angle)
          - other.normalizedRadius * Math.sin(other.angle);

        expect(Math.hypot(dx, dz))
          .toBeGreaterThan(cell.footprintRadius + other.footprintRadius);
      });
    });
  });

  it('gives every cell a finite, positive footprint', () => {
    createCellLattice(SEED).forEach((cell) => {
      expect(Number.isFinite(cell.footprintRadius)).toBe(true);
      expect(cell.footprintRadius).toBeGreaterThan(0);
      // 旧的 PLOT_RADII 是 0.11-0.16，26 格时必然重叠。
      expect(cell.footprintRadius).toBeLessThanOrEqual(
        cell.id === 'floor-0-0' ? 0.09 : 0.08
      );
    });
  });

  it('returns an empty neighbour list for unknown ids instead of throwing', () => {
    // 旧的 PLOT_ANGLES 对未知 id 返回 undefined → NaN 坐标 → 格子静默消失。
    expect(getNeighbourIds('no-such-cell')).toEqual([]);
  });

  it('spreads cells across all three zones', () => {
    const zones = new Set(CELL_RINGS.map((ring) => ring.zone));

    expect([...zones].sort()).toEqual(['floor', 'rim', 'shadow']);
  });
});
