import { describe, expect, it } from 'vitest';
import {
  advancePlanting,
  canCompletePlantingCycle,
  chooseIntervention,
  configurePlanting,
  createPlantingCycle,
  deriveCraterEnvironment,
  harvestPlanting,
  INTERVENTIONS,
  PLANTING_LAYERS,
  startPlanting,
  updateAllocation,
  WATER_LEVELS,
} from './plantingEngine';

const crater = {
  id: '16-1-008565',
  latitude: -61.108,
  diameter: 19.37,
  layerNumber: 3,
  rimDegradation: 4,
  ejectaDegradation: 3,
  floorDegradation: 4,
  hasRd: true,
  internalMorph: ['CpxCPt'],
};

const growToSol3 = (config = {}) => {
  const configured = {
    ...createPlantingCycle(crater, 2),
    config: {
      layer: config.layer || PLANTING_LAYERS.MIDDLE,
      water: config.water || WATER_LEVELS.MEDIUM,
    },
  };
  const sol1 = startPlanting(configured);
  const sol2 = advancePlanting(sol1, crater);
  const intervened = chooseIntervention(
    sol2,
    config.intervention || INTERVENTIONS.STABILIZE
  );

  return advancePlanting(intervened, crater);
};

describe('plantingEngine', () => {
  it('resolves identical crater decisions deterministically', () => {
    const first = harvestPlanting(growToSol3(), crater, 4);
    const second = harvestPlanting(growToSol3(), crater, 4);

    expect(first.harvestResult).toEqual(second.harvestResult);
    expect(first.growthEvents).toEqual(second.growthEvents);
  });

  it('makes waiting stronger but less stable than the safe harvest', () => {
    const sol3 = growToSol3();
    const safe = harvestPlanting(sol3, crater, 3).harvestResult;
    const late = harvestPlanting(sol3, crater, 4).harvestResult;

    expect(late.tuberCount).toBeGreaterThanOrEqual(safe.tuberCount);
    expect(late.expression).toBeGreaterThan(safe.expression);
    expect(late.stability).toBeLessThan(safe.stability);
    expect(late.reproduction).toBeLessThan(safe.reproduction);
  });

  it('makes deep, well-watered planting safer than exposed low-water planting', () => {
    const safeCycle = growToSol3({
      layer: PLANTING_LAYERS.DEEP,
      water: WATER_LEVELS.HIGH,
      intervention: INTERVENTIONS.STABILIZE,
    });
    const riskyCycle = growToSol3({
      layer: PLANTING_LAYERS.SURFACE,
      water: WATER_LEVELS.LOW,
      intervention: INTERVENTIONS.PRESERVE_EXPRESSION,
    });
    const safe = harvestPlanting(safeCycle, crater, 3).harvestResult;
    const risky = harvestPlanting(riskyCycle, crater, 3).harvestResult;

    expect(safe.tuberCount).toBeGreaterThan(risky.tuberCount);
    expect(safe.stability).toBeGreaterThan(risky.stability);
    expect(safe.reproduction).toBeGreaterThan(risky.reproduction);
    expect(risky.expression).toBeGreaterThan(safe.expression);
  });

  it('requires every harvested tuber to be assigned and one to remain as seed', () => {
    const harvested = harvestPlanting(growToSol3(), crater, 3);
    expect(canCompletePlantingCycle(harvested)).toBe(true);

    let withoutSeed = harvested;
    while (withoutSeed.allocation.seed > 0) {
      withoutSeed = updateAllocation(withoutSeed, 'seed', -1);
    }

    expect(canCompletePlantingCycle(withoutSeed)).toBe(false);
  });

  it('ignores commands that do not belong to the current planting state', () => {
    const configuration = createPlantingCycle(crater);
    const invalidConfiguration = configurePlanting(
      configuration,
      'layer',
      'orbital'
    );
    const growth = startPlanting(configuration);
    const repeatedStart = startPlanting(growth);
    const invalidIntervention = chooseIntervention(
      advancePlanting(growth, crater),
      'accelerate'
    );
    const earlyHarvest = harvestPlanting(growth, crater, 3);

    expect(invalidConfiguration).toBe(configuration);
    expect(repeatedStart).toBe(growth);
    expect(invalidIntervention.intervention).toBeNull();
    expect(earlyHarvest).toBe(growth);
  });

  it('never allocates more tubers than were harvested', () => {
    const harvested = harvestPlanting(growToSol3(), crater, 3);
    const reduced = updateAllocation(harvested, 'preserve', -1);
    const overAllocated = updateAllocation(reduced, 'feed', 2);

    expect(overAllocated).toBe(reduced);
    expect(canCompletePlantingCycle(reduced)).toBe(false);
  });
});

