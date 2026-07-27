import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { EffectComposer, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import  { useCursorStore } from '../../store'
import CraterCultivationScene from '../../game/world/CraterCultivationScene';
import ColonyScene from '../../game/world/ColonyScene';
import CraterViewEffects from '../../game/world/CraterViewEffects';
import WorldCameraRig from '../../game/world/WorldCameraRig';
import { calculateCraterPosition } from '../../game/world/worldCoordinates';
import { getCraterHoleAngle } from '../../game/world/craterVisualModel';
import { VIEW_MODES } from '../../game/simulation/breedingSimulation';

// 在组件外部创建纹理缓存
const textureCache = {
  marsTexture: null,
  normalMap: null,
};

const Mars = ({
  craters = [],
  onCraterClick,
  selectedId,
  selectedCrater = null,
  showLines,
  isDarkMode,
  isInteractive,
  initialPosition = [0, 0, 0],
  scale = [1, 1, 1],
  featuresOpacity = 1,
  hideMarsModel = false,
  viewMode = VIEW_MODES.PLANET,
  children
}) => {
  const groupRef = useRef();
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const { gl } = useThree();

  // 球面开洞：坑体的坑底低于坑缘，若坑底要真的凹进球面，
  // 就必须在球面上挖掉对应位置，否则被闭合球体遮挡（穿模）。
  // discard 逐片元执行，洞缘精度与球体分段数无关；
  // uHoleCos > 1 时条件永不满足，即洞关闭，不需要重编译。
  const holeUniforms = useMemo(() => ({
    uHoleDir: { value: new THREE.Vector3(1, 0, 0) },
    uHoleCos: { value: 2 },
  }), []);

  const injectHoleShader = useMemo(() => (shader) => {
    shader.uniforms.uHoleDir = holeUniforms.uHoleDir;
    shader.uniforms.uHoleCos = holeUniforms.uHoleCos;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vMarsLocalPos;'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvMarsLocalPos = position;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vMarsLocalPos;\nuniform vec3 uHoleDir;\nuniform float uHoleCos;'
      )
      .replace(
        '#include <clipping_planes_fragment>',
        'if (dot(normalize(vMarsLocalPos), uHoleDir) > uHoleCos) discard;\n#include <clipping_planes_fragment>'
      );
  }, [holeUniforms]);

  const holeOpen = viewMode !== VIEW_MODES.PLANET && Boolean(selectedCrater);

  useEffect(() => {
    if (holeOpen) {
      holeUniforms.uHoleDir.value.set(...calculateCraterPosition(
        selectedCrater.latitude,
        selectedCrater.longitude,
        1
      ));
      holeUniforms.uHoleCos.value = Math.cos(getCraterHoleAngle(selectedCrater));
    } else {
      holeUniforms.uHoleCos.value = 2;
    }
  }, [holeOpen, selectedCrater, holeUniforms]);
  
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

  useEffect(() => {
    if (!texturesLoaded) return;

    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    const colorTexture = textureCache.marsTexture;
    const normalTexture = textureCache.normalMap;

    colorTexture.colorSpace = THREE.SRGBColorSpace;
    normalTexture.colorSpace = THREE.NoColorSpace;

    [colorTexture, normalTexture].forEach((texture) => {
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = maxAnisotropy;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
    });
  }, [gl, texturesLoaded]);
  
  // 将 useMemo 移到条件判断之前
  const { gridGeometry, labels } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const labels = [];
    
    // 经线和经度标签。与陨石坑标记共用 calculateCraterPosition，
    // 避免网格与坑点各自使用一套投影而互相错位。
    for (let i = -180; i < 180; i += 30) {
      for (let j = -90; j <= 90; j++) {
        vertices.push(...calculateCraterPosition(j, i));
      }

      // 只在赤道位置添加经度标签
      labels.push({
        position: calculateCraterPosition(0, i, 1.1),
        text: `${i > 0 ? i + '°E' : i < 0 ? Math.abs(i) + '°W' : '0°'}`,
        type: 'longitude',
        scale: 0.8
      });
    }
    
    // 纬线和纬度标签
    for (let i = -90; i <= 90; i += 30) {
      for (let j = -180; j <= 180; j++) {
        vertices.push(...calculateCraterPosition(i, j));
      }

      // 跳过赤道 (0度) 的标签，因为已经有经度的0度标签了
      if (i === 0) continue;

      const isPole = i === 90 || i === -90;

      // 添加纬度标签，包括极点
      labels.push({
        position: isPole
          ? [0, 1.1 * Math.sign(i), 0]
          : calculateCraterPosition(i, 0, 1.1),
        text: `${i > 0 ? i + '°N' : Math.abs(i) + '°S'}`,
        type: 'latitude',
        scale: isPole ? 0.6 : 0.8  // 极点标签稍小
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
          <sphereGeometry args={[1, 96, 96]} />
          <meshStandardMaterial
            map={textureCache.marsTexture}
            normalMap={textureCache.normalMap}
            normalScale={new THREE.Vector2(0.42, 0.42)}
            roughness={0.92}
            onBeforeCompile={injectHoleShader}
          />
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
          position={calculateCraterPosition(crater.latitude, crater.longitude)}
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
      {children}
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
  hideMarsModel = false,
  viewMode = VIEW_MODES.PLANET,
  simulation,
  colony,
  activeBase,
  selectedColonyTool,
  onColonyCellClick,
  selectedTuberUse,
  selectedIntervention,
  onPlantInZone,
  onAssignTuber,
  onApplyIntervention,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const controlsRef = useRef();
  const isCloseView = (
    viewMode === VIEW_MODES.CRATER || viewMode === VIEW_MODES.HUMAN
  );
  const planetControlsEnabled = (
    isInteractive && viewMode === VIEW_MODES.PLANET
  );

  // 近景主光位置：沿选中坑地表切平面以 38 度仰角斜射，
  // 保证任何纬度的坑都有一致的浮雕光照。
  const closeLightPosition = useMemo(() => {
    if (!selectedCrater) return null;

    const normal = new THREE.Vector3(...calculateCraterPosition(
      selectedCrater.latitude,
      selectedCrater.longitude,
      1
    ));
    const tangent = new THREE.Vector3(0, 1, 0).cross(normal);

    if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
    tangent.normalize();

    const elevation = THREE.MathUtils.degToRad(38);

    return normal
      .multiplyScalar(Math.sin(elevation))
      .add(tangent.multiplyScalar(Math.cos(elevation)))
      .multiplyScalar(10)
      .toArray();
  }, [selectedCrater]);

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
      {/* 近景：低环境光 + 斜射方向光。旧值 ambient 1.35 压倒方向光，
          地形起伏没有明暗层次（灌白光）。方向光沿选中坑的地表切向
          以约 38 度仰角斜射，每个坑都有浮雕感，且方向随坑连续。 */}
      <ambientLight intensity={isCloseView ? 0.45 : 3} />
      {isCloseView && closeLightPosition ? (
        <directionalLight
          position={closeLightPosition}
          intensity={1.1}
          color="#ffdfc0"
        />
      ) : (
        <pointLight position={[10, 10, 10]} intensity={1} />
      )}
      <Mars
        craters={craters}
        onCraterClick={(crater, index) => handleCraterClick(crater, index)}
        selectedId={selectedId}
        selectedCrater={selectedCrater}
        showLines={showLines}
        isDarkMode={isDarkMode}
        isInteractive={isInteractive && viewMode === VIEW_MODES.PLANET}
        initialPosition={initialPosition}
        scale={scale}
        hideMarsModel={hideMarsModel}
        viewMode={viewMode}
      >
        {selectedCrater
          && (
            viewMode === VIEW_MODES.CRATER
            || viewMode === VIEW_MODES.HUMAN
          ) && (colony && activeBase ? (
            <ColonyScene
              crater={selectedCrater}
              colony={colony}
              base={activeBase}
              selectedTool={selectedColonyTool}
              onCellAction={onColonyCellClick}
            />
          ) : simulation && (
            <CraterCultivationScene
              crater={selectedCrater}
              simulation={simulation}
              selectedUse={selectedTuberUse}
              selectedIntervention={selectedIntervention}
              onPlantInZone={onPlantInZone}
              onAssignTuber={onAssignTuber}
              onApplyIntervention={onApplyIntervention}
            />
          ))}
      </Mars>
      <WorldCameraRig
        controlsRef={controlsRef}
        viewMode={viewMode}
        selectedCrater={selectedCrater}
      />
      <OrbitControls 
        ref={controlsRef}
        enabled={planetControlsEnabled}
        enableZoom={planetControlsEnabled}
        enableRotate={planetControlsEnabled}
        enablePan={false}
        minDistance={viewMode === VIEW_MODES.PLANET ? 2.8 : 0.03}
        maxDistance={viewMode === VIEW_MODES.PLANET ? 9 : 1.4}
        dampingFactor={0.075}
        enableDamping
      />
      {isCloseView && (
        <EffectComposer
          multisampling={4}
          enableNormalPass={false}
        >
          <CraterViewEffects sharpness={1.52} contrast={0.12} />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
};

export default MarsGlobe;
