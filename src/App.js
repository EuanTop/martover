import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CustomCursor } from './Components/CustomCursor/CustomCursor';
import LogoPage from './LogoPage/LogoPage';
import CraterGrid from './Pages/CraterGridPages/CraterGrid';
import PotatoGrid from './Pages/PotatoPages/PotatoGrid';
import CloudDownPage from './Pages/CloudDownPage/CloudDownPage';
import Part3Gallery from './Pages/Part3Gallery/Part3Gallery';
import MRIPotatoPage from './Pages/MRIPotatoPage/MRIPotatoPage';
import { useDataLoader } from './hooks/useDataLoader';
import {
  GameSessionProvider,
  useGameSession,
} from './game/session/GameSessionContext';

// 加载消息组件
const LoadingMessage = ({ children }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
    <div className="bg-black/70 text-white/90 px-4 py-2 rounded-lg backdrop-blur-sm">
      {children}
    </div>
  </div>
);

const AppRoutes = () => {
  // 使用数据加载钩子
  const {
    isLoading,
    loadingStatus,
    loadError,
    craterData,
    potatoData,
    appReady
  } = useDataLoader();

  // 状态
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [showLines, setShowLines] = React.useState(true);
  const {
    phase,
    progressStep,
    viewMode,
    selectedCrater,
    simulation,
    human,
    generation,
    lineage,
    selectCrater,
    clearCrater,
    beginBreeding,
    plantInZone,
    applyIntervention,
    harvest,
    assignTuber,
    feedHuman,
    startNextGeneration,
  } = useGameSession();

  // 显示加载状态
  if (isLoading) {
    return <LoadingMessage>{loadingStatus}</LoadingMessage>;
  }

  // 显示错误状态
  if (loadError) {
    return <LoadingMessage>数据加载失败: {loadError.message}</LoadingMessage>;
  }

  return (
    <Router>
      <CustomCursor />
      <Routes>
        <Route 
          path="/" 
          element={
            <>
              <CloudDownPage 
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
                showLines={showLines}
                setShowLines={setShowLines}
                selectedCrater={selectedCrater}
                onCraterSelect={selectCrater}
                onCraterClear={clearCrater}
                progressStep={progressStep}
                viewMode={viewMode}
                simulation={simulation}
                human={human}
                generation={generation}
                lineage={lineage}
                onBeginBreeding={beginBreeding}
                onPlantInZone={plantInZone}
                onApplyIntervention={applyIntervention}
                onHarvest={harvest}
                onAssignTuber={assignTuber}
                onFeedHuman={feedHuman}
                onNextGeneration={startNextGeneration}
                craterData={craterData?.available || []}
                appReady={appReady} 
              />
            </>
          } 
        />
        <Route 
          path="/grid" 
          element={
            <CraterGrid
              craters={craterData?.available || []}
              isDarkMode={isDarkMode}
              selectedCrater={selectedCrater}
              onCraterSelect={selectCrater}
              onCraterClear={clearCrater}
            />
          }
        />
        <Route 
          path="/potato" 
          element={<PotatoGrid potatoes={potatoData} isDarkMode={isDarkMode} />}
        />
        <Route 
          path="/logo" 
          element={<LogoPage />}
        />
        <Route 
          path="/gallery" 
          element={<Part3Gallery />}
        />
        <Route
          path="/mriPotato"
          element={<MRIPotatoPage />}
        />
      </Routes>
    </Router>
  );
};

const App = () => (
  <GameSessionProvider>
    <AppRoutes />
  </GameSessionProvider>
);

export default App;