describe('deriveCraterEnvironment', () => {
  it('reads the same layer count from raw CSV rows and normalized craters', () => {
    // 回归锁：CSV 的列名是 LAY_NUMBER，旧代码回退读的 NUMBER_LAYERS
    // 并不存在。直接传原始行的调用方会静默拿到 layerNumber=1，
    // 一次压平 water / geologicalComplexity / instability / layerDiversity。
    const raw = deriveCraterEnvironment({
      LAT_CIRC_IMG: -61.108,
      DIAM_CIRC_IMG: 19.37,
      LAY_NUMBER: 3,
      DEG_RIM: 4,
      DEG_EJC: 3,
      DEG_FLR: 4,
    });
    const normalized = deriveCraterEnvironment({
      latitude: -61.108,
      diameter: 19.37,
      layerNumber: 3,
      rimDegradation: 4,
      ejectaDegradation: 3,
      floorDegradation: 4,
    });

    expect(raw).toEqual(normalized);
    // layerNumber=1 时 layerDiversity 是 46，=3 时是 90。
    expect(raw.layerDiversity).toBeGreaterThan(60);
  });

  it('keeps every field inside 0..100', () => {
    // 补正项是加性的，极端输入不得把任何一维顶出量程。
    const extreme = deriveCraterEnvironment({
      latitude: -89.9,
      diameter: 900,
      layerNumber: 12,
      rimDegradation: 9,
      ejectaDegradation: 9,
      floorDegradation: 9,
      eccentricity: 1,
      diameterSD: 40,
      rimPoints: 900,
      lobeCount: 9,
      arc: 0,
      isRampart: true,
      isCircle: true,
      ejectaShape: 'BL',
      floorMorph: ['Terraced'],
    });

    Object.values(extreme).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });
  });

  it('spreads the previously degenerate fields across many distinct values', () => {
    // 扩维前，radiation / geologicalComplexity / layerDiversity 全部派生自
    // 1-4 的小整数列，实测 101 个真实坑只散出 7 / 6 / 4 个不同值 ——
    // 不同的坑玩起来会明显雷同。
    const craters = Array.from({ length: 40 }, (_, index) => ({
      latitude: -80 + index * 4,
      diameter: 2 + index * 1.1,
      layerNumber: (index % 4) + 1,
      rimDegradation: (index % 3) + 2,
      ejectaDegradation: (index % 2) + 2,
      floorDegradation: (index % 4) + 1,
      eccentricity: 0.1 + (index % 37) * 0.012,
      diameterSD: 0.03 + (index % 29) * 0.034,
      rimPoints: 13 + index * 6,
      lobeCount: (index % 3) + 1,
      arc: 0.74 + (index % 23) * 0.011,
      isRampart: index % 2 === 0,
    }));
    const distinct = (key) => new Set(
      craters.map((c) => deriveCraterEnvironment(c)[key].toFixed(4))
    ).size;

    expect(distinct('radiation')).toBeGreaterThanOrEqual(15);
    expect(distinct('instability')).toBeGreaterThanOrEqual(15);
    expect(distinct('geologicalComplexity')).toBeGreaterThanOrEqual(15);
  });

  it('degrades to the pre-enrichment behaviour when the new columns are absent', () => {
    // 补正项缺值时必须补 0（arc 补 1），否则老数据会算出 NaN。
    const sparse = deriveCraterEnvironment({
      latitude: 12,
      diameter: 8,
      layerNumber: 2,
    });

    Object.values(sparse).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
    });
  });

  it('scores a regular, terraced crater as more sheltered than a ragged one', () => {
    // shelter 让「坑缘有多危险」因坑而异，而不是所有坑共用一张伤害表。
    const sheltered = deriveCraterEnvironment({
      latitude: 10, diameter: 10, layerNumber: 2,
      isCircle: true, floorMorph: ['Terraced'], ejectaShape: 'BL',
    });
    const exposed = deriveCraterEnvironment({
      latitude: 10, diameter: 10, layerNumber: 2,
    });

    expect(sheltered.shelter).toBeGreaterThan(exposed.shelter);
  });
});
