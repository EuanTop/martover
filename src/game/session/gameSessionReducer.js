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
  advanceColonySol,
  buildFacility,
  clearCell,
  convertTubersToSeeds,
  deliverContract,
  demolishCell,
  getDecisionPoints,
  harvestCell,
  plantCell,
  repairFacility,
} from '../economy/colonyEconomy';
import {
  createColonyState,
  SKIP_MAX_SOLS,
  SPEED_STEPS,
  TOOL_FACILITY,
  TOOL_MODES,
} from '../economy/colonyState';

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
  COLONY_CELL_ACTION: 'game-session/colony-cell-action',
  COLONY_CONVERT_SEEDS: 'game-session/colony-convert-seeds',
  COLONY_DELIVER_CONTRACT: 'game-session/colony-deliver-contract',
  COLONY_RESTART: 'game-session/colony-restart',
  COLONY_SET_SPEED: 'game-session/colony-set-speed',
  COLONY_TOGGLE_PAUSED: 'game-session/colony-toggle-paused',
  COLONY_SKIP_TO_EVENT: 'game-session/colony-skip-to-event',
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
  colony: null,
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
        colony: createColonyState(state.selectedCrater),
      };

    case GAME_SESSION_ACTIONS.PLANT_IN_ZONE:
      if (!state.simulation) return state;

      return {
        ...state,
        simulation: plantInZone(state.simulation, action.payload),
      };

    case GAME_SESSION_ACTIONS.TICK:
      if (state.colony) {
        const colony = advanceColonySol(state.colony);

        // 自动暂停：施工完成、可收获、灾害与资源危机都把控制权
        // 交还玩家，让时间只跨过等待，不跨过决定。
        // autoPauseArmed 在紧急集合清空后重新武装，避免持续状态
        // （比如长期缺水）每个 SOL 都把游戏暂停一次。
        const urgent = getDecisionPoints(colony).some((p) => p.urgency >= 2);

        if (!urgent) {
          return {
            ...state,
            colony: colony.clock.autoPauseArmed
              ? colony
              : { ...colony, clock: { ...colony.clock, autoPauseArmed: true } },
          };
        }

        return {
          ...state,
          colony: colony.clock.autoPauseArmed
            ? {
              ...colony,
              clock: {
                ...colony.clock, paused: true, speed: 1, autoPauseArmed: false,
              },
            }
            : colony,
        };
      }
      if (!state.simulation) return state;

      return {
        ...state,
        simulation: advanceBreedingSimulation(state.simulation),
      };

    case GAME_SESSION_ACTIONS.COLONY_SET_SPEED:
      if (!state.colony) return state;

      {
        const speed = SPEED_STEPS.includes(action.payload)
          ? action.payload
          : SPEED_STEPS[0];

        return {
          ...state,
          colony: {
            ...state.colony,
            clock: { ...state.colony.clock, speed, paused: false },
          },
        };
      }

    case GAME_SESSION_ACTIONS.COLONY_TOGGLE_PAUSED:
      if (!state.colony) return state;

      return {
        ...state,
        colony: {
          ...state.colony,
          clock: {
            ...state.colony.clock,
            paused: !state.colony.clock.paused,
          },
        },
      };

    // 跳到下一个决策点。纯 reducer 循环，不是加快计时器 ——
    // 等待可以跳过，但决策不会被跳过。
    case GAME_SESSION_ACTIONS.COLONY_SKIP_TO_EVENT:
      if (!state.colony || state.colony.outcome) return state;

      {
        const deadlineReached = getDecisionPoints(state.colony).some(
          (point) => point.kind === 'contract-deadline' && point.remaining === 0
        );
        if (deadlineReached) {
          return {
            ...state,
            colony: {
              ...state.colony,
              clock: { ...state.colony.clock, paused: true },
            },
          };
        }

        let colony = state.colony;

        for (let step = 0; step < SKIP_MAX_SOLS; step += 1) {
          colony = advanceColonySol(colony);
          if (colony.outcome) break;
          if (getDecisionPoints(colony).some((p) => p.urgency >= 2)) break;
        }

        return {
          ...state,
          colony: { ...colony, clock: { ...colony.clock, paused: true } },
        };
      }

    case GAME_SESSION_ACTIONS.COLONY_CELL_ACTION:
      if (!state.colony) return state;

      {
        const { cellId, tool } = action.payload;
        const facilityType = TOOL_FACILITY[tool];
        const toolHandlers = {
          [TOOL_MODES.CLEAR]: () => clearCell(state.colony, cellId),
          [TOOL_MODES.PLANT]: () => plantCell(state.colony, cellId),
          [TOOL_MODES.HARVEST]: () => harvestCell(state.colony, cellId),
          [TOOL_MODES.REPAIR]: () => repairFacility(state.colony, cellId),
          [TOOL_MODES.DEMOLISH]: () => demolishCell(state.colony, cellId),
        };
        const handler = facilityType
          ? () => buildFacility(state.colony, cellId, facilityType)
          : toolHandlers[tool];

        if (!handler) return state;

        const colony = handler();

        // 操作被守卫拒绝时返回同一引用，此处一并保持 state 引用不变，
        // 让「这次点击没生效」在 React 层也不触发重渲染。
        return colony === state.colony ? state : { ...state, colony };
      }

    case GAME_SESSION_ACTIONS.COLONY_CONVERT_SEEDS:
      if (!state.colony) return state;

      {
        const colony = convertTubersToSeeds(state.colony, action.payload || 1);
        return colony === state.colony ? state : { ...state, colony };
      }

    case GAME_SESSION_ACTIONS.COLONY_DELIVER_CONTRACT:
      if (!state.colony) return state;

      {
        const colony = deliverContract(state.colony, action.payload);
        return colony === state.colony ? state : { ...state, colony };
      }

    case GAME_SESSION_ACTIONS.COLONY_RESTART:
      if (!state.colony || !state.selectedCrater) return state;

      return {
        ...state,
        colony: createColonyState(state.selectedCrater),
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
