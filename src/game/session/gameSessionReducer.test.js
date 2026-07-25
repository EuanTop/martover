import { describe, expect, it } from 'vitest';
import { GAME_PHASES } from './gamePhases';
import {
  GAME_SESSION_ACTIONS,
  gameSessionReducer,
  initialGameSessionState,
} from './gameSessionReducer';

describe('gameSessionReducer', () => {
  it('moves one run from crater selection through breeding to production', () => {
    const crater = { id: '01-000001' };
    const potato = { id: 7, specialParam: '测试性状' };

    const withCrater = gameSessionReducer(initialGameSessionState, {
      type: GAME_SESSION_ACTIONS.SELECT_CRATER,
      payload: crater,
    });
    const breeding = gameSessionReducer(withCrater, {
      type: GAME_SESSION_ACTIONS.BEGIN_BREEDING,
    });
    const production = gameSessionReducer(breeding, {
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
    });
  });

  it('does not begin breeding before a crater is selected', () => {
    const nextState = gameSessionReducer(initialGameSessionState, {
      type: GAME_SESSION_ACTIONS.BEGIN_BREEDING,
    });

    expect(nextState).toBe(initialGameSessionState);
  });
});
