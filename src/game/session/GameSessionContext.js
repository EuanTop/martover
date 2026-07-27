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
    const farmRunning = state.farm && !state.farm.outcome;
    const breedingRunning = (
      state.simulation?.stage === BREEDING_STAGES.GROWING
      && state.simulation.sol < GENERATION_LENGTH_SOLS
    );

    if (!farmRunning && !breedingRunning) return undefined;

    const timer = window.setInterval(() => {
      dispatch({ type: GAME_SESSION_ACTIONS.TICK });
    }, SOL_DURATION_MS);

    return () => window.clearInterval(timer);
  }, [
    state.farm?.outcome,
    Boolean(state.farm),
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

  const farmPlotAction = useCallback((plotId, tool) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.FARM_PLOT_ACTION,
      payload: { plotId, tool },
    });
  }, []);

  const farmConvertSeeds = useCallback((count = 1) => {
    dispatch({ type: GAME_SESSION_ACTIONS.FARM_CONVERT_SEEDS, payload: count });
  }, []);

  const farmDeliverContract = useCallback((contractId) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.FARM_DELIVER_CONTRACT,
      payload: contractId,
    });
  }, []);

  const farmRestart = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.FARM_RESTART });
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
    farmPlotAction,
    farmConvertSeeds,
    farmDeliverContract,
    farmRestart,
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
    farmPlotAction,
    farmConvertSeeds,
    farmDeliverContract,
    farmRestart,
    resetSession,
  ]);

  const value = useMemo(() => ({
    ...state,
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
