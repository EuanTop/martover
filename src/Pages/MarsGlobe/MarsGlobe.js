import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import VisShape from '../../Components/VisShape/VisShape';
import { OverlayBackground } from '../../Components/OverlayLayers'
import Panel from '../../Components/Panel';
import  { useCursorStore } from '../../store'

// 在组件外部创建纹理缓存
const textureCache = {
  marsTexture: null,
  normalMap: null
};

const Mars = ({ 
  craters = [],
  onCraterClick, 
  selectedId, 
  showLines, 
  isDarkMode,
  isInteractive,
  initialPosition = [0, 0, 0],
  scale = [1, 1, 1],
  featuresOpacity = 1,
  hideMarsModel = false
}) => {
  const groupRef = useRef();
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const { camera, viewport } = useThree();
  
  // 使用 useTexture 替代 useLoader，并利用缓存
  useEffect(() => {
    const loadTextures = () => {
      // 如果缓存中没有纹理，则加载
      if (!textureCache.marsTexture || !textureCache.normalMap) {
        const textureLoader = new THREE.TextureLoader();
        
        // 加载纹理并存入缓存
        Promise.all([
          new Promise(resolve => {
            textureLoader.load('/marsmap_normal.jpg', texture => {
              textureCache.marsTexture = texture;
              resolve();
            });
          }),
          new Promise(resolve => {
            textureLoader.load('/mars_normal.jpg', texture => {
              textureCache.normalMap = texture;
              resolve();
            });
          })
        ]).then(() => {
          setTexturesLoaded(true);
        });
      } else {
        // 如果已经有缓存的纹理，直接设置为已加载
        setTexturesLoaded(true);
      }
    };
    
    loadTextures();
  }, [hideMarsModel]); // 添加hideMarsModel依赖，确保纹理在显示/隐藏时重新检查
  
  // 将 useMemo 移到条件判断之前
  const { gridGeometry, labels } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const labels = [];
    
    // 经线和经度标签
    for (let i = -180; i < 180; i += 30) {  // 改为 < 180，避免重复
      const theta = i * Math.PI / 180;
      for (let j = -90; j <= 90; j++) {
        const phi = j * Math.PI / 180;
        const x = Math.cos(phi) * Math.cos(theta);
        const y = Math.sin(phi);
        const z = Math.cos(phi) * Math.sin(theta);
        vertices.push(x, y, z);
      }
      
      // 只在赤道位置添加经度标签
      labels.push({
        position: [
          1.1 * Math.cos(theta), 
          0,
          1.1 * Math.sin(theta)
        ],
        text: `${i > 0 ? i + '°E' : i < 0 ? Math.abs(i) + '°W' : '0°'}`,
        type: 'longitude',
        scale: 0.8
      });
    }
    
    // 纬线和纬度标签
    for (let i = -90; i <= 90; i += 30) {
      // 跳过赤道 (0度) 的标签，因为已经有经度的0度标签了
      if (i === 0) {
        // 仍然需要添加纬线的顶点
        for (let j = -180; j <= 180; j++) {
          const theta = j * Math.PI / 180;
          const phi = i * Math.PI / 180;
          const x = Math.cos(phi) * Math.cos(theta);
          const y = Math.sin(phi);
          const z = Math.cos(phi) * Math.sin(theta);
          vertices.push(x, y, z);
        }
        continue; // 跳过添加标签
      }
      
      const phi = i * Math.PI / 180;
      for (let j = -180; j <= 180; j++) {
        const theta = j * Math.PI / 180;
        const x = Math.cos(phi) * Math.cos(theta);
        const y = Math.sin(phi);
        const z = Math.cos(phi) * Math.sin(theta);
        vertices.push(x, y, z);
      }
      
      // 添加纬度标签，包括极点
      labels.push({
        position: [
          i === 90 || i === -90 ? 0 : 1.1 * Math.cos(phi),  // 极点位置特殊处理
          1.1 * Math.sin(phi),
          0
        ],
        text: `${i > 0 ? i + '°N' : Math.abs(i) + '°S'}`,
        type: 'latitude',
        scale: i === 90 || i === -90 ? 0.6 : 0.8  // 极点标签稍小
      });
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return { gridGeometry: geometry, labels };
  }, []);

  if (!texturesLoaded) return null;

  return (
    <group ref={groupRef} position={initialPosition} scale={scale}>
      {!hideMarsModel && (
        <mesh>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial map={textureCache.marsTexture} normalMap={textureCache.normalMap} />
        </mesh>
      )}
      {showLines && isInteractive && (
        <lineSegments geometry={gridGeometry}>
          <lineBasicMaterial 
            color={isDarkMode ? "white" : "black"} 
            opacity={featuresOpacity} 
            transparent
          />
        </lineSegments>
      )}
      {Array.isArray(craters) && craters.map((crater, index) => (
        <Crater 
          key={index} 
          position={calculatePosition(crater.latitude, crater.longitude)}
          onClick={() => isInteractive && onCraterClick?.(crater, index)}
          isSelected={selectedId === index}
          isVisible={(selectedId === null || selectedId === index) && isInteractive}
          showLines={showLines && isInteractive} 
          isDarkMode={isDarkMode}
          opacity={featuresOpacity}
        />
      ))}
      {showLines && isInteractive && (
        <LabelsContainer 
          labels={labels} 
          isDarkMode={isDarkMode} 
          opacity={featuresOpacity}
        />
      )}
    </group>
  );
};

