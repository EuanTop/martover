import { GAME_PHASES } from './gamePhases';
import {
  advanceBreedingSimulation,
  applyIntervention,
  assignTuberUse,
  BREEDING_STAGES,
  canFeedHuman,
  createBreedingSimulation,
  harvestBreedingSimulation,
  plantInZone,
  VIEW_MODES,
} from '../simulation/breedingSimulation';
import { applyHumanFeeding, createHumanState } from '../human/humanEngine';

export const GAME_SESSION_ACTIONS = Object.freeze({
  SELECT_CRATER: 'game-session/select-crater',
  CLEAR_CRATER: 'game-session/clear-crater',
  BEGIN_BREEDING: 'game-session/begin-breeding',
  PLANT_IN_ZONE: 'game-session/plant-in-zone',
  TICK: 'game-session/tick',
  APPLY_INTERVENTION: 'game-session/apply-intervention',
  HARVEST: 'game-session/harvest',
  ASSIGN_TUBER: 'game-session/assign-tuber',
  FEED_HUMAN: 'game-session/feed-human',
  START_NEXT_GENERATION: 'game-session/start-next-generation',
  RESET: 'game-session/reset',
});

export const initialGameSessionState = Object.freeze({
  phase: GAME_PHASES.CRATER_SELECTION,
  viewMode: VIEW_MODES.PLANET,
  selectedCrater: null,
  generation: 1,
  simulation: null,
  lineage: [],
  human: createHumanState(),
  parentSeed: null,
});

export const gameSessionReducer = (state, action) => {
  switch (action.type) {
    case GAME_SESSION_ACTIONS.SELECT_CRATER:
      if (state.viewMode !== VIEW_MODES.PLANET) return state;

      return {
        ...state,
        selectedCrater: action.payload,
      };

    case GAME_SESSION_ACTIONS.CLEAR_CRATER:
      if (state.viewMode !== VIEW_MODES.PLANET) return state;

      return {
        ...state,
        selectedCrater: null,
      };

    case GAME_SESSION_ACTIONS.BEGIN_BREEDING:
      if (!state.selectedCrater) return state;

      return {
        ...state,
        phase: GAME_PHASES.POTATO_BREEDING,
        viewMode: VIEW_MODES.CRATER,
        simulation: createBreedingSimulation(
          state.selectedCrater,
          state.generation,
          state.human,
          state.parentSeed
        ),
      };

    case GAME_SESSION_ACTIONS.PLANT_IN_ZONE:
      if (!state.simulation) return state;

      return {
        ...state,
        simulation: plantInZone(state.simulation, action.payload),
      };

    case GAME_SESSION_ACTIONS.TICK:
      if (!state.simulation) return state;

      return {
        ...state,
        simulation: advanceBreedingSimulation(state.simulation),
      };

    case GAME_SESSION_ACTIONS.APPLY_INTERVENTION:
      if (!state.simulation) return state;

      return {
        ...state,
        simulation: applyIntervention(state.simulation, action.payload),
      };

    case GAME_SESSION_ACTIONS.HARVEST:
      if (!state.simulation || !state.selectedCrater) return state;

      return {
        ...state,
        simulation: harvestBreedingSimulation(
          state.simulation,
          state.selectedCrater
        ),
      };

    case GAME_SESSION_ACTIONS.ASSIGN_TUBER:
      if (!state.simulation) return state;

      return {
        ...state,
        simulation: assignTuberUse(
          state.simulation,
          action.payload.index,
          action.payload.use
        ),
      };

    case GAME_SESSION_ACTIONS.FEED_HUMAN:
      if (!canFeedHuman(state.simulation)) return state;

      {
        const lineageEntry = {
          ...state.simulation.harvestResult,
          allocation: state.simulation.tuberAssignments,
        };

        return {
          ...state,
          phase: GAME_PHASES.PRODUCTION,
          viewMode: VIEW_MODES.HUMAN,
          simulation: {
            ...state.simulation,
            stage: BREEDING_STAGES.COMPLETE,
          },
          human: applyHumanFeeding(state.human, lineageEntry),
          lineage: [...state.lineage, lineageEntry],
          parentSeed: lineageEntry,
        };
      }

    case GAME_SESSION_ACTIONS.START_NEXT_GENERATION:
      if (state.viewMode !== VIEW_MODES.HUMAN || !state.parentSeed) return state;

      return {
        ...state,
        phase: GAME_PHASES.CRATER_SELECTION,
        viewMode: VIEW_MODES.PLANET,
        selectedCrater: null,
        generation: state.generation + 1,
        simulation: null,
      };

    case GAME_SESSION_ACTIONS.RESET:
      return initialGameSessionState;

    default:
      return state;
  }
};
