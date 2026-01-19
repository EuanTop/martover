import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Clouds, Cloud } from '@react-three/drei';
import { animated, useSpring } from '@react-spring/three';

const CloudsComponent = ({ isDarkMode, cameraPosition, showMars, isTransitioning }) => {
  const cloudsRefs = useRef([]);
  const opacityRefs = useRef([]);

  // 不要立即将 shouldRemove 设为 true，而是给它一个延迟
  const [shouldRemove, setShouldRemove] = useState(false);
  
  // 修改透明度动画配置，确保与火星出现时序匹配
  const { opacity } = useSpring({
    opacity: showMars ? 0 : 1,
    // 调整动画配置，与火星出现保持同步
    config: { 
      mass: 1.5,
      tension: 100, // 降低张力使动画更平滑 
      friction: 80,
      // 延长动画时间，确保云朵逐渐消失，而不是突然消失
      duration: 4000  // 与火星出现的动画时间一致
    },
    // 只有当 showMars=true 时才触发
    onStart: () => {
      if (showMars) console.log("[云朵] 开始淡出动画");
    },
    onRest: () => {
      if (showMars) {
        console.log("[云朵] 淡出动画完成");
        // 添加额外延迟，确保火星完全出现后再移除云朵
        setTimeout(() => {
          console.log("[云朵] 组件即将移除");
          setShouldRemove(true);
        }, 1000);
      }
    }
  });

  // 添加一个云朵消失的时间线追踪
  useEffect(() => {
    if (showMars) {
      console.log("开始云朵消失过渡动画");
    }
  }, [showMars]);

  // 云层配置
  const cloudLayers = useMemo(() => {
    return Array(12).fill().map((_, i) => ({
      clouds: Array(8).fill().map(() => ({
        speed: ((0.05 + (i * 0.015)) * (Math.random() * 0.5 + 0.75)) * 7,
        baseOpacity: (isDarkMode ? 0.15 - (i * 0.015) : 0.12 - (i * 0.015)) * 0.26,
        offsetX: Math.random() * 30 - 15,
        offsetY: Math.random() * 16 - 8,
        scale: (0.5 + Math.random() * 0.5) * 2,
        rotationSpeed: (Math.random() * 0.0002 - 0.0001) * (i + 1),
      })),
      z: -5 - (i * 2),
    }));
  }, [isDarkMode]);

  const resetCloud = (ref, cloud) => {
    if (!ref || !ref.position) return;
    const randomOffset = Math.random() * 5 - 2.5;
    ref.position.x = cloud.offsetX + randomOffset;
    ref.position.y = cloud.offsetY + (Math.random() * 4 - 2);
    ref.position.z = -200;
  };

  useFrame((state, delta) => {
    cloudsRefs.current.forEach((layerRefs, i) => {
      if (!layerRefs) return;
      
      layerRefs.forEach((ref, j) => {
        if (!ref) return;
        
        const cloud = cloudLayers[i].clouds[j];
        
        // 调整过渡动画参数
        // 根据 isTransitioning 和 showMars 状态调整云的速度和透明度
        const speedMultiplier = isTransitioning ? 1.5 : (showMars ? 2 : 1); 
        ref.position.z += cloud.speed * delta * 60 * speedMultiplier;
        ref.rotation.z += cloud.rotationSpeed * delta * 60;
        
        const time = state.clock.elapsedTime;
        ref.position.x += Math.sin(time * 0.2 + i + j) * 0.03;
        ref.position.y += Math.cos(time * 0.15 + i + j) * 0.02;

        // 更新云的透明度，改进过渡效果
        if (ref.children[0] && ref.children[0].material) {
          if (showMars || isTransitioning) {
            // 使用更平滑的消失效果
            // 根据z位置渐变消失
            const zPosition = ref.position.z;
            const maxVisibleZ = 5; // 到达这个Z位置时开始消失
            const zFadeout = Math.max(0, 1 - (zPosition / maxVisibleZ));
            
            // 在转场期间额外降低云朵透明度
            const transitionFactor = isTransitioning ? 0.7 : 1;
            
            // 应用动画透明度计算
            const calculatedOpacity = cloud.baseOpacity * zFadeout * opacity.get() * transitionFactor;
            ref.children[0].material.opacity = calculatedOpacity;
          } else {
            ref.children[0].material.opacity = cloud.baseOpacity;
          }
        }

        // 当云朵移动到前方时的处理逻辑
        if (ref.position.z > 5) {
          // 如果在转场或显示火星，让云朵渐渐消失而不是突然消失
          if (showMars || isTransitioning) {
            if (ref.children[0] && ref.children[0].material) {
              // 渐变到完全透明
              ref.children[0].material.opacity *= 0.92; // 逐帧降低透明度
              
              // 当足够透明时，可以重置位置但保持不可见
              if (ref.children[0].material.opacity < 0.01) {
                resetCloud(ref, cloud);
                ref.children[0].material.opacity = 0; // 完全透明
              }
            }
          } else {
            resetCloud(ref, cloud);
          }
        }
      });
    });
  });

  // 只有在确认应该移除时才返回null
  if (shouldRemove) {
    console.log("云朵组件已完全移除");
    return null;
  }

  return (
    <animated.group position={cameraPosition.position} opacity={opacity}>
      <ambientLight intensity={isDarkMode ? 0.8 : 1.2} />
      
      {cloudLayers.map((layer, i) => (
        layer.clouds.map((cloud, j) => (
          <group 
            key={`${i}-${j}`}
            ref={el => {
              if (!cloudsRefs.current[i]) cloudsRefs.current[i] = [];
              cloudsRefs.current[i][j] = el;
            }}
            position={[cloud.offsetX, cloud.offsetY, layer.z]}
            scale={cloud.scale}
          >
            <Clouds texture="/imgs/cloud.png">
              <Cloud
                opacity={cloud.baseOpacity}
                speed={0.4}
                width={25}
                depth={30}
                segments={40}
                color={isDarkMode ? '#ffffff' : '#000000'}
                transparent={true}
              />
            </Clouds>
          </group>
        ))
      ))}
    </animated.group>
  );
};

export default CloudsComponent;