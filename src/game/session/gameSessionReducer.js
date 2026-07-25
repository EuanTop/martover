import { GAME_PHASES } from './gamePhases';
import {
  advancePlanting,
  canCompletePlantingCycle,
  chooseIntervention,
  configurePlanting,
  createPlantingCycle,
  harvestPlanting,
  startPlanting,
  updateAllocation,
} from '../planting/plantingEngine';

export const GAME_SESSION_ACTIONS = Object.freeze({
  SELECT_CRATER: 'game-session/select-crater',
  CLEAR_CRATER: 'game-session/clear-crater',
  BEGIN_BREEDING: 'game-session/begin-breeding',
  CONFIGURE_PLANTING: 'game-session/configure-planting',
  START_PLANTING: 'game-session/start-planting',
  ADVANCE_PLANTING: 'game-session/advance-planting',
  CHOOSE_INTERVENTION: 'game-session/choose-intervention',
  HARVEST_PLANTING: 'game-session/harvest-planting',
  UPDATE_ALLOCATION: 'game-session/update-allocation',
  COMPLETE_BREEDING: 'game-session/complete-breeding',
  RESET: 'game-session/reset',
});

export const initialGameSessionState = Object.freeze({
  phase: GAME_PHASES.CRATER_SELECTION,
  selectedCrater: null,
  selectedPotato: null,
  generation: 1,
  planting: null,
  lineage: [],
});

export const gameSessionReducer = (state, action) => {
  switch (action.type) {
    case GAME_SESSION_ACTIONS.SELECT_CRATER:
      return {
        ...state,
        phase: GAME_PHASES.CRATER_SELECTION,
        selectedCrater: action.payload,
        selectedPotato: null,
        generation: 1,
        planting: null,
        lineage: [],
      };

    case GAME_SESSION_ACTIONS.CLEAR_CRATER:
      return {
        ...state,
        phase: GAME_PHASES.CRATER_SELECTION,
        selectedCrater: null,
        selectedPotato: null,
        generation: 1,
        planting: null,
        lineage: [],
      };

    case GAME_SESSION_ACTIONS.BEGIN_BREEDING:
      if (!state.selectedCrater) return state;

      return {
        ...state,
        phase: GAME_PHASES.POTATO_BREEDING,
        selectedPotato: null,
        planting: createPlantingCycle(state.selectedCrater, state.generation),
      };

    case GAME_SESSION_ACTIONS.CONFIGURE_PLANTING:
      if (!state.planting) return state;

      return {
        ...state,
        planting: configurePlanting(
          state.planting,
          action.payload.key,
          action.payload.value
        ),
      };

    case GAME_SESSION_ACTIONS.START_PLANTING:
      if (!state.planting) return state;

      return {
        ...state,
        planting: startPlanting(state.planting),
      };

    case GAME_SESSION_ACTIONS.ADVANCE_PLANTING:
      if (!state.planting) return state;

      return {
        ...state,
        planting: advancePlanting(state.planting, state.selectedCrater),
      };

    case GAME_SESSION_ACTIONS.CHOOSE_INTERVENTION:
      if (!state.planting) return state;

      return {
        ...state,
        planting: chooseIntervention(state.planting, action.payload),
      };

    case GAME_SESSION_ACTIONS.HARVEST_PLANTING:
      if (!state.planting) return state;

      return {
        ...state,
        planting: harvestPlanting(
          state.planting,
          state.selectedCrater,
          action.payload
        ),
      };

    case GAME_SESSION_ACTIONS.UPDATE_ALLOCATION:
      if (!state.planting) return state;

      return {
        ...state,
        planting: updateAllocation(
          state.planting,
          action.payload.key,
          action.payload.delta
        ),
      };

    case GAME_SESSION_ACTIONS.COMPLETE_BREEDING:
      if (!canCompletePlantingCycle(state.planting)) return state;

      {
        const lineageEntry = {
          ...state.planting.harvestResult,
          allocation: state.planting.allocation,
        };

        return {
          ...state,
          phase: GAME_PHASES.PRODUCTION,
          selectedPotato: {
            ...action.payload,
            ...lineageEntry,
          },
          generation: state.generation + 1,
          lineage: [...state.lineage, lineageEntry],
        };
      }

    case GAME_SESSION_ACTIONS.RESET:
      return initialGameSessionState;

    default:
      return state;
  }
};
