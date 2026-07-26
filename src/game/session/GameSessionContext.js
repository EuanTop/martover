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
    if (
      state.simulation?.stage !== BREEDING_STAGES.GROWING
      || state.simulation.sol >= GENERATION_LENGTH_SOLS
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      dispatch({ type: GAME_SESSION_ACTIONS.TICK });
    }, SOL_DURATION_MS);

    return () => window.clearInterval(timer);
  }, [state.simulation?.stage, state.simulation?.sol]);

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

  const resetSession = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.RESET });
  }, []);

  const value = useMemo(() => ({
    ...state,
    progressStep: getGameProgressStep(state.phase),
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
    resetSession,
  }), [
    state,
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
    resetSession,
  ]);

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
