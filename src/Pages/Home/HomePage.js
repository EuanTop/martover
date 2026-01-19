import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { INTRO_COMPLETED_KEY, PROGRESS_STEP_KEY } from '../../context/AppContext';
import { useTransition } from '../../hooks/useTransition';
import CloudsComponent from '../../features/clouds/CloudsComponent';
import MarsComponent from '../../features/mars/MarsComponent';
import Panel from '../../Components/Panel';
import ProgressBar from '../../Components/ProgressBar';
import PotatoPlanet from '../../features/potato/PotatoPlanet';
import IntroCard from '../../Components/IntroCard';
import TimestampDisplay from '../../Components/TimestampDisplay';
import NavigationButtons from '../../Components/NavigationButtons';
import MarsGuideTooltips from '../../features/mars/MarsGuideTooltips';
import styles from './styles.module.css';

// 介绍卡片内容
const introCards = [
  {
    id: 1,
    content: `致TOVER联盟第101号成员：\n\n根据地球联合署第17版《星际生存白皮书》，您已通过穹顶生态圈适应性测试，现授权参与火星农业时代核心项目。欢迎加入人类首个跨行星农业工程——"托沃计划"。`
  },
  {
    id: 2,
    content: `马铃薯，经地球生物圈研究院132年验证，是最适合火星农业育种和生产的作物。\n\n您即将参与到:\n- 农业目标地选择\n- 土豆太空育种\n- 火星本土自动化生产\n\n火星土豆生产全流程。`
  },
  {
    id: 3, 
    content: `您即将执行的每个决策，都将影响火星与地球的农业生态链。\n\n请做好准备，联盟穿梭舰将载着您的育种舱穿越地火轨道——\n\n这次，我们要在赤壤中，改写人类文明的食谱。`
  }
];

const HomePage = ({ appReady }) => {
  // 使用上下文
  const { isDarkMode, setIsDarkMode, showLines, setShowLines } = useTheme();
  const { craterData, potatoData, selectedCrater, setSelectedCrater } = useData();
  
  // 使用转场钩子
  const { 
    isTransitioning, 
    showMars, 
    marsFullyRendered, 
    setMarsFullyRendered,
    cameraPosition, 
    handleExploreClick 
  } = useTransition();

  // 本地状态
  const [currentCard, setCurrentCard] = useState(1);
  const [showIntro, setShowIntro] = useState(() => {
    return localStorage.getItem(INTRO_COMPLETED_KEY) !== 'true';
  });
  const [showExplore, setShowExplore] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [progressStep, setProgressStep] = useState(() => {
    return Number(localStorage.getItem(PROGRESS_STEP_KEY)) || 1;
  });
  const [showPotato, setShowPotato] = useState(false);

  // 每次进入页面时，确保没有选中任何陨石坑
  useEffect(() => {
    setSelectedCrater(null);
  }, [setSelectedCrater]);

  // 监听火星渲染状态
  useEffect(() => {
    if (showMars && !isTransitioning) {
      const timer = setTimeout(() => {
        setMarsFullyRendered(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [showMars, isTransitioning, setMarsFullyRendered]);

  // 卡片导航
  const nextCard = () => {
    if (currentCard < introCards.length) {
      setCurrentCard(currentCard + 1);
    } else {
      setShowExplore(true);
    }
  };

  const prevCard = () => {
    if (currentCard > 1) {
      setCurrentCard(currentCard - 1);
    }
  };

  // 完成介绍
  const handleIntroComplete = () => {
    setShowIntro(false);
    localStorage.setItem(INTRO_COMPLETED_KEY, 'true');
    setProgressStep(1);
    localStorage.setItem(PROGRESS_STEP_KEY, '1');
    handleExploreClick();
  };

  // 选择陨石坑
  const navigate = useNavigate();
  const handleSelectCrater = () => {
    setProgressStep(2);
    localStorage.setItem(PROGRESS_STEP_KEY, '2');
    setShowPotato(true);
  };

  // 如果应用尚未准备好，不显示任何内容
  if (!appReady) {
    return null;
  }
  
  return (
    <div className={styles.container} style={{ background: isDarkMode ? '#000000' : '#F57435' }}>
      {!showPotato && (
        <>
          {/* 导航按钮 */}
          <NavigationButtons isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

          {/* 3D场景 */}
          <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            
            {/* 云层组件 */}
            <CloudsComponent 
              isTransitioning={isTransitioning} 
              isDarkMode={isDarkMode}
            />
            
            {/* 火星组件 */}
            <MarsComponent 
              showMars={showMars}
              isTransitioning={isTransitioning}
              isDarkMode={isDarkMode}
              selectedCrater={selectedCrater}
              setSelectedCrater={setSelectedCrater}
              craterData={craterData?.preview || []}
              onFinishedRendering={() => setMarsFullyRendered(true)}
            />
            
            {/* 介绍卡片 */}
            {showIntro && (
              <Html fullscreen>
                <IntroCard 
                  content={introCards[currentCard - 1].content}
                  isDarkMode={isDarkMode}
                  onNext={currentCard === introCards.length ? handleIntroComplete : nextCard}
                  onPrev={prevCard}
                  isFirst={currentCard === 1}
                  isLast={currentCard === introCards.length}
                  showExplore={showExplore}
                />
              </Html>
            )}
            
            {/* 火星导览提示 */}
            {marsFullyRendered && (
              <Html fullscreen>
                <MarsGuideTooltips
                  isDarkMode={isDarkMode}
                  showMars={showMars}
                  hasFinishedMoving={true}
                  selectedCrater={selectedCrater}
                />
              </Html>
            )}
          </Canvas>
          
          {/* 时间戳显示 */}
          <TimestampDisplay isDarkMode={isDarkMode} />
          
          {/* 进度条 */}
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
            <ProgressBar currentStep={progressStep} totalSteps={3} />
          </div>
          
          {/* 陨石坑信息面板 */}
          {selectedCrater && (
            <Panel 
              isDarkMode={isDarkMode}
              onClose={() => setSelectedCrater(null)}
              selectedCrater={selectedCrater}
              onSelectCrater={handleSelectCrater}
              canSelectCrater={true}
            />
          )}
        </>
      )}
      
      {/* 土豆星球 */}
      {showPotato && (
        <PotatoPlanet 
          potatoData={potatoData} 
          selectedCrater={selectedCrater}
        />
      )}
    </div>
  );
};

export default HomePage;