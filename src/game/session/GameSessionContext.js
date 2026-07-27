import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import {
  GAME_SESSION_ACTIONS,
  gameSessionReducer,
  initialGameSessionState,
} from './gameSessionReducer';
import { getGameProgressStep } from './gamePhases';
import { getActiveBase } from '../economy/colonyState';
import {
  BREEDING_STAGES,
  GENERATION_LENGTH_SOLS,
} from '../simulation/breedingSimulation';

const GameSessionContext = createContext(null);
const SOL_DURATION_MS = 3000;

export const GameSessionProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameSessionReducer, initialGameSessionState);

  useEffect(() => {
    // 经营模式：只要基地存活，SOL 时钟连续流动（策划 §19.5）。
    const colonyRunning = state.colony && !state.colony.outcome;
    const breedingRunning = (
      state.simulation?.stage === BREEDING_STAGES.GROWING
      && state.simulation.sol < GENERATION_LENGTH_SOLS
    );

    if (!colonyRunning && !breedingRunning) return undefined;

    const timer = window.setInterval(() => {
      dispatch({ type: GAME_SESSION_ACTIONS.TICK });
    }, SOL_DURATION_MS);

    return () => window.clearInterval(timer);
  }, [
    state.colony?.outcome,
    Boolean(state.colony),
    state.simulation?.stage,
    state.simulation?.sol,
  ]);

  const selectCrater = useCallback((crater) => {
    dispatch({ type: GAME_SESSION_ACTIONS.SELECT_CRATER, payload: crater });
  }, []);

  const clearCrater = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.CLEAR_CRATER });
  }, []);

  const beginBreeding = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.BEGIN_BREEDING });
  }, []);

  const plantInZone = useCallback((zone) => {
    dispatch({ type: GAME_SESSION_ACTIONS.PLANT_IN_ZONE, payload: zone });
  }, []);

  const applyIntervention = useCallback((type) => {
    dispatch({ type: GAME_SESSION_ACTIONS.APPLY_INTERVENTION, payload: type });
  }, []);

  const harvest = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.HARVEST });
  }, []);

  const assignTuber = useCallback((index, use) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.ASSIGN_TUBER,
      payload: { index, use },
    });
  }, []);

  const feedHuman = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.FEED_HUMAN });
  }, []);

  const startNextGeneration = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.START_NEXT_GENERATION });
  }, []);

  const recoverFromFailure = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.RECOVER_FROM_FAILURE });
  }, []);

  const colonyCellAction = useCallback((cellId, tool) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.COLONY_CELL_ACTION,
      payload: { cellId, tool },
    });
  }, []);

  const colonyConvertSeeds = useCallback((count = 1) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.COLONY_CONVERT_SEEDS,
      payload: count,
    });
  }, []);

  const colonyDeliverContract = useCallback((contractId) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.COLONY_DELIVER_CONTRACT,
      payload: contractId,
    });
  }, []);

  const colonyRestart = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.COLONY_RESTART });
  }, []);

  const resetSession = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.RESET });
  }, []);

  // 动作回调本身全部是稳定引用，单独 memo 一层，
  // 使它们不被逐 tick 的状态变化连带失效。
  const actions = useMemo(() => ({
    selectCrater,
    clearCrater,
    beginBreeding,
    plantInZone,
    applyIntervention,
    harvest,
    assignTuber,
    feedHuman,
    startNextGeneration,
    recoverFromFailure,
    colonyCellAction,
    colonyConvertSeeds,
    colonyDeliverContract,
    colonyRestart,
    resetSession,
  }), [
    selectCrater,
    clearCrater,
    beginBreeding,
    plantInZone,
    applyIntervention,
    harvest,
    assignTuber,
    feedHuman,
    startNextGeneration,
    recoverFromFailure,
    colonyCellAction,
    colonyConvertSeeds,
    colonyDeliverContract,
    colonyRestart,
    resetSession,
  ]);

  const value = useMemo(() => ({
    ...state,
    // 派生 activeBase，让 3D 与 HUD 层继续拿到一个扁平对象；
    // Phase 2 接入多基地时消费方无需改动。
    activeBase: state.colony ? getActiveBase(state.colony) : null,
    progressStep: getGameProgressStep(state.phase),
    ...actions,
  }), [state, actions]);

  return (
    <GameSessionContext.Provider value={value}>
      {children}
    </GameSessionContext.Provider>
  );
};

export const useGameSession = () => {
  const context = useContext(GameSessionContext);

  if (!context) {
    throw new Error('useGameSession must be used within a GameSessionProvider');
  }

  return context;
};
