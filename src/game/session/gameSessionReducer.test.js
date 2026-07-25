import { describe, expect, it } from 'vitest';
import { GAME_PHASES } from './gamePhases';
import {
  GAME_SESSION_ACTIONS,
  gameSessionReducer,
  initialGameSessionState,
} from './gameSessionReducer';
import {
  CRATER_ZONES,
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
