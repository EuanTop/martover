import { describe, expect, it } from 'vitest';
import {
  assertRingsWithinZones,
  CELL_COUNT,
  createCellLattice,
  getNeighbourIds,
} from './baseLayout';

const SEED = 1234567;
const TAU = Math.PI * 2;

describe('baseLayout', () => {
  it('produces 62 uniquely identified exterior factory cells', () => {
    const cells = createCellLattice(SEED);

    expect(cells).toHaveLength(62);
    expect(CELL_COUNT).toBe(62);
    expect(new Set(cells.map((cell) => cell.id)).size).toBe(62);
    expect(cells.some((cell) => cell.id === 'core-0-0')).toBe(false);
    expect(cells.every((cell) => cell.id.startsWith('factory-'))).toBe(true);
  });

  it('keeps compatibility zone assertion true while the core is a separate cell', () => {
    expect(assertRingsWithinZones()).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    expect(createCellLattice(SEED)).toEqual(createCellLattice(SEED));
  });

  it('creates eight cultivation ports around the central potato', () => {
    const ports = createCellLattice(SEED).filter((cell) => cell.corePort);

    expect(ports).toHaveLength(8);
    expect(ports.every((cell) => cell.zone === 'inner')).toBe(true);
    expect(new Set(ports.map((cell) => `${cell.column}|${cell.row}`))).toEqual(
      new Set([
        '-1|-1', '0|-1', '1|-1',
        '-1|0', '1|0',
        '-1|1', '0|1', '1|1',
      ])
    );
  });

  it('leaves no exterior platform cell isolated', () => {
    const degrees = createCellLattice(SEED)
      .map((cell) => getNeighbourIds(cell.id).length);

    expect(Math.min(...degrees)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...degrees)).toBeLessThanOrEqual(4);
  });

  it('keeps adjacency symmetric', () => {
    createCellLattice(SEED).forEach((cell) => {
      getNeighbourIds(cell.id).forEach((neighbourId) => {
        expect(getNeighbourIds(neighbourId)).toContain(cell.id);
      });
    });
  });

  it('derives adjacency from grid coordinates, so the seed cannot change it', () => {
    const a = createCellLattice(SEED);
    const b = createCellLattice(SEED + 8191);

    expect(a.map((cell) => cell.angle))
      .not.toEqual(b.map((cell) => cell.angle));
    expect(a.map((cell) => [cell.id, cell.column, cell.row, cell.nominalAngle]))
      .toEqual(b.map((cell) => [cell.id, cell.column, cell.row, cell.nominalAngle]));
    a.forEach((cell) => {
      expect(getNeighbourIds(cell.id)).toEqual(getNeighbourIds(cell.id));
    });
  });

  it('keeps visual jitter small enough to remain a visual-only offset', () => {
    createCellLattice(SEED).forEach((cell) => {
      const raw = Math.abs(cell.angle - cell.nominalAngle);
      const gap = Math.min(raw, TAU - raw);

      expect(gap).toBeLessThan((TAU / cell.sectors) * 0.25);
    });
  });

  it('gives every exterior platform cell a finite, positive footprint', () => {
    createCellLattice(SEED).forEach((cell) => {
      expect(Number.isFinite(cell.footprintRadius)).toBe(true);
      expect(cell.footprintRadius).toBeGreaterThan(0);
      expect(cell.footprintRadius).toBeLessThanOrEqual(0.42);
    });
  });

  it('returns an empty neighbour list for unknown ids instead of throwing', () => {
    expect(getNeighbourIds('no-such-cell')).toEqual([]);
  });

  it('spreads exterior cells across factory zones', () => {
    const zones = new Set(createCellLattice(SEED).map((cell) => cell.zone));

    expect([...zones].sort()).toEqual(['inner', 'rim', 'shadow']);
  });
});
