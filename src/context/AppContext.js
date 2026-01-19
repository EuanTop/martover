import React, { createContext, useState, useContext } from 'react';

// 本地存储键
export const INTRO_COMPLETED_KEY = 'mars-intro-completed';
export const PROGRESS_STEP_KEY = 'mars-progress-step';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('正在准备加载数据...');
  const [loadError, setLoadError] = useState(null);
  const [appReady, setAppReady] = useState(false);
  
  // 进度相关状态
  const [progressStep, setProgressStep] = useState(() => {
    return Number(localStorage.getItem(PROGRESS_STEP_KEY)) || 1;
  });
  
  // 介绍状态
  const [introCompleted, setIntroCompleted] = useState(() => {
    return localStorage.getItem(INTRO_COMPLETED_KEY) === 'true';
  });

  const updateProgressStep = (step) => {
    setProgressStep(step);
    localStorage.setItem(PROGRESS_STEP_KEY, step.toString());
  };

  const completeIntro = () => {
    setIntroCompleted(true);
    localStorage.setItem(INTRO_COMPLETED_KEY, 'true');
  };

  return (
    <AppContext.Provider value={{
      isLoading,
      setIsLoading,
      loadingStatus,
      setLoadingStatus,
      loadError,
      setLoadError,
      appReady,
      setAppReady,
      progressStep,
      updateProgressStep,
      introCompleted,
      completeIntro
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};