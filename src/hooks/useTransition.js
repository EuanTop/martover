import { useState } from 'react';
import { useSpring } from '@react-spring/three';
import { INTRO_COMPLETED_KEY } from '../context/AppContext';

export const useTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showMars, setShowMars] = useState(() => {
    return localStorage.getItem(INTRO_COMPLETED_KEY) === 'true';
  });
  const [marsFullyRendered, setMarsFullyRendered] = useState(false);

  // 相机位置动画
  const [cameraPosition, setCameraPosition] = useSpring(() => ({
    position: localStorage.getItem(INTRO_COMPLETED_KEY) === 'true' 
      ? [0, 0, 30]  // 如果已完成介绍，直接设置为火星视角
      : [0, 0, 10], // 否则设置为初始视角
    config: { mass: 1, tension: 280, friction: 120 }
  }));

  // 处理探索点击
  const handleExploreClick = () => {
    // 第一步：设置转场状态
    setIsTransitioning(true);
    console.log("[探索流程] 1. 开始转场，isTransitioning=true");
    
    // 第二步：延迟一点点再开始相机移动
    setTimeout(() => {
      console.log("[探索流程] 2. 开始相机移动");
      setCameraPosition({
        position: [0, 0, 30],
        config: { 
          mass: 1, 
          tension: 180,
          friction: 90,
          duration: 5000
        },
        onRest: () => {
          console.log("[探索流程] 3. 相机移动完成");
          setTimeout(() => {
            console.log("[探索流程] 4. 设置showMars=true，火星开始出现");
            setShowMars(true);
            
            setTimeout(() => {
              console.log("[探索流程] 5. 转场结束，isTransitioning=false");
              setIsTransitioning(false);
              localStorage.setItem(INTRO_COMPLETED_KEY, 'true');
            }, 2500);
          }, 800);
        }
      });
    }, 100);
  };

  return {
    isTransitioning,
    setIsTransitioning,
    showMars,
    setShowMars,
    marsFullyRendered,
    setMarsFullyRendered,
    cameraPosition,
    handleExploreClick
  };
};