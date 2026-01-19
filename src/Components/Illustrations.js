import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ReactSVG } from 'react-svg';
import { OverlayBackground } from './OverlayLayers';

export const FigCrater = ({ isDarkMode }) => {
  const [isSeparated, setIsSeparated] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(false);
  const [animationPhase, setAnimationPhase] = useState('idle'); // 新增动画阶段状态
  const animationsGenerated = useRef(false);
  const [showIndicators, setShowIndicators] = useState(false);
// 在组件顶部定义常量
const ANIMATION_DURATION = 1500; // 1.5秒
const PHASE_DELAY = 500;         // 0.5秒

  // 图层配置（新增动画参数）
  const layers = useMemo(() => [
    {
      num: 1,
      svg: '/test/1/1_CpxCpk.svg',
      color: '#FFBC99',
      zIndex: 100,
      animation: {
        duration: 2.8,  // 不同持续时间
        delay: 0.2,      // 随机延迟
        curve: 'cubic-bezier(0.4, 0, 0.2, 1)' // 自定义曲线
      }
    },
    {
      num: 2,
      svg: '/test/2.svg',
      color: isDarkMode ? '#000000' : '#FF722C',
      zIndex: 80,
      animation: {
        duration: 3.0,
        delay: 0,
        curve: 'cubic-bezier(0.4, 0, 0.5, 1)'
      }
    },
    {
      num: 3,
      svg: '/test/3.svg',
      color: '#BE501E',
      zIndex: 60,
      animation: {
        duration: 3.0,
        delay: 0,
        curve: 'cubic-bezier(0.4, 0, 0.5, 1)'
      }
    },
    {
      num: 5,
      svg: '/test/5/5_BL_S.svg',
      color: '#FFBC99',
      zIndex: 40,
      animation: {
        duration: 3.5,
        delay: 0.4,
        curve: 'cubic-bezier(0.4, 0, 0.1, 1)'
      }
    },
    {
      num: 7,
      svg: '/test/7.svg',
      color: '#BE501E',
      zIndex: 20,
      animation: {
        duration: 3.0,
        delay: 0,
        curve: 'cubic-bezier(0.4, 0, 0.5, 1)'
      }
    }
  ].sort((a, b) => b.zIndex - a.zIndex), [isDarkMode]);

  // 初始化时生成关键帧
// 在 useEffect 中添加阶段监听
useEffect(() => {
  if (animationPhase === 'floating' && !isSeparated) {
    setAnimationPhase('idle'); // 防止状态不一致
  }
}, [isSeparated]);

  // 动态生成每个图层的动画
  const generateAnimations = () => {
    const styleSheet = document.styleSheets[0];
    layers.forEach(layer => {
      styleSheet.insertRule(`
        @keyframes float-${layer.num} {
          0% { transform: translateY(${getPosition(layer.num)}); }
          30% { transform: translateY(calc(${getPosition(layer.num)} - 4px)); }
          60% { transform: translateY(calc(${getPosition(layer.num)} + 3px)); }
          90% { transform: translateY(calc(${getPosition(layer.num)} - 2px)); }
          100% { transform: translateY(${getPosition(layer.num)}); }
        }
      `, styleSheet.cssRules.length);
    });
  };

  // 获取目标位置
  const getPosition = (num) => {
    if (num === 1) return '-12vh';
    if (num === 5) return '-4vh';
    return '7vh';
  };

  // 处理分离/合并
  const toggleAnimation = () => {
    setAnimationsEnabled(true);
  
    if (isSeparated) {
      // 还原流程
      setAnimationPhase('moving');
      setShowIndicators(false); // 立即隐藏指示线
      setIsSeparated(false);
      setTimeout(() => {
        setAnimationPhase('idle');
      }, ANIMATION_DURATION);
    } else {
      // 拆分流程
      setAnimationPhase('moving');
      setIsSeparated(true);
      setTimeout(() => {
        setAnimationPhase('floating');
        setShowIndicators(true); // 动画结束后显示指示线
      }, ANIMATION_DURATION);
    }
  };

  // 动态样式生成
  const getLayerStyle = (layer) => ({
    zIndex: layer.zIndex,
    transform: isSeparated 
      ? `translateY(${getPosition(layer.num)})` 
      : 'translateY(0)',
    transition: animationPhase === 'moving' 
      ? `transform ${ANIMATION_DURATION}ms ${layer.animation.curve} ${layer.animation.delay}s`
      : 'none',
    animation: animationPhase === 'floating' 
      ? `float-${layer.num} ${layer.animation.duration}s ${layer.animation.curve} infinite`
      : 'none'
  });

  const indicators = [
    { position: '-12vh', label: '坑内形状' },
    { position: '-4vh', label: '溅射物' },
    { position: '10vh', label: '坑底' }
  ];

  return (
    <div className="flex flex-col items-center">
<div className="relative w-[271.5px] h-[147.5px] py-5 overflow-visible px-0">
{/* 指示线渲染 */}
        {showIndicators && indicators.map((indicator) => (
  <div
    key={indicator.position}
    className="absolute top-0 left-0 w-full pointer-events-none"
    style={{
      transform: `translateY(${indicator.position})`,
      zIndex: 1000
    }}
  >
    <div className="relative">
      <hr className={`border-t-1 border-dashed ${isDarkMode ? 'border-white' : 'border-black'}`} />
      <span className={`absolute -left-1  top-full text-sm px-2 rounded ${isDarkMode ? 'text-white' : 'text-black'}`}>
        {indicator.label}
      </span>
    </div>
  </div>
))}

        {layers.map((layer) => (
          <div
            key={`layer-${layer.num}`}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={getLayerStyle(layer)}
          >
            <ReactSVG
              src={layer.svg}
              beforeInjection={(svg) => {
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.querySelectorAll('path').forEach(path => {
                  path.style.fill = layer.color;
                  path.style.stroke = isDarkMode ? 'white' : 'black';
                });
              }}
              wrapper="div"
              className="w-full h-full"
            />
          </div>
        ))}
      </div>

      <button
        onClick={toggleAnimation}
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2 rounded-lg transition-colors border border-solid  ${isDarkMode
          ? 'bg-[#262626] text-white hover:bg-[#484848] border-white'
          : 'bg-[#FF996D] text-black hover:bg-[#FFAA80] border-black'
          }`}
      >
        {isSeparated ? '还原' : '拆分'}
      </button>
    </div>
  );
};

export const FigCraterIntMorph = ({ isDarkMode }) => {
  return (
    <div className="relative w-full h-full">
      <img 
        src="/figures/int_morph1.jpg" 
        className="w-full h-full object-contain" 
        alt="坑内形态示意图"
      />

    </div>
  );
};

export const FigCraterEjector = () => {
  
}