import { GAME_PHASES } from './gamePhases';
import {
  advanceBreedingSimulation,
  applyIntervention,
  assignTuberUse,
  BREEDING_STAGES,
  canFeedHuman,
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
import {
  advanceFarmSol,
  buildFacility,
  convertTubersToSeeds,
  createFarmState,
  deliverContract,
  FACILITY_TYPES,
  harvestPlot,
  plantPlot,
  TOOL_MODES,
} from '../economy/farmEconomy';

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
  FARM_PLOT_ACTION: 'game-session/farm-plot-action',
  FARM_CONVERT_SEEDS: 'game-session/farm-convert-seeds',
  FARM_DELIVER_CONTRACT: 'game-session/farm-deliver-contract',
  FARM_RESTART: 'game-session/farm-restart',
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
  farm: null,
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

    // 2.0 经营转向：确认坑位后进入基地经营模式（策划 §19.5）。
    // 育种模拟保留为待接回子系统，本入口不再创建它。
    case GAME_SESSION_ACTIONS.BEGIN_BREEDING:
      if (!state.selectedCrater) return state;

      return {
        ...state,
        phase: GAME_PHASES.POTATO_BREEDING,
        viewMode: VIEW_MODES.CRATER,
        simulation: null,
        farm: createFarmState(state.selectedCrater),
      };

    case GAME_SESSION_ACTIONS.PLANT_IN_ZONE:
      if (!state.simulation) return state;

      return {
        ...state,
        simulation: plantInZone(state.simulation, action.payload),
      };

    case GAME_SESSION_ACTIONS.TICK:
      if (state.farm) {
        return { ...state, farm: advanceFarmSol(state.farm) };
      }
      if (!state.simulation) return state;

      return {
        ...state,
        simulation: advanceBreedingSimulation(state.simulation),
      };

    case GAME_SESSION_ACTIONS.FARM_PLOT_ACTION:
      if (!state.farm) return state;

      {
        const { plotId, tool } = action.payload;
        const toolHandlers = {
          [TOOL_MODES.PLANT]: () => plantPlot(state.farm, plotId),
          [TOOL_MODES.HARVEST]: () => harvestPlot(state.farm, plotId),
          [TOOL_MODES.BUILD_HARVESTER]: () => buildFacility(
            state.farm, plotId, FACILITY_TYPES.HARVESTER
          ),
          [TOOL_MODES.BUILD_HEATER]: () => buildFacility(
            state.farm, plotId, FACILITY_TYPES.HEATER
          ),
          [TOOL_MODES.BUILD_SHIELD]: () => buildFacility(
            state.farm, plotId, FACILITY_TYPES.SHIELD
          ),
        };
        const handler = toolHandlers[tool];

        return handler ? { ...state, farm: handler() } : state;
      }

    case GAME_SESSION_ACTIONS.FARM_CONVERT_SEEDS:
      if (!state.farm) return state;

      return {
        ...state,
        farm: convertTubersToSeeds(state.farm, action.payload || 1),
      };

    case GAME_SESSION_ACTIONS.FARM_DELIVER_CONTRACT:
      if (!state.farm) return state;

      return {
        ...state,
        farm: deliverContract(state.farm, action.payload),
      };

    case GAME_SESSION_ACTIONS.FARM_RESTART:
      if (!state.farm || !state.selectedCrater) return state;

      return {
        ...state,
        farm: createFarmState(state.selectedCrater),
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
