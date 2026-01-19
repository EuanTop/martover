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
  onFinishedRendering
}) => {
  const marsRef = useRef();
  const globeRef = useRef();
  const [hasFinishedMoving, setHasFinishedMoving] = useState(() => {
    return localStorage.getItem('mars-intro-completed') === 'true';
  });
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredCrater, setHoveredCrater] = useState(null);

  // 位置动画
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
        if (onFinishedRendering) {
          onFinishedRendering();
        }
        localStorage.setItem('mars-intro-completed', 'true');
      }
    }
  });

  // 重置状态
  useEffect(() => {
    if (!showMars) {
      setHasFinishedMoving(false);
    }
  }, [showMars]);

  // 处理陨石坑点击
  const handleCraterClick = (crater, index) => {
    if (selectedId === index) {
      setSelectedId(null);
      setSelectedCrater(null);
    } else {
      setSelectedId(index);
      setSelectedCrater(crater);
    }
  };

  // 透明度动画
  const opacity = useSpring({
    opacity: showMars ? 1 : 0,
    config: { 
      mass: 1,
      tension: 120,
      friction: 70,
      duration: 3000
    }
  });

  // 整体动画
  const marsAnimation = useSpring({
    position: showMars ? [0, 0, 0] : [0, 0, -40],
    opacity: showMars ? 1 : 0,
    scale: showMars ? [1, 1, 1] : [0.1, 0.1, 0.1],
    config: { mass: 2, tension: 180, friction: 80, duration: 4000 }
  });

  // 重置选择状态
  useEffect(() => {
    const handleResetSelection = (event) => {
      setSelectedId(null);
      setHoveredCrater(null);
      
      if (typeof setSelectedCrater === 'function') {
        setSelectedCrater(null);
      }
      
      if (globeRef.current) {
        if (typeof globeRef.current.resetSelection === 'function') {
          globeRef.current.resetSelection();
        }
        
        globeRef.current.userData = {
          ...globeRef.current.userData,
          resetSelection: true,
          resetTime: Date.now()
        };
      }
    };

    const marsElement = document.getElementById('mars-globe') || globeRef.current;
    
    if (marsElement) {
      marsElement.addEventListener('resetSelection', handleResetSelection);
      
      if (!marsElement.id) {
        marsElement.id = 'mars-globe';
      }
    } else if (globeRef.current) {
      globeRef.current.id = 'mars-globe';
      globeRef.current.addEventListener('resetSelection', handleResetSelection);
    }

    return () => {
      const element = document.getElementById('mars-globe') || globeRef.current;
      if (element) {
        element.removeEventListener('resetSelection', handleResetSelection);
      }
    };
  }, [setSelectedCrater]);

  // 监听选中状态变化
  useEffect(() => {
    if (selectedCrater === null) {
      setSelectedId(null);
      
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
        enableRotation={showMars && hasFinishedMoving && !isTransitioning}
        showRaycaster={showMars && hasFinishedMoving && !isTransitioning}
        initialPosition={[0, 0, 0]}
        showSelectedEffect={true}
        scale={[2, 2, 2]}
        showLines={showMars && hasFinishedMoving && !isTransitioning}
        isDarkMode={isDarkMode}
        selectedCrater={selectedCrater}
        setSelectedCrater={setSelectedCrater}
        selectedId={selectedId}
        onCraterClick={handleCraterClick}
        craters={craterData}
      />
    </animated.group>
  );
};

export default MarsComponent;