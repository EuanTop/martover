import { describe, expect, it } from 'vitest';
import { GAME_PHASES } from './gamePhases';
import {
  GAME_SESSION_ACTIONS,
  gameSessionReducer,
  initialGameSessionState,
} from './gameSessionReducer';

describe('gameSessionReducer', () => {
  it('moves one run from crater selection through breeding to production', () => {
    const crater = {
      id: '01-000001',
      latitude: -61,
      diameter: 20,
      layerNumber: 3,
      rimDegradation: 3,
      ejectaDegradation: 3,
      floorDegradation: 2,
      hasRd: true,
    };
    const potato = { id: 7, specialParam: '测试性状' };

    const withCrater = gameSessionReducer(initialGameSessionState, {
      type: GAME_SESSION_ACTIONS.SELECT_CRATER,
      payload: crater,
    });
    const breeding = gameSessionReducer(withCrater, {
      type: GAME_SESSION_ACTIONS.BEGIN_BREEDING,
    });
    const started = gameSessionReducer(breeding, {
      type: GAME_SESSION_ACTIONS.START_PLANTING,
    });
    const sol2 = gameSessionReducer(started, {
      type: GAME_SESSION_ACTIONS.ADVANCE_PLANTING,
    });
    const intervened = gameSessionReducer(sol2, {
      type: GAME_SESSION_ACTIONS.CHOOSE_INTERVENTION,
      payload: 'stabilize',
    });
    const sol3 = gameSessionReducer(intervened, {
      type: GAME_SESSION_ACTIONS.ADVANCE_PLANTING,
    });
    const harvested = gameSessionReducer(sol3, {
      type: GAME_SESSION_ACTIONS.HARVEST_PLANTING,
      payload: 4,
    });
    const production = gameSessionReducer(harvested, {
      type: GAME_SESSION_ACTIONS.COMPLETE_BREEDING,
      payload: potato,
    });

    expect(breeding).toMatchObject({
      phase: GAME_PHASES.POTATO_BREEDING,
      selectedCrater: crater,
    });
    expect(production).toMatchObject({
      phase: GAME_PHASES.PRODUCTION,
      selectedCrater: crater,
      selectedPotato: potato,
      generation: 2,
    });
    expect(production.lineage).toHaveLength(1);
    expect(production.selectedPotato.tuberCount).toBeGreaterThan(0);
  });

  it('does not begin breeding before a crater is selected', () => {
    const nextState = gameSessionReducer(initialGameSessionState, {
      type: GAME_SESSION_ACTIONS.BEGIN_BREEDING,
    });

    expect(nextState).toBe(initialGameSessionState);
  });

  it('does not complete breeding while harvested tubers are unallocated', () => {
    const incompleteState = {
      ...initialGameSessionState,
      phase: GAME_PHASES.POTATO_BREEDING,
      planting: {
        status: 'allocation',
        harvestResult: { tuberCount: 4 },
        allocation: {
          seed: 1,
          feed: 1,
          dissect: 0,
          preserve: 0,
        },
      },
    };

    const nextState = gameSessionReducer(incompleteState, {
      type: GAME_SESSION_ACTIONS.COMPLETE_BREEDING,
      payload: { id: 7 },
    });

    expect(nextState).toBe(incompleteState);
  });
});
