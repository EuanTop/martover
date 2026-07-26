import { GAME_PHASES } from './gamePhases';
import {
  advanceBreedingSimulation,
  applyIntervention,
  assignTuberUse,
  BREEDING_STAGES,
  canFeedHuman,
  createBreedingSimulation,
  DEFAULT_RESOURCES,
  harvestBreedingSimulation,
  plantInZone,
  PRESERVED_SAMPLE_LIMIT,
  resolveAllocationOutcome,
  VIEW_MODES,
} from '../simulation/breedingSimulation';
import {
  advanceHumanGeneration,
  applyHumanFeeding,
  createHumanState,
  isHumanAlive,
} from '../human/humanEngine';

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
  RECOVER_FROM_FAILURE: 'game-session/recover-from-failure',
  RESET: 'game-session/reset',
});

export const RUN_OUTCOMES = Object.freeze({
  ACTIVE: 'active',
  HUMAN_LOST: 'human-lost',
  LINEAGE_LOST: 'lineage-lost',
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
  preservedSamples: [],
  resources: { ...DEFAULT_RESOURCES },
  outcome: RUN_OUTCOMES.ACTIVE,
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
          state.parentSeed,
          state.resources
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
        const outcome = resolveAllocationOutcome(state.simulation);
        const lineageEntry = {
          ...state.simulation.harvestResult,
          allocation: state.simulation.tuberAssignments,
          revealedDimensions: outcome.revealedDimensions,
        };
        // 保存的块茎进入库存上限，超出的部分被挤出。
        const preservedSamples = [
          ...state.preservedSamples,
          ...Array.from({ length: outcome.preservedCount }, () => lineageEntry),
        ].slice(-PRESERVED_SAMPLE_LIMIT);

        return {
          ...state,
          phase: GAME_PHASES.PRODUCTION,
          viewMode: VIEW_MODES.HUMAN,
          simulation: {
            ...state.simulation,
            stage: BREEDING_STAGES.COMPLETE,
          },
          human: applyHumanFeeding(
            state.human,
            lineageEntry,
            outcome.feedCount
          ),
          lineage: [...state.lineage, lineageEntry],
          // parentSeed 由实际留种块茎派生，而非整个 harvestResult。
          parentSeed: outcome.parentSeed,
          preservedSamples,
          resources: {
            water: state.resources.water + outcome.resourceGain.water,
            heat: state.resources.heat + outcome.resourceGain.heat,
            shield: state.resources.shield + outcome.resourceGain.shield,
          },
        };
      }

    case GAME_SESSION_ACTIONS.START_NEXT_GENERATION:
      if (state.viewMode !== VIEW_MODES.HUMAN || !state.parentSeed) return state;

      {
        // 每代衰减（策划 §9）：受试者不会只因喂食而单调变好。
        const human = advanceHumanGeneration(state.human);

        if (!isHumanAlive(human)) {
          return {
            ...state,
            human,
            outcome: RUN_OUTCOMES.HUMAN_LOST,
            simulation: null,
          };
        }

        return {
          ...state,
          phase: GAME_PHASES.CRATER_SELECTION,
          viewMode: VIEW_MODES.PLANET,
          selectedCrater: null,
          generation: state.generation + 1,
          simulation: null,
          human,
        };
      }

    // 绝收或不育后，用保存样本回退品系；没有保存样本则本局结束。
    case GAME_SESSION_ACTIONS.RECOVER_FROM_FAILURE:
      if (state.simulation?.stage !== BREEDING_STAGES.FAILED) return state;

      {
        const fallback = state.preservedSamples.at(-1);

        if (!fallback) {
          return {
            ...state,
            outcome: RUN_OUTCOMES.LINEAGE_LOST,
            simulation: null,
          };
        }

        return {
          ...state,
          phase: GAME_PHASES.CRATER_SELECTION,
          viewMode: VIEW_MODES.PLANET,
          selectedCrater: null,
          generation: state.generation + 1,
          simulation: null,
          parentSeed: fallback,
          preservedSamples: state.preservedSamples.slice(0, -1),
        };
      }

    case GAME_SESSION_ACTIONS.RESET:
      return initialGameSessionState;

    default:
      return state;
  }
};
