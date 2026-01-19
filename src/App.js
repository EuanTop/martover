import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CustomCursor } from './Components/CustomCursor/CustomCursor';
import LogoPage from './LogoPage/LogoPage';
import CraterGrid from './Pages/CraterGridPages/CraterGrid';
import PotatoGrid from './Pages/PotatoPages/PotatoGrid';
import CloudDownPage from './Pages/CloudDownPage/CloudDownPage';
import Part3Gallery from './Pages/Part3Gallery/Part3Gallery';
import MRIPotatoPage from './Pages/MRIPotatoPage/MRIPotatoPage';
import Step2TestPage from './Pages/Test/Step2TestPage'; // 导入测试页面
import { useDataLoader } from './hooks/useDataLoader';

// 加载消息组件
const LoadingMessage = ({ children }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
    <div className="bg-black/70 text-white/90 px-4 py-2 rounded-lg backdrop-blur-sm">
      {children}
    </div>
  </div>
);

const App = () => {
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
  const [selectedCrater, setSelectedCrater] = React.useState(null);

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
                setSelectedCrater={setSelectedCrater}
                craterData={craterData?.preview || []}
                potatoData={potatoData}
                appReady={appReady} 
              />
            </>
          } 
        />
        <Route 
          path="/grid" 
          element={
            <CraterGrid craters={craterData?.full || []} isDarkMode={isDarkMode} />
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
        {/* Step2测试路由已合并到主流程，注释掉 */}
        {/* <Route
          path="/step2"
          element={
            <Step2TestPage
              potatoData={potatoData}
              craterData={craterData?.preview || []}
              selectedCrater={selectedCrater}
              setSelectedCrater={setSelectedCrater}
            />
          }
        /> */}
      </Routes>
    </Router>
  );
};

export default App;