import { describe, expect, it } from 'vitest';
import {
  advancePlanting,
  canCompletePlantingCycle,
  chooseIntervention,
  configurePlanting,
  createPlantingCycle,
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
