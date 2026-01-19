import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';

const CloudsComponent = ({ isTransitioning, isDarkMode }) => {
  const cloudsRef = useRef();
  
  // 云层动画
  const { opacity, scale } = useSpring({
    opacity: isTransitioning ? 0 : 1,
    scale: isTransitioning ? 2 : 1,
    config: { mass: 1, tension: 280, friction: 120 }
  });

  // 云层旋转
  useFrame(() => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <animated.group 
      ref={cloudsRef}
      scale={scale}
      opacity={opacity}
    >
      {/* 生成多层云 */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Cloud 
          key={i}
          position={[
            Math.sin(i / 5 * Math.PI * 2) * 5,
            (i - 2) * 2,
            Math.cos(i / 5 * Math.PI * 2) * 5
          ]}
          scale={[1 + i * 0.2, 1 + i * 0.1, 1 + i * 0.2]}
          rotation={[0, i * Math.PI / 5, 0]}
          opacity={opacity}
          isDarkMode={isDarkMode}
        />
      ))}
    </animated.group>
  );
};

// 单个云朵组件
const Cloud = ({ position, scale, rotation, opacity, isDarkMode }) => {
  const meshRef = useRef();
  
  // 云朵材质
  const material = new THREE.MeshStandardMaterial({
    color: isDarkMode ? '#444444' : '#ffffff',
    transparent: true,
    opacity: 0.8,
    roughness: 0.7,
    metalness: 0.2
  });

  return (
    <animated.mesh
      ref={meshRef}
      position={position}
      scale={scale}
      rotation={rotation}
      material={material}
      opacity={opacity}
    >
      <sphereGeometry args={[1, 16, 16]} />
    </animated.mesh>
  );
};

export default CloudsComponent;