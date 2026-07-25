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
    completeBreeding,
    resetSession,
  }), [
    state,
    selectCrater,
    clearCrater,
    beginBreeding,
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
