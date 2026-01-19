import React, { useRef, useState, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/three';
import MarsGlobe from './MarsGlobe';

const MarsComponent = ({ 
  showMars, 
  isTransitioning, 
  isDarkMode,
  selectedCrater,
  setSelectedCrater,
  craterData,
  hideMarsModel = false,
  onFinishedRendering // 添加渲染完成的回调函数
}) => {
  const marsRef = useRef();
  const globeRef = useRef();
  const [hasFinishedMoving, setHasFinishedMoving] = useState(() => {
    return localStorage.getItem('mars-intro-completed') === 'true';
  });
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredCrater, setHoveredCrater] = useState(null);

  const { position } = useSpring({
    position: showMars ? [0, 0, 0] : [0, 0, -50],
    config: {
      mass: 1,
      tension: 280,
      friction: 120
    },
    onRest: () => {
      if (showMars) {
        setHasFinishedMoving(true);
        // 通知父组件渲染完成
        if (onFinishedRendering) {
          onFinishedRendering();
        }
        // 添加到本地存储，便于下次加载
        localStorage.setItem('mars-intro-completed', 'true');
      }
    }
  });

  // 重置hasFinishedMoving状态
  useEffect(() => {
    if (!showMars) {
      setHasFinishedMoving(false);
    }
  }, [showMars]);

  // 添加处理点击的函数
  const handleCraterClick = (crater, index) => {
    if (selectedId === index) {
      setSelectedId(null);
      setSelectedCrater(null);
    } else {
      setSelectedId(index);
      setSelectedCrater(crater);
    }
  };

  // 改进透明度过渡
  const opacity = useSpring({
    opacity: showMars ? 1 : 0,
    config: { 
      mass: 1,
      tension: 120,
      friction: 70,
      duration: 3000
    }
  });

  // marsAnimation 用于处理整体的动画效果
  const marsAnimation = useSpring({
    position: showMars ? [0, 0, 0] : [0, 0, -40],
    opacity: showMars ? 1 : 0,
    scale: showMars ? [1, 1, 1] : [0.1, 0.1, 0.1],
    config: { mass: 2, tension: 180, friction: 80, duration: 4000 }
  });

  // 添加更强健的重置事件处理
  useEffect(() => {
    // 创建一个事件监听器函数
    const handleResetSelection = (event) => {
      console.log('[MarsComponent] 收到重置选择状态事件', event.detail);
      
      // 清除内部状态
      setSelectedId(null);
      setHoveredCrater(null);
      
      // 确保清除 selectedCrater
      if (typeof setSelectedCrater === 'function') {
        setSelectedCrater(null);
      }
      
      // 尝试访问 MarsGlobe 引用
      if (globeRef.current) {
        console.log('[MarsComponent] 重置 Globe 选中状态');
        
        // 调用 MarsGlobe 内部的重置方法(如果存在)
        if (typeof globeRef.current.resetSelection === 'function') {
          globeRef.current.resetSelection();
        }
        
        // 直接修改 MarsGlobe 的 userData 来传递重置信号
        globeRef.current.userData = {
          ...globeRef.current.userData,
          resetSelection: true,
          resetTime: Date.now()
        };
      }
    };

    // 获取火星组件元素
    const marsElement = document.getElementById('mars-globe') || globeRef.current;
    
    // 如果找到元素，添加事件监听器
    if (marsElement) {
      console.log('[MarsComponent] 添加重置事件监听器');
      marsElement.addEventListener('resetSelection', handleResetSelection);
      
      // 确保元素有一个ID，以便外部可以访问
      if (!marsElement.id) {
        marsElement.id = 'mars-globe';
      }
    } else if (globeRef.current) {
      // 如果没有找到现有元素但ref已存在，则使用ref
      globeRef.current.id = 'mars-globe';
      globeRef.current.addEventListener('resetSelection', handleResetSelection);
    }

    // 清理函数
    return () => {
      const element = document.getElementById('mars-globe') || globeRef.current;
      if (element) {
        element.removeEventListener('resetSelection', handleResetSelection);
      }
    };
  }, [setSelectedCrater]);

  // 添加对 selectedCrater 的监听，当它变为 null 时重置选中状态
  useEffect(() => {
    if (selectedCrater === null) {
      console.log('[MarsComponent] selectedCrater 变为 null，重置选中状态');
      setSelectedId(null);
      
      // 尝试触发重置事件
      if (globeRef.current) {
        globeRef.current.dispatchEvent(new CustomEvent('resetSelection'));
      }
    }
  }, [selectedCrater]);

  return (
    <animated.group 
      ref={marsRef} 
      position={position}
      scale={marsAnimation.scale}
      style={{
        opacity: opacity.opacity
      }}
    >
      <MarsGlobe 
        ref={globeRef}
        isInteractive={showMars && hasFinishedMoving && !isTransitioning}
        initialPosition={[0, 0, 0]}
        scale={[2, 2, 2]}
        showLines={showMars && hasFinishedMoving && !isTransitioning}
        isDarkMode={isDarkMode}
        selectedCrater={selectedCrater}
        setSelectedCrater={setSelectedCrater}
        craters={showMars && hasFinishedMoving && !isTransitioning ? craterData : []}
        hideMarsModel={hideMarsModel}
      />
    </animated.group>
  );
};

export default MarsComponent;