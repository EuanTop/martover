import { GAME_PHASES } from './gamePhases';

export const GAME_SESSION_ACTIONS = Object.freeze({
  SELECT_CRATER: 'game-session/select-crater',
  CLEAR_CRATER: 'game-session/clear-crater',
  BEGIN_BREEDING: 'game-session/begin-breeding',
  COMPLETE_BREEDING: 'game-session/complete-breeding',
  RESET: 'game-session/reset',
});

export const initialGameSessionState = Object.freeze({
  phase: GAME_PHASES.CRATER_SELECTION,
  selectedCrater: null,
  selectedPotato: null,
});

export const gameSessionReducer = (state, action) => {
  switch (action.type) {
    case GAME_SESSION_ACTIONS.SELECT_CRATER:
      return {
        ...state,
        phase: GAME_PHASES.CRATER_SELECTION,
        selectedCrater: action.payload,
        selectedPotato: null,
      };

    case GAME_SESSION_ACTIONS.CLEAR_CRATER:
      return {
        ...state,
        phase: GAME_PHASES.CRATER_SELECTION,
        selectedCrater: null,
        selectedPotato: null,
      };

    case GAME_SESSION_ACTIONS.BEGIN_BREEDING:
      if (!state.selectedCrater) return state;

      return {
        ...state,
        phase: GAME_PHASES.POTATO_BREEDING,
        selectedPotato: null,
      };

    case GAME_SESSION_ACTIONS.COMPLETE_BREEDING:
      return {
        ...state,
        phase: GAME_PHASES.PRODUCTION,
        selectedPotato: action.payload,
      };

    case GAME_SESSION_ACTIONS.RESET:
      return initialGameSessionState;

    default:
      return state;
  }
};
