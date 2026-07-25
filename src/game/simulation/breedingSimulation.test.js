import { describe, expect, it } from 'vitest';
import {
  advanceBreedingSimulation,
  applyIntervention,
  assignTuberUse,
  BREEDING_STAGES,
  canFeedHuman,
  createBreedingSimulation,
  CRATER_ZONES,
  harvestBreedingSimulation,
  INTERVENTION_TYPES,
  plantInZone,
  TUBER_USES,
} from './breedingSimulation';

const crater = {
  id: '01-000001',
  latitude: -61,
  longitude: 42,
  diameter: 24,
  layerNumber: 3,
  rimDegradation: 3,
  ejectaDegradation: 2,
  floorDegradation: 2,
  hasRd: true,
};

describe('breedingSimulation', () => {
  it('runs a planted generation forward without a next-sol command', () => {
    const created = createBreedingSimulation(crater);
    const planted = plantInZone(created, CRATER_ZONES.RIM);
    const afterSixSols = Array.from({ length: 6 }).reduce(
      (state) => advanceBreedingSimulation(state),
      planted
    );

    expect(planted.stage).toBe(BREEDING_STAGES.GROWING);
    expect(afterSixSols.sol).toBe(6);
    expect(afterSixSols.growth).toBe(20);
    expect(afterSixSols.events.at(-1).sol).toBe(6);
  });

  it('spends finite interventions and applies immediate readable feedback', () => {
    const planted = plantInZone(
      createBreedingSimulation(crater),
      CRATER_ZONES.SHADOW
    );
    const heated = applyIntervention(planted, INTERVENTION_TYPES.HEAT);

    expect(heated.resources.heat).toBe(1);
    expect(heated.interventions).toEqual([{ type: 'heat', sol: 0 }]);
    expect(heated.events.at(-1).kind).toBe('intervention');
  });

  it('requires every tuber plus seed and feed before the human stage', () => {
    const planted = plantInZone(
      createBreedingSimulation(crater),
      CRATER_ZONES.FLOOR
    );
    const mature = Array.from({ length: 24 }).reduce(
      (state) => advanceBreedingSimulation(state),
      planted
    );
    let harvested = harvestBreedingSimulation(mature, crater);

    harvested.tuberAssignments.forEach((_, index) => {
      harvested = assignTuberUse(
        harvested,
        index,
        index === 0 ? TUBER_USES.SEED : TUBER_USES.FEED
      );
    });

    expect(harvested.stage).toBe(BREEDING_STAGES.ALLOCATION);
    expect(harvested.harvestResult.tuberCount).toBeGreaterThan(2);
    expect(canFeedHuman(harvested)).toBe(true);
  });

  it('carries a selected parent sample into the next generation', () => {
    const parentSeed = {
      sampleId: 'G1-204',
      stability: 71,
      reproduction: 63,
      expression: 58,
      dominantTrait: 'dormancy',
      traits: ['dormancy'],
      lineageDepth: 1,
    };
    const planted = plantInZone(
      createBreedingSimulation(crater, 2, null, parentSeed),
      CRATER_ZONES.SHADOW
    );
    const mature = Array.from({ length: 24 }).reduce(
      (state) => advanceBreedingSimulation(state),
      planted
    );
    const harvested = harvestBreedingSimulation(mature, crater);

    expect(harvested.harvestResult.parentSampleId).toBe('G1-204');
    expect(harvested.harvestResult.lineageDepth).toBe(2);
    expect(harvested.harvestResult.traits).toContain('dormancy');
  });
});
