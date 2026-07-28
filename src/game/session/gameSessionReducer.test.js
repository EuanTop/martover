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
  createBreedingSimulation,
  PRESERVED_SAMPLE_LIMIT,
  TUBER_USES,
  VIEW_MODES,
} from '../simulation/breedingSimulation';
import {
  PLANTING_BED_ID,
  POTATO_STATUS,
  SPEED_STEPS,
  TOOL_MODES,
} from '../economy/colonyState';

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

// 2.0 转向后 BEGIN_BREEDING 进入经营模式；育种子系统的 reducer
// 分支（喂食、衰减、回退）仍然存在，测试通过直接注入模拟状态驱动。
const startBreedingState = () => ({
  ...initialGameSessionState,
  selectedCrater: crater,
  phase: GAME_PHASES.POTATO_BREEDING,
  viewMode: VIEW_MODES.CRATER,
  simulation: createBreedingSimulation(
    crater,
    1,
    initialGameSessionState.human,
    null,
    initialGameSessionState.resources
  ),
});

describe('gameSessionReducer', () => {
  it('enters colony mode with a live base when a crater is confirmed', () => {
    let state = reduce(
      initialGameSessionState,
      GAME_SESSION_ACTIONS.SELECT_CRATER,
      crater
    );
    state = reduce(state, GAME_SESSION_ACTIONS.BEGIN_BREEDING);

    expect(state.viewMode).toBe(VIEW_MODES.CRATER);
    expect(state.colony).not.toBeNull();
    expect(state.simulation).toBeNull();
    expect(state.colony.contracts).toHaveLength(3);
    // 26 格全部存在，不再有永久锁死的地块。
    expect(state.colony.bases['base-01'].cells).toHaveLength(26);
  });

  it('advances the colony clock and plants the single super potato', () => {
    let state = reduce(
      initialGameSessionState,
      GAME_SESSION_ACTIONS.SELECT_CRATER,
      crater
    );
    state = reduce(state, GAME_SESSION_ACTIONS.BEGIN_BREEDING);
    state = reduce(state, GAME_SESSION_ACTIONS.COLONY_CELL_ACTION, {
      cellId: PLANTING_BED_ID,
      tool: TOOL_MODES.PLANT,
    });

    // 一个坑只有一棵超级土豆，长在唯一的种植床上。
    expect(state.colony.bases['base-01'].potato.status)
      .toBe(POTATO_STATUS.GROWING);

    const solBefore = state.colony.sol;
    state = reduce(state, GAME_SESSION_ACTIONS.TICK);

    expect(state.colony.sol).toBe(solBefore + 1);
  });

  it('keeps state identity when a cell tool is rejected', () => {
    // 引用相等是「这次点击没生效」的信号，React 层因此不重渲染。
    let state = reduce(
      initialGameSessionState,
      GAME_SESSION_ACTIONS.SELECT_CRATER,
      crater
    );
    state = reduce(state, GAME_SESSION_ACTIONS.BEGIN_BREEDING);

    // rim-4-0 未开垦，不能直接播种。
    const rejected = reduce(state, GAME_SESSION_ACTIONS.COLONY_CELL_ACTION, {
      cellId: 'rim-4-0',
      tool: TOOL_MODES.PLANT,
    });

    expect(rejected).toBe(state);
  });

  it('runs one generation from planting to a persistent human response', () => {
    let state = startBreedingState();
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

  it('keeps a selected crater from starting a run until confirmed', () => {    const selected = reduce(
      initialGameSessionState,
      GAME_SESSION_ACTIONS.SELECT_CRATER,
      crater
    );

    expect(selected.viewMode).toBe(VIEW_MODES.PLANET);
    expect(selected.simulation).toBeNull();
    expect(selected.colony).toBeNull();
  });

  const runToAllocation = (assign) => {
    let state = startBreedingState();
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

describe('colony clock', () => {
  const startColony = () => {
    let state = reduce(
      initialGameSessionState,
      GAME_SESSION_ACTIONS.SELECT_CRATER,
      crater
    );
    return reduce(state, GAME_SESSION_ACTIONS.BEGIN_BREEDING);
  };

  it('waits at SOL 00 until the first accepted base command', () => {
    const state = startColony();

    expect(state.colony.clock).toEqual({ started: false, speed: 1 });
    expect(reduce(state, GAME_SESSION_ACTIONS.TICK)).toBe(state);
  });

  it('clamps speed to the allowed debug steps without starting the clock', () => {
    let state = startColony();

    state = reduce(state, GAME_SESSION_ACTIONS.COLONY_SET_SPEED, 4);
    expect(state.colony.clock.speed).toBe(4);
    expect(state.colony.clock.started).toBe(false);

    state = reduce(state, GAME_SESSION_ACTIONS.COLONY_SET_SPEED, 99);
    expect(SPEED_STEPS).toContain(state.colony.clock.speed);
  });

  it('starts on the first accepted cell action and keeps running', () => {
    let state = startColony();
    state = reduce(state, GAME_SESSION_ACTIONS.COLONY_CELL_ACTION, {
      cellId: 'shadow-2-0',
      tool: TOOL_MODES.BUILD_EXTRACTOR,
    });

    expect(state.colony.clock.started).toBe(true);

    state = reduce(state, GAME_SESSION_ACTIONS.TICK);
    state = reduce(state, GAME_SESSION_ACTIONS.TICK);

    expect(state.colony.sol).toBe(2);
    expect(state.colony.bases['base-01'].cells.find(
      (cell) => cell.id === 'shadow-2-0'
    ).facility.completedSol).toBe(2);
    expect(state.colony.clock.started).toBe(true);
  });

  it('does not start after a rejected cell action', () => {
    const state = startColony();
    const rejected = reduce(state, GAME_SESSION_ACTIONS.COLONY_CELL_ACTION, {
      cellId: 'rim-4-0',
      tool: TOOL_MODES.PLANT,
    });

    expect(rejected).toBe(state);
    expect(rejected.colony.clock.started).toBe(false);
  });

  it('continues through urgent resource states without hidden pausing', () => {
    let state = startColony();
    const patchStores = (s, stores) => ({
      ...s,
      colony: {
        ...s.colony,
        bases: {
          ...s.colony.bases,
          'base-01': {
            ...s.colony.bases['base-01'],
            stores: { ...s.colony.bases['base-01'].stores, ...stores },
          },
        },
      },
    });

    // 没作物、没种薯但手上有块茎：可恢复，但需要玩家立刻决策。
    state = patchStores(state, { seedStock: 0, tubers: 8 });
    state = reduce(state, GAME_SESSION_ACTIONS.COLONY_CELL_ACTION, {
      cellId: 'shadow-2-0',
      tool: TOOL_MODES.BUILD_EXTRACTOR,
    });
    state = reduce(state, GAME_SESSION_ACTIONS.TICK);

    expect(state.colony.outcome).toBeNull();
    expect(state.colony.clock.started).toBe(true);
  });
});
