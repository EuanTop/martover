import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from 'react';
import {
  GAME_SESSION_ACTIONS,
  gameSessionReducer,
  initialGameSessionState,
} from './gameSessionReducer';
import { getGameProgressStep } from './gamePhases';

const GameSessionContext = createContext(null);

export const GameSessionProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameSessionReducer, initialGameSessionState);

  const selectCrater = useCallback((crater) => {
    dispatch({ type: GAME_SESSION_ACTIONS.SELECT_CRATER, payload: crater });
  }, []);

  const clearCrater = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.CLEAR_CRATER });
  }, []);

  const beginBreeding = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.BEGIN_BREEDING });
  }, []);

  const configurePlanting = useCallback((key, value) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.CONFIGURE_PLANTING,
      payload: { key, value },
    });
  }, []);

  const startPlanting = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.START_PLANTING });
  }, []);

  const advancePlanting = useCallback(() => {
    dispatch({ type: GAME_SESSION_ACTIONS.ADVANCE_PLANTING });
  }, []);

  const chooseIntervention = useCallback((intervention) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.CHOOSE_INTERVENTION,
      payload: intervention,
    });
  }, []);

  const harvestPlanting = useCallback((harvestSol) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.HARVEST_PLANTING,
      payload: harvestSol,
    });
  }, []);

  const updateAllocation = useCallback((key, delta) => {
    dispatch({
      type: GAME_SESSION_ACTIONS.UPDATE_ALLOCATION,
      payload: { key, delta },
    });
  }, []);

  const completeBreeding = useCallback((potato) => {
    dispatch({ type: GAME_SESSION_ACTIONS.COMPLETE_BREEDING, payload: potato });
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
    configurePlanting,
    startPlanting,
    advancePlanting,
    chooseIntervention,
    harvestPlanting,
    updateAllocation,
    completeBreeding,
    resetSession,
  }), [
    state,
    selectCrater,
    clearCrater,
    beginBreeding,
    configurePlanting,
    startPlanting,
    advancePlanting,
    chooseIntervention,
    harvestPlanting,
    updateAllocation,
    completeBreeding,
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
