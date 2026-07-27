// 超级土豆植株。一个坑只长这一棵，所以渲染预算全部砸在它身上：
// 旧实现要同时画 26 株，每株只能是「圆柱茎 + 4 个压扁球叶」，
// 从发芽起就粗糙。现在只有一株，可以做真正的土豆形态。
//
// 写实要点（决定「一眼认得出是土豆」的三件事）：
// 1. 羽状复叶：一根叶轴上对生多对小叶，末端一片顶小叶。这是茄科
//    土豆叶最强的识别特征，比叶子的绿色重要得多。
// 2. 块茎：不规则膨大的椭球，表面有芽眼凹陷，不是光滑的球。
// 3. 花：白紫色五瓣，中心黄色花药束 —— 土豆开花是标志性画面。
//
// 火星异化：叶片带紫红边（花青素抗辐射）、块茎奶白偏暖并有清漆
// 高光、极轻微自发光。与现有 #F57435 / #562913 的美术基调一致。

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { seededUnit } from '../util/deterministic';

// ─── 生长阶段 ─────────────────────────────────────────────────
// 0-15%   破土：芽尖顶开土面
// 15-45%  展叶：茎伸长，复叶自下而上展开
// 45-70%  盛期：叶完全展开，开花
// 70-100% 结薯：花谢，地下块茎膨大顶破土面
export const POTATO_STAGES = Object.freeze({
  SPROUT: 0.15,
  FOLIAGE: 0.45,
  FLOWER: 0.7,
});

// 单片小叶：椭圆形、中脉下凹。用缩放过的球体做出叶片的厚薄变化，
// 比压扁的立方体自然，且顶点数可控。
const Leaflet = ({ length, tint }) => (
  <mesh scale={[length * 0.62, length * 0.12, length]}>
    <sphereGeometry args={[1, 10, 7]} />
    <meshStandardMaterial
      color={tint}
      roughness={0.72}
      metalness={0.05}
      side={THREE.DoubleSide}
    />
  </mesh>
);

// 羽状复叶：一根叶轴 + 若干对生小叶 + 一片顶小叶。
// 这是土豆叶的关键特征，没有它就只是「一丛绿色」。
const CompoundLeaf = ({ scale, unfurl, leafColor, edgeColor, pairs = 3 }) => {
  const axisLength = 0.052 * scale;
  const droop = (1 - unfurl) * 0.9;

  return (
    <group rotation={[droop, 0, 0]}>
      {/* 叶轴 */}
      <mesh position={[0, 0, axisLength * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0016 * scale, 0.0022 * scale, axisLength, 5]} />
        <meshStandardMaterial color={edgeColor} roughness={0.85} />
      </mesh>

      {Array.from({ length: pairs }, (_, index) => {
        const t = (index + 1) / (pairs + 1);
        const z = axisLength * t;
        // 越靠基部的小叶越大，符合真实复叶的渐变。
        const size = 0.02 * scale * (1.15 - t * 0.35) * unfurl;

        return (
          <group key={index} position={[0, 0, z]}>
            {[-1, 1].map((side) => (
              <group
                key={side}
                position={[side * size * 0.62, 0, 0]}
                rotation={[0, 0, side * (0.45 + droop * 0.5)]}
              >
                <Leaflet length={size} tint={leafColor} />
              </group>
            ))}
          </group>
        );
      })}

      {/* 顶小叶：复叶末端单生的一片，比侧小叶大 */}
      <group position={[0, 0, axisLength * 1.08]}>
        <Leaflet length={0.024 * scale * unfurl} tint={leafColor} />
      </group>
    </group>
  );
};