// 标签容器组件
const LabelsContainer = ({ labels, isDarkMode }) => {
  const { camera } = useThree();
  
  return (
    <group>
      {labels.map((label, index) => (
        <Label 
          key={index}
          position={label.position}
          text={label.text}
          type={label.type}
          scale={label.scale}
          isDarkMode={isDarkMode}
        />
      ))}
    </group>
  );
};

const Label = ({ position, text, type, scale = 1, isDarkMode }) => {
  const { camera } = useThree();
  const textRef = useRef();

  useFrame(() => {
    if (textRef.current) {
      textRef.current.lookAt(camera.position);
      
      // 计算标签到相机的距离，实现远近缩放
      const distance = camera.position.distanceTo(textRef.current.position);
      const scaleFactor = Math.max(0.5, Math.min(1, 3 / distance));
      textRef.current.scale.setScalar(scale * scaleFactor);
    }
  });

  return (
    <Text
      ref={textRef}
      position={position}
      fontSize={0.05}
      color={isDarkMode ? "white" : "black"}
      anchorX="center"
      anchorY="middle"
      backgroundColor={isDarkMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)"}
      padding={[0.01, 0.02]}
    >
      {text}
    </Text>
  );
};

const Crater = ({ 
  position, 
  onClick, 
  isSelected, 
  isVisible, 
  showLines, 
  isDarkMode, 
  opacity = 1
}) => {
  
  const setCursorType = useCursorStore(state => state.setType);
  const handlePointerOver = (e) => {
    e.stopPropagation();
    setCursorType('hover');
  };

  const handlePointerOut = (e) => {
    setCursorType('default');
  };

  const lineRef = useRef();
  const materialRef = useRef();
  const direction = new THREE.Vector3(...position).normalize();
  
  const lineStart = new THREE.Vector3(...position);
  const lineEnd = new THREE.Vector3().copy(direction).multiplyScalar(2);
  
  // 创建渐变线的几何体和颜色
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const offset = new THREE.Vector3(0.006 * Math.cos(angle), 0.006 * Math.sin(angle), 0);
      
      // 为每条线添加顶点
      for (let j = 0; j <= 10; j++) {  // 增加线段细分数
        const t = j / 10;
        const pos = new THREE.Vector3().lerpVectors(lineStart, lineEnd, t).add(
          offset.clone().multiplyScalar(1 + t * 0.8)
        );
        positions.push(pos.x, pos.y, pos.z);
        
        // 设置渐变颜色
        const alpha = Math.pow(1 - t, 2);  // 使用二次函数使渐变更自然
        colors.push(1, 1, 1, alpha);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    return geometry;
  }, [position]);

  useFrame((state) => {
    if (materialRef.current) {
      const time = state.clock.getElapsedTime();
      materialRef.current.opacity = isSelected 
        ? 0.6 + Math.sin(time * 5) * 0.4
        : 0.4 + Math.sin(time * 3) * 0.3;
    }
  });

  if (!isVisible) return null;

  const getColor = () => {
    if (isSelected) return isDarkMode ? "#FF722C" : "#ffffff";
    return isDarkMode ? "#ffffff" : "#000000";
  };

  return (
    <group>
      <mesh 
        position={position}
        onClick={onClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.015, 16, 16]} />
        <meshBasicMaterial color={getColor()} />
      </mesh>
      
      {showLines && (
        <lineSegments geometry={lineGeometry}>
          <lineBasicMaterial 
            ref={materialRef}
            vertexColors={true}
            transparent={true}
            color={getColor()}
            opacity={1}
            linewidth={2}
          />
        </lineSegments>
      )}
    </group>
  );
};

const calculatePosition = (lat, lon) => {
  // 交换经纬度的计算顺序
  const latRad = (90 - lon) * (Math.PI / 180);  // 将纬度转换为与Y轴的夹角
  const lonRad = -lat * (Math.PI / 180);        // 经度方向取反以匹配右手坐标系
  
  // 球面坐标转换为笛卡尔坐标
  return [
    Math.sin(latRad) * Math.cos(lonRad),  // x 坐标
    Math.cos(latRad),                      // y 坐标 (北极为正)
    Math.sin(latRad) * Math.sin(lonRad)    // z 坐标
  ];
};

const MarsGlobe = ({ 
  craters = [],
  isDarkMode, 
  setIsDarkMode, 
  showLines, 
  setShowLines, 
  selectedCrater, 
  setSelectedCrater,
  isInteractive = true,
  initialPosition = [0, 0, -20],
  scale = [1, 1, 1],
  hideMarsModel = false
}) => {
  const [selectedId, setSelectedId] = useState(null);

  // 当外部传入的 selectedCrater 为 null 时，重置内部选中状态
  useEffect(() => {
    if (!selectedCrater) {
      setSelectedId(null);
    }
  }, [selectedCrater]);

  const handleCraterClick = (crater, index) => {
    if (selectedId === index) {
      setSelectedCrater(null);
      setSelectedId(null);
    } else {
      setSelectedCrater(crater);
      setSelectedId(index);
    }
  };

  return (
    <>
      <ambientLight intensity={3} />
      <pointLight position={[10, 10, 10]} />
      <Mars 
        craters={craters} 
        onCraterClick={(crater, index) => handleCraterClick(crater, index)}
        selectedId={selectedId}
        showLines={showLines} 
        isDarkMode={isDarkMode}
        isInteractive={isInteractive}
        initialPosition={initialPosition}
        scale={scale}
        hideMarsModel={hideMarsModel}
      />
      <OrbitControls 
        enabled={isInteractive}
        enableZoom={isInteractive}  
        enableRotate={isInteractive}
        enablePan={isInteractive}
      />
    </>
  );
};

export default MarsGlobe;