import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { useSpring } from '@react-spring/three';
import CloudsComponent from './CloudsComponent';
import MarsComponent from '../MarsGlobe/MarsComponent';
import styles from './styles.module.css';
import Panel from '../../Components/Panel';
import ProgressBar from '../../Components/ProgressBar';
import TypeShuffleText from '../../Components/TypeShuffle/TypeShuffle';
import Button from '../../Components/common/Button/Button';
import GameHUD from '../../game/ui/GameHUD';
import ColonyHUD from '../../game/ui/ColonyHUD';
import { POTATO_STATUS, TOOL_MODES } from '../../game/economy/colonyState';
import {
  TUBER_USES,
  VIEW_MODES,
} from '../../game/simulation/breedingSimulation';

// 添加卡片内容数据
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

// 移除持久层存储键名，改为使用内存中的状态
// const INTRO_COMPLETED_KEY = 'mars-intro-completed';
// const PROGRESS_STEP_KEY = 'mars-progress-step';

const CloudDownPage = ({ 
  isDarkMode, 
  setIsDarkMode, 
  showLines, 
  setShowLines, 
  selectedCrater,
  onCraterSelect,
  onCraterClear,
  progressStep,
  viewMode,
  simulation,
  human,
  generation,
  lineage,
  onBeginBreeding,
  onPlantInZone,
  onApplyIntervention,
  onHarvest,
  onAssignTuber,
  onFeedHuman,
  onNextGeneration,
  onRecover,
  preservedSamples,
  outcome,
  colony,
  activeBase,
  onColonyCellAction,
  onColonyConvertSeeds,
  onColonyDeliverContract,
  onColonyRestart,
  onSetClockSpeed,
  onToggleClock,
  onSkipToEvent,
  craterData,
  appReady
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const skipIntro = searchParams.get('skipIntro') === 'true';
  
  // 音频引用
  const universeAudioRef = useRef(null);
  const targetsAudioRef = useRef(null);
  const welcomeAudioRef = useRef(null);
  const audioInitialized = useRef(false);
  const userInteracted = useRef(false);
  
  // 所有状态定义 - 根据URL参数决定是否跳过介绍
  const [currentCard, setCurrentCard] = useState(1);
  const [showIntro, setShowIntro] = useState(!skipIntro); // 根据URL参数决定是否显示介绍
  const [showExplore, setShowExplore] = useState(false);
  const [showMars, setShowMars] = useState(skipIntro); // 如果跳过介绍，直接显示火星
  
  // 清除URL参数，避免刷新时保持skipIntro状态
  useEffect(() => {
    if (skipIntro) {
      // 如果有skipIntro参数，在组件加载后清除它，但保持当前状态
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [skipIntro, setSearchParams]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  // 将这个状态移动到组件顶部
  const [marsFullyRendered, setMarsFullyRendered] = useState(skipIntro);
  const [hideMarsModel, setHideMarsModel] = useState(false);
  const [selectedTuberUse, setSelectedTuberUse] = useState(TUBER_USES.SEED);
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [selectedColonyTool, setSelectedColonyTool] = useState(null);

  useEffect(() => {
    if (viewMode !== VIEW_MODES.CRATER || simulation?.stage !== 'growing') {
      setSelectedIntervention(null);
    }
  }, [simulation?.stage, viewMode]);

  // 修改相机位置的初始值 - 根据是否跳过介绍决定初始位置
  const [cameraPosition, setCameraPosition] = useSpring(() => ({
    position: skipIntro ? [0, 0, 30] : [0, 0, 10], // 如果跳过介绍，直接设置到火星视角
    config: { mass: 1, tension: 280, friction: 120 }
  }));

  // 音频初始化
  useEffect(() => {
    if (audioInitialized.current) return;
    audioInitialized.current = true;
    
    // 创建音频实例
    universeAudioRef.current = new Audio('/sounds/universe.mp3');
    universeAudioRef.current.loop = true;
    universeAudioRef.current.volume = 0.3;
    universeAudioRef.current.preload = 'auto'; // 预加载整个音频
    
    targetsAudioRef.current = new Audio('/sounds/30000targets.mp3');
    targetsAudioRef.current.loop = false;
    targetsAudioRef.current.volume = 0.5;
    targetsAudioRef.current.preload = 'auto';
    
    welcomeAudioRef.current = new Audio('/sounds/welcome.mp3');
    welcomeAudioRef.current.volume = 0.5;
    welcomeAudioRef.current.preload = 'auto';
    
    // 预加载音频以实现无缝循环
    universeAudioRef.current.load();
    targetsAudioRef.current.load();
    welcomeAudioRef.current.load();
    
    return () => {
      universeAudioRef.current?.pause();
      targetsAudioRef.current?.pause();
      welcomeAudioRef.current?.pause();
    };
  }, []);
  
  // 将 useEffect 移到这里，在组件顶层与其他 hooks 一起声明
  useEffect(() => {
    // 当showMars为true且不处于转场状态时，表示火星已完全渲染好
    if (showMars && !isTransitioning) {
      // 设置一个小延迟，确保火星完全可见后再显示提示
      const timer = setTimeout(() => {
        setMarsFullyRendered(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [showMars, isTransitioning]);
  
  // 修改 handleExploreClick 函数
  const handleExploreClick = () => {
    // 第一步：设置转场状态，这会触发云朵组件进入准备状态
    setIsTransitioning(true);
    console.log("[探索流程] 1. 开始转场，isTransitioning=true");
    
    // 第二步：延迟一点点再开始相机移动，给UI状态更新时间
    setTimeout(() => {
      // 开始相机移动
      console.log("[探索流程] 2. 开始相机移动");
      setCameraPosition({
        position: [0, 0, 30],
        config: { 
          mass: 1, 
          tension: 180,  // 降低张力使动画更平滑
          friction: 90,  // 适当调整摩擦系数
          duration: 5000 // 延长相机移动时间，确保云朵有足够时间过渡
        },
        onRest: () => {
          // 第三步：相机移动完成后，延迟一小段时间再显示火星
          console.log("[探索流程] 3. 相机移动完成");
          setTimeout(() => {
            console.log("[探索流程] 4. 设置showMars=true，火星开始出现");
            setShowMars(true);
            
            // 第四步：火星显示后，等待足够长时间让火星完全出现，然后才结束转场状态
            // 这个时间需要比火星淡入的时间长
            setTimeout(() => {
              console.log("[探索流程] 5. 转场结束，isTransitioning=false");
              setIsTransitioning(false);
              // 移除持久层存储
            }, 2500); // 给足够长的时间确保火星完全显示
          }, 800); // 等待800ms再显示火星，确保相机已经停稳
        }
      });
    }, 100); // 给React状态更新的时间
  };

  const nextCard = () => {
    if (currentCard < introCards.length) {
      // 点击第一个"下一页"（从卡片1到卡片2）→ 开始循环播放universe.mp3
      if (currentCard === 1) {
        universeAudioRef.current?.play().catch(() => {});
      }
      // 点击第二个"下一页"（从卡片2到卡片3）→ 播放一遍30000targets.mp3
      if (currentCard === 2) {
        targetsAudioRef.current?.play().catch(() => {});
      }
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
  
  // 修改时间戳组件
const TimestampDisplay = ({ isDarkMode }) => {
  const [date, setDate] = useState("2125.07.21 00:00:00");
  const [timestamp, setTimestamp] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      // 构建未来日期
      const futureDate = `2125.07.${String(now.getDate()).padStart(2, '0')} ${
        String(now.getHours()).padStart(2, '0')}:${
        String(now.getMinutes()).padStart(2, '0')}:${
        String(now.getSeconds()).padStart(2, '0')}`;
      
      setDate(futureDate);
      setTimestamp(prev => prev + 1000); // 每秒增加1000毫秒
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center">
      <div className={`text-xl  ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>
        {date}
      </div>
      <div className={`font-mono text-lg ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
        {timestamp}
      </div>
    </div>
  );
};

  // 修改关闭介绍卡片的处理函数 - 移除持久层存储
  const handleIntroComplete = () => {
    setShowIntro(false);
    // 停止信封音乐，播放降落音乐
    targetsAudioRef.current?.pause();
    welcomeAudioRef.current?.play().catch(() => {});
    handleExploreClick(); // 直接触发探索动画
  };

  const handleSelectCrater = () => {
    onBeginBreeding();
  };

  const handleApplyIntervention = (type) => {
    onApplyIntervention(type);
    setSelectedIntervention(null);
  };

  // 地块点击：优先用当前选中的工具；未选工具时按格子状态取
  // 最自然的动作（成熟→收获，空地→种植，未开垦→开垦）。
  const handleColonyCellClick = (cellId) => {
    if (!activeBase) return;

    if (selectedColonyTool) {
      onColonyCellAction(cellId, selectedColonyTool);
      return;
    }

    const cell = activeBase.cells.find((item) => item.id === cellId);
    if (!cell) return;

    if (cell.isPlantingBed && activeBase.potato?.status === POTATO_STATUS.READY) {
      onColonyCellAction(cellId, TOOL_MODES.HARVEST);
    } else if (!cell.cleared) {
      onColonyCellAction(cellId, TOOL_MODES.CLEAR);
    } else if (cell.isPlantingBed && !activeBase.potato) {
      onColonyCellAction(cellId, TOOL_MODES.PLANT);
    }
  };

  // 如果应用尚未准备好，不显示任何内容
  // 所有加载工作都在 App.js 中完成，这里不再显示加载提示
  if (!appReady) {
    return null;
  }
  
  // 组件的渲染部分
  return (
    <div
      className={`${styles.container} ${isDarkMode ? 'dark-mode' : ''}`}
      data-crater-count={craterData.length}
      style={{ background: isDarkMode ? '#000000' : '#F57435' }}
    >
      {/* 顶部关卡进度条 - 只在火星页面显示，不在介绍页面显示 */}
      {!showIntro && <ProgressBar currentStep={progressStep} isDarkMode={isDarkMode} />}
      
      <>
          {/* 顶部导航按钮 */}
          <Link 
            to="/grid" 
            className="fixed top-5 left-5 z-50"
          >
            <Button variant="glass" size="icon" aria-label="网格视图">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </Button>
          </Link>
          


          {!selectedCrater && showMars && (
            <div className="fixed top-5 right-5 z-50">
              <Button 
                variant="glass" 
                size="icon"
                onClick={() => setHideMarsModel(!hideMarsModel)}
                aria-label={hideMarsModel ? "显示火星模型" : "隐藏火星模型"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  {hideMarsModel && <path d="m3 3 18 18" />}
                </svg>
              </Button>
            </div>
          )}

          {/* 添加闪光效果层 */}
          {showFlash && (
            <div 
              className="fixed inset-0 z-40 pointer-events-none"
              style={{
                animation: 'flash 0.5s ease-out forwards',
                background: 'radial-gradient(circle, rgba(255,165,0,0.3) 0%, rgba(255,165,0,0) 70%)',
              }}
            />
          )}

          <Canvas
            // 夹住 devicePixelRatio。Retina 屏默认按 2 甚至 3 倍渲染，
            // 叠加后处理链后每帧成本翻数倍；2 已经足够清晰。
            dpr={[1, 2]}
            className={`${styles.gameCanvas} ${
              viewMode === VIEW_MODES.HUMAN
                ? styles.gameCanvasWithHuman
                : ''
            }`}
          >
            <Suspense fallback={null}>
              {/* 这里改进条件逻辑 */}
              {(!showMars || isTransitioning) && (
                <CloudsComponent 
                  isDarkMode={isDarkMode}
                  cameraPosition={cameraPosition}
                  showMars={showMars}
                  isTransitioning={isTransitioning}
                />
              )}
              <MarsComponent 
                showMars={showMars || isTransitioning} // 允许火星在转场期间就开始准备
                isTransitioning={isTransitioning}
                isDarkMode={isDarkMode}
                selectedCrater={selectedCrater}
                setSelectedCrater={onCraterSelect}
                craterData={craterData}
                hideMarsModel={hideMarsModel}
                viewMode={viewMode}
                simulation={simulation}
                colony={colony}
                activeBase={activeBase}
                selectedColonyTool={selectedColonyTool}
                onColonyCellClick={handleColonyCellClick}
                selectedTuberUse={selectedTuberUse}
                selectedIntervention={selectedIntervention}
                onPlantInZone={onPlantInZone}
                onAssignTuber={onAssignTuber}
                onApplyIntervention={handleApplyIntervention}
                onFinishedRendering={() => {
                  console.log("[Mars] 渲染完成，准备显示提示");
                  setMarsFullyRendered(true);
                }}
              />
            </Suspense>
          </Canvas>
          
          {/* 将 Panel 移到 Canvas 外部 */}
          {selectedCrater && viewMode === VIEW_MODES.PLANET && (
            <Panel 
              isDarkMode={isDarkMode} 
              onClose={() => {
                onCraterClear();
                const mars = document.querySelector('#mars-globe');  // 假设Mars组件有id
                if (mars) {
                  mars.dispatchEvent(new CustomEvent('resetSelection'));
                }
              }}
              selectedCrater={selectedCrater}
              onSelectCrater={handleSelectCrater}
              canSelectCrater={showMars}
              isHomePage={true}
            />
          )}
          
          {!showIntro && showMars && !isTransitioning && colony && (
            <ColonyHUD
              colony={colony}
              base={activeBase}
              selectedTool={selectedColonyTool}
              onSelectTool={setSelectedColonyTool}
              onConvertSeeds={onColonyConvertSeeds}
              onDeliverContract={onColonyDeliverContract}
              onRestart={onColonyRestart}
              onToggleClock={onToggleClock}
              onSetClockSpeed={onSetClockSpeed}
              onSkipToEvent={onSkipToEvent}
            />
          )}

          {!showIntro && showMars && !isTransitioning && !colony && (
            <GameHUD
              viewMode={viewMode}
              selectedCrater={selectedCrater}
              simulation={simulation}
              human={human}
              generation={generation}
              lineage={lineage}
              selectedUse={selectedTuberUse}
              selectedIntervention={selectedIntervention}
              onSelectUse={setSelectedTuberUse}
              onSelectIntervention={setSelectedIntervention}
              onPlantInZone={onPlantInZone}
              onApplyIntervention={handleApplyIntervention}
              onHarvest={onHarvest}
              onAssignTuber={onAssignTuber}
              onFeedHuman={onFeedHuman}
              onNextGeneration={onNextGeneration}
              onRecover={onRecover}
              preservedSamples={preservedSamples}
              outcome={outcome}
            />
          )}
          
          {/* 修改 CloudDownPage 组件中的卡片部分 */}
          {showIntro && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
              <div 
                className={`w-[600px] h-[400px] p-8 rounded-lg relative overflow-hidden
                ${isDarkMode ? 'bg-gray-900' : 'bg-[#F57435]'}`}
                style={{
                  boxShadow: isDarkMode 
                    ? '0 0 40px rgba(255, 165, 0, 0.3), 0 0 80px rgba(255, 165, 0, 0.1)' 
                    : '0 0 20px rgba(0, 0, 0, 0.2)',
                  border: isDarkMode 
                    ? '1px solid rgba(255, 165, 0, 0.4)' 
                    : '1px solid rgba(0,0,0,0.2)',
                  backgroundImage: isDarkMode
                    ? 'linear-gradient(45deg, rgba(255,165,0,0.1) 25%, transparent 25%, transparent 50%, rgba(255,165,0,0.1) 50%, rgba(255,165,0,0.1) 75%, transparent 75%, transparent)'
                    : 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)',
                  backgroundSize: '4px 4px'
                }}
              >
                <div className="h-full flex flex-col">
                  <div
                    className={`flex-grow ${isDarkMode ? 'text-white' : 'text-black'}`}
                    style={{
                      overflow: 'hidden',
                      height: '100%',
                      minHeight: 0,
                      display: 'block',
                      position: 'relative'
                    }}
                  >
                    <TypeShuffleText
                      key={currentCard}
                      text={introCards.find(card => card.id === currentCard).content.replace(/\n/g, '<br/>')}
                      effect="fx1"
                      className="font-sans text-lg leading-relaxed whitespace-pre-line"
                    />
                  </div>
                  
                  {currentCard === 1 && <TimestampDisplay isDarkMode={isDarkMode} />}
                  
                  <div className="flex justify-between items-center mt-4">
                    {currentCard > 1 && (
                      <Button 
                        variant="ghost" 
                        onClick={prevCard}
                        isDarkMode={isDarkMode}
                        className="flex items-center gap-2"
                      >
                        <span>←</span>
                        <span>上一页</span>
                      </Button>
                    )}
                    
                    {currentCard < introCards.length && (
                      <Button 
                        variant="ghost" 
                        onClick={nextCard}
                        isDarkMode={isDarkMode}
                        className="flex items-center gap-2 ml-auto"
                      >
                        <span>下一页</span>
                        <span>→</span>
                      </Button>
                    )}

                    {currentCard === introCards.length && (
                      <Button 
                        variant="secondary" 
                        onClick={handleIntroComplete}
                        isDarkMode={isDarkMode}
                        className="ml-auto"
                      >
                        已阅
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 当介绍卡片关闭且未显示火星时显示"飞向火星中"闪烁文字 */}
          {!showMars && !showIntro && (
            <div 
              className="fixed bottom-24 left-1/2 -translate-x-1/2 cursor-pointer"
              onClick={handleExploreClick}
              style={{
                color: '#FF732C',
                fontSize: '12px',
                fontFamily: 'monospace',
                padding: '8px 15px',
                borderRadius: '15px',
                background: 'rgba(0,0,0,0.7)',
                border: '1px solid #FF732C',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                animation: 'fadeInOut 3s infinite',
                zIndex: 55
              }}
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#FF732C',
                animation: 'pulse 2s infinite'
              }}></div>
              <span>飞向火星中</span>
            </div>
          )}
        </>
    </div>
  );
};

export default CloudDownPage;
