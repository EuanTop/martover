import { describe, expect, it } from 'vitest';
import { GAME_PHASES } from './gamePhases';
import {
  GAME_SESSION_ACTIONS,
  gameSessionReducer,
  initialGameSessionState,
  RUN_OUTCOMES,
} from './gameSessionReducer';
import {
  BREEDING_STAGES,
  CRATER_ZONES,
  PRESERVED_SAMPLE_LIMIT,
  TUBER_USES,
  VIEW_MODES,
} from '../simulation/breedingSimulation';

const crater = {
  id: '01-000001',
  latitude: -61,
  longitude: 42,
  diameter: 20,
  layerNumber: 3,
  rimDegradation: 3,
  ejectaDegradation: 3,
  floorDegradation: 2,
  hasRd: true,
};

const reduce = (state, type, payload) => (
  gameSessionReducer(state, { type, payload })
);

describe('gameSessionReducer', () => {
  it('runs one generation from the planet to a persistent human response', () => {
    let state = reduce(
      initialGameSessionState,
      GAME_SESSION_ACTIONS.SELECT_CRATER,
      crater
    );
    state = reduce(state, GAME_SESSION_ACTIONS.BEGIN_BREEDING);
    state = reduce(
      state,
      GAME_SESSION_ACTIONS.PLANT_IN_ZONE,
      CRATER_ZONES.RIM
    );

    for (let sol = 0; sol < 24; sol += 1) {
      state = reduce(state, GAME_SESSION_ACTIONS.TICK);
    }

    state = reduce(state, GAME_SESSION_ACTIONS.HARVEST);

    state.simulation.tuberAssignments.forEach((_, index) => {
      state = reduce(
        state,
        GAME_SESSION_ACTIONS.ASSIGN_TUBER,
        {
          index,
          use: index === 0 ? TUBER_USES.SEED : TUBER_USES.FEED,
        }
      );
    });

    state = reduce(state, GAME_SESSION_ACTIONS.FEED_HUMAN);

    expect(state.phase).toBe(GAME_PHASES.PRODUCTION);
    expect(state.viewMode).toBe(VIEW_MODES.HUMAN);
    expect(state.lineage).toHaveLength(1);
    expect(state.human.lastResponse.sensation).toBeTruthy();
  });

  it('keeps a selected crater from starting a run until confirmed', () => {
    const selected = reduce(
      initialGameSessionState,
      GAME_SESSION_ACTIONS.SELECT_CRATER,
      crater
    );

    expect(selected.viewMode).toBe(VIEW_MODES.PLANET);
    expect(selected.simulation).toBeNull();
  });

  const runToAllocation = (assign) => {
    let state = reduce(
      initialGameSessionState,
      GAME_SESSION_ACTIONS.SELECT_CRATER,
      crater
    );
    state = reduce(state, GAME_SESSION_ACTIONS.BEGIN_BREEDING);
    state = reduce(state, GAME_SESSION_ACTIONS.PLANT_IN_ZONE, CRATER_ZONES.FLOOR);

    for (let sol = 0; sol < 24; sol += 1) {
      state = reduce(state, GAME_SESSION_ACTIONS.TICK);
    }

    state = reduce(state, GAME_SESSION_ACTIONS.HARVEST);
    state.simulation.tuberAssignments.forEach((_, index) => {
      state = reduce(state, GAME_SESSION_ACTIONS.ASSIGN_TUBER, {
        index,
        use: assign(index, state.simulation.tuberAssignments.length),
      });
    });

    return reduce(state, GAME_SESSION_ACTIONS.FEED_HUMAN);
  };

  it('lets the tuber allocation change the next generation', () => {
    // 旧实现把 tuberAssignments 存进存档后再无任何代码读取，
    // 分配几颗留种完全不影响结果。
    const oneSeed = runToAllocation((index) => (
      index === 0 ? TUBER_USES.SEED : TUBER_USES.FEED
    ));
    const manySeed = runToAllocation((index, total) => {
      if (index < total - 1) return TUBER_USES.SEED;
      return TUBER_USES.FEED;
    });

    expect(oneSeed.parentSeed.seedCount).toBe(1);
    expect(manySeed.parentSeed.seedCount).toBeGreaterThan(1);
    expect(manySeed.parentSeed.seedVigorBonus)
      .toBeGreaterThan(oneSeed.parentSeed.seedVigorBonus);
    expect(manySeed.resources.water)
      .toBeGreaterThan(oneSeed.resources.water);
  });

  it('reveals hidden genome dimensions only when a tuber is dissected', () => {
    const dissected = runToAllocation((index) => {
      if (index === 0) return TUBER_USES.SEED;
      if (index === 1) return TUBER_USES.DISSECT;
      return TUBER_USES.FEED;
    });
    const untouched = runToAllocation((index) => (
      index === 0 ? TUBER_USES.SEED : TUBER_USES.FEED
    ));

    expect(dissected.parentSeed.revealedDimensions.length).toBeGreaterThan(0);
    expect(untouched.parentSeed.revealedDimensions).toEqual([]);
  });

  it('banks preserved samples up to the inventory limit', () => {
    const preserved = runToAllocation((index) => {
      if (index === 0) return TUBER_USES.SEED;
      if (index === 1) return TUBER_USES.FEED;
      return TUBER_USES.PRESERVE;
    });

    expect(preserved.preservedSamples.length).toBeGreaterThan(0);
    expect(preserved.preservedSamples.length)
      .toBeLessThanOrEqual(PRESERVED_SAMPLE_LIMIT);
  });

  it('decays the subject every generation instead of only improving them', () => {
    const fed = runToAllocation((index) => (
      index === 0 ? TUBER_USES.SEED : TUBER_USES.FEED
    ));
    const next = reduce(fed, GAME_SESSION_ACTIONS.START_NEXT_GENERATION);

    expect(next.human.vitality).toBeLessThan(fed.human.vitality);
    expect(next.human.biologicalAge).toBeGreaterThan(fed.human.biologicalAge);
  });

  it('ends the run when the subject can no longer take a generation', () => {
    const fed = runToAllocation((index) => (
      index === 0 ? TUBER_USES.SEED : TUBER_USES.FEED
    ));
    const dying = reduce(
      { ...fed, human: { ...fed.human, vitality: 4 } },
      GAME_SESSION_ACTIONS.START_NEXT_GENERATION
    );

    expect(dying.outcome).toBe(RUN_OUTCOMES.HUMAN_LOST);
    expect(dying.simulation).toBeNull();
  });

  it('falls back to a preserved sample after a failed generation', () => {
    const fallback = { sampleId: 'G2-410', genome: null };
    const recovered = reduce({
      ...initialGameSessionState,
      generation: 3,
      viewMode: VIEW_MODES.CRATER,
      preservedSamples: [fallback],
      simulation: { stage: BREEDING_STAGES.FAILED, harvestResult: {}, events: [] },
    }, GAME_SESSION_ACTIONS.RECOVER_FROM_FAILURE);

    expect(recovered.parentSeed).toBe(fallback);
    expect(recovered.preservedSamples).toEqual([]);
    expect(recovered.generation).toBe(4);
    expect(recovered.outcome).toBe(RUN_OUTCOMES.ACTIVE);
  });

  it('ends the run when a generation fails with an empty sample bank', () => {
    const lost = reduce({
      ...initialGameSessionState,
      viewMode: VIEW_MODES.CRATER,
      preservedSamples: [],
      simulation: { stage: BREEDING_STAGES.FAILED, harvestResult: {}, events: [] },
    }, GAME_SESSION_ACTIONS.RECOVER_FROM_FAILURE);

    expect(lost.outcome).toBe(RUN_OUTCOMES.LINEAGE_LOST);
  });

  it('returns to the same planet for the next generation', () => {
    const nextState = reduce({
      ...initialGameSessionState,
      phase: GAME_PHASES.PRODUCTION,
      viewMode: VIEW_MODES.HUMAN,
      generation: 1,
      parentSeed: { sampleId: 'G1-101' },
    }, GAME_SESSION_ACTIONS.START_NEXT_GENERATION);

    expect(nextState).toMatchObject({
      phase: GAME_PHASES.CRATER_SELECTION,
      viewMode: VIEW_MODES.PLANET,
      generation: 2,
      selectedCrater: null,
      simulation: null,
    });
  });
});