// 土豆花：白紫五瓣 + 中心黄色花药束。开花是「这是土豆」最直观的
// signal，只在盛期出现，结薯期凋谢。
const PotatoFlower = ({ scale, open }) => {
  if (open <= 0.01) return null;

  return (
    <group scale={open}>
      {Array.from({ length: 5 }, (_, index) => {
        const angle = (index / 5) * Math.PI * 2;

        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * 0.009 * scale,
              0,
              Math.sin(angle) * 0.009 * scale,
            ]}
            rotation={[Math.PI / 2.4, -angle, 0]}
            scale={[0.009 * scale, 0.0022 * scale, 0.012 * scale]}
          >
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial
              color="#e8dcf2"
              roughness={0.5}
              emissive="#a98fd0"
              emissiveIntensity={0.18}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
      {/* 花药束 */}
      <mesh position={[0, 0.003 * scale, 0]}>
        <coneGeometry args={[0.0035 * scale, 0.008 * scale, 6]} />
        <meshStandardMaterial
          color="#f5c24b"
          roughness={0.45}
          emissive="#d99a1e"
          emissiveIntensity={0.35}
        />
      </mesh>
    </group>
  );
};

// 块茎：不规则膨大椭球 + 芽眼凹陷。奶白偏暖 + 清漆高光，
// 与二/三关的成熟土豆同一套质感语言。
const Tuber = ({ size, seed, index, quality }) => {
  const shape = useMemo(() => {
    const u = (k) => seededUnit(seed, index * 31 + k);
    return {
      scale: [
        size * (0.92 + u(1) * 0.3),
        size * (0.78 + u(2) * 0.22),
        size * (1.0 + u(3) * 0.34),
      ],
      rotation: [u(4) * 1.2, u(5) * Math.PI * 2, u(6) * 0.8],
      // 芽眼位置
      eyes: Array.from({ length: 3 }, (_, e) => ({
        theta: u(10 + e * 3) * Math.PI * 2,
        phi: 0.6 + u(11 + e * 3) * 1.6,
      })),
    };
  }, [index, seed, size]);

  // 养护差的土豆偏干瘪土黄，养护好的饱满奶白。
  const skin = quality >= 0.6 ? '#f3e3c6' : quality >= 0.3 ? '#e2c9a0' : '#c9a87c';

  return (
    <group rotation={shape.rotation}>
      <mesh scale={shape.scale}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshStandardMaterial
          color={skin}
          roughness={0.52}
          metalness={0.16}
          emissive="#6b3a1c"
          emissiveIntensity={0.05}
        />
      </mesh>

      {/* 芽眼：小凹坑，用深色扁球贴在表面近似 */}
      {shape.eyes.map((eye, e) => (
        <mesh
          key={e}
          position={[
            Math.sin(eye.phi) * Math.cos(eye.theta) * shape.scale[0] * 0.94,
            Math.cos(eye.phi) * shape.scale[1] * 0.94,
            Math.sin(eye.phi) * Math.sin(eye.theta) * shape.scale[2] * 0.94,
          ]}
          scale={size * 0.16}
        >
          <sphereGeometry args={[1, 6, 5]} />
          <meshStandardMaterial color="#8a5a34" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

const SuperPotato = ({ growth = 0, quality = 0.5, seed = 1, radius = 0.06 }) => {
  const groupRef = useRef();
  const g = THREE.MathUtils.clamp(growth / 100, 0, 1);

  // 整株按格子半径标定，换格子大小不用改模型内部数值。
  const scale = radius * 14;

  const stemHeight = THREE.MathUtils.lerp(
    0.012,
    0.088,
    THREE.MathUtils.smoothstep(g, 0, POTATO_STAGES.FOLIAGE)
  ) * scale;

  // 叶片数量随生长增加，自下而上展开。
  const leafCount = g < POTATO_STAGES.SPROUT ? 0
    : g < POTATO_STAGES.FOLIAGE ? 3 : 6;

  // 开花：盛期开、结薯期谢。
  const flowerOpen = THREE.MathUtils.clamp(
    Math.min(
      (g - POTATO_STAGES.FOLIAGE) / 0.12,
      (0.92 - g) / 0.12
    ),
    0,
    1
  );

  // 块茎：结薯期开始膨大，顶破土面。
  const tuberGrow = THREE.MathUtils.clamp(
    (g - POTATO_STAGES.FLOWER) / (1 - POTATO_STAGES.FLOWER),
    0,
    1
  );

  // 火星异化：叶片带花青素紫红边，养护差时更明显（胁迫反应）。
  const leafColor = quality >= 0.55 ? '#5f7a4a' : '#6b6f42';
  const edgeColor = quality >= 0.55 ? '#7a4a52' : '#8a4436';

  useFrame((state) => {
    if (!groupRef.current) return;
    // 极轻微的整株摇曳，避免画面死板；不逐叶片起 useFrame。
    const sway = Math.sin(state.clock.elapsedTime * 0.7) * 0.02;
    groupRef.current.rotation.z = sway;
    groupRef.current.rotation.x = sway * 0.5;
  });

  if (g <= 0.001) return null;

  return (
    <group ref={groupRef}>
      {/* 主茎：土豆茎有棱，用少边数圆柱体现 */}
      <mesh position={[0, stemHeight * 0.5, 0]}>
        <cylinderGeometry
          args={[0.004 * scale, 0.007 * scale, stemHeight, 5]}
        />
        <meshStandardMaterial color={edgeColor} roughness={0.88} />
      </mesh>

      {/* 羽状复叶，绕茎螺旋着生 */}
      {Array.from({ length: leafCount }, (_, index) => {
        const t = (index + 0.6) / leafCount;
        const angle = index * 2.399; // 黄金角，自然的叶序
        const y = stemHeight * (0.28 + t * 0.68);
        const unfurl = THREE.MathUtils.clamp(g * 2.4 - t * 0.9, 0.05, 1);
        const leafScale = scale * (0.85 + (1 - t) * 0.35);

        return (
          <group
            key={index}
            position={[0, y, 0]}
            rotation={[0, angle, 0.22]}
          >
            <group position={[0.006 * scale, 0, 0]}>
              <CompoundLeaf
                scale={leafScale}
                unfurl={unfurl}
                leafColor={leafColor}
                edgeColor={edgeColor}
              />
            </group>
          </group>
        );
      })}

      {/* 顶端花序 */}
      {flowerOpen > 0.01 && (
        <group position={[0, stemHeight * 1.02, 0]}>
          {[0, 1, 2].map((index) => {
            const angle = index * 2.1;
            return (
              <group
                key={index}
                position={[
                  Math.cos(angle) * 0.012 * scale,
                  index * 0.004 * scale,
                  Math.sin(angle) * 0.012 * scale,
                ]}
              >
                <PotatoFlower scale={scale} open={flowerOpen} />
              </group>
            );
          })}
        </group>
      )}

      {/* 地下块茎：结薯期半埋着顶破土面 */}
      {tuberGrow > 0.02 && (
        <group>
          {[0, 1, 2].map((index) => {
            const angle = index * 2.35 + 0.4;
            const dist = (0.026 + index * 0.006) * scale;
            const size = (0.011 + tuberGrow * 0.016) * scale
              * (0.85 + quality * 0.3);

            return (
              <group
                key={index}
                position={[
                  Math.cos(angle) * dist,
                  // 70% 沉入土面，只露出顶部 —— 半埋才有「顶破土」的感觉
                  -size * 0.55,
                  Math.sin(angle) * dist,
                ]}
              >
                <Tuber
                  size={size}
                  seed={seed}
                  index={index}
                  quality={quality}
                />
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
};

export default React.memo(SuperPotato);
