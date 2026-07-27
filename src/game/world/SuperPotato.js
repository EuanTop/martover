// 超级土豆植株。一个坑只长这一棵，所以它按**坑半径**标定而不是
// 按格子半径 —— 格子只是它的落点，不是它的尺寸约束。
//
// 上一版把 scale 绑在 footprintRadius(0.0516) 上，满生长茎高只有
// 0.0636，占坑半径 6.9%，在实机里小到看不清任何细节，羽状复叶、
// 芽眼、花全部白做。现在按 TERRAIN_RADIUS 标定，成熟株高约占坑
// 半径一半，是坑内绝对的视觉主体（设施模型只有 0.024-0.042）。
//
// 只有一株，渲染预算全砸在它身上：
// - 小叶 20x14 段 + 中脉凹陷 + 锯齿边缘
// - 复叶 5 对小叶 + 顶小叶（羽状复叶是土豆叶最强的识别特征）
// - 全株 14 片复叶，分三层（基部大叶 / 中部展叶 / 顶部新叶）
// - 4 根分蘖茎（土豆是丛生的，不是单杆）
// - 块茎 6 颗，顶点位移做真正的不规则表面，2-3 颗半露出土面
// - 伞形花序，花瓣用自定义几何而非压扁球
//
// 火星异化：叶片带花青素紫红边（养护差时更明显）、块茎奶白偏暖
// 带清漆高光、极轻微自发光。

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { seededUnit } from '../util/deterministic';
import { TERRAIN_RADIUS } from './terrainBands';

// ─── 生长阶段 ─────────────────────────────────────────────────
// 上一版 45% 就到满茎高，之后只有花和块茎在变；放大后这条曲线会
// 显得「长完了还在干等」。现在茎高一直长到 85%，全期都有可见变化。
export const POTATO_STAGES = Object.freeze({
  SPROUT: 0.12,   // 破土：芽尖顶开土面
  FOLIAGE: 0.4,   // 展叶：分蘖茎抽出，复叶自下而上展开
  FLOWER: 0.62,   // 盛期：伞形花序开放
  TUBER: 0.72,    // 结薯：花谢，块茎膨大顶破土面
});

// 成熟株高 = 坑半径的这个比例。0.5 让它占满坑底又不至于捅出坑口。
const MATURE_HEIGHT_RATIO = 0.5;
const PLANT_SCALE = TERRAIN_RADIUS * MATURE_HEIGHT_RATIO;

// 种植床标签的悬挂高度：必须在满生长植株之上，否则被叶丛盖住。
export const PLANT_LABEL_HEIGHT = PLANT_SCALE * 1.22;

// ─── 几何构建器 ───────────────────────────────────────────────

// 小叶：椭圆叶片 + 中脉下凹 + 锯齿边缘。
// 用参数化平面变形，比缩放球体能做出真正的叶形。
const createLeafletGeometry = () => {
  const segU = 20;
  const segV = 14;
  const geometry = new THREE.PlaneGeometry(1, 1, segU, segV);
  const pos = geometry.attributes.position;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // u: 沿叶长 0(基部)→1(叶尖)；v: 沿叶宽 -1→1
    const u = y + 0.5;
    const v = x * 2;

    // 叶形轮廓：基部窄、中部最宽、叶尖收成锐尖（卵形）
    const width = Math.sin(Math.pow(u, 0.62) * Math.PI) * (1 - u * 0.26);
    // 锯齿边缘：土豆小叶边缘是全缘偏波状，做轻微起伏而非尖齿
    const serration = 1 + Math.sin(u * Math.PI * 7) * 0.045;

    const nx = v * 0.5 * width * serration;
    const ny = (u - 0.5) * 1.06;
    // 中脉下凹：越靠中脉越低，形成 V 形横截面；叶尖略下垂
    const nz = -Math.pow(1 - Math.abs(v), 2) * 0.11
      - Math.pow(u, 2.4) * 0.16;

    pos.setXYZ(i, nx, ny, nz);
  }

  geometry.computeVertexNormals();
  return geometry;
};

// 块茎：椭球 + 多频顶点位移，做出真正不规则的表面（不是缩放球），
// 再按芽眼位置压出凹坑。
const createTuberGeometry = (seedValue) => {
  const geometry = new THREE.SphereGeometry(1, 26, 20);
  const pos = geometry.attributes.position;
  const n = (k) => seededUnit(seedValue, k);

  // 3 个芽眼的球面位置
  const eyes = Array.from({ length: 3 }, (_, e) => {
    const theta = n(40 + e * 5) * Math.PI * 2;
    const phi = 0.7 + n(41 + e * 5) * 1.5;
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    );
  });

  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();

    // 多频起伏：低频决定整体不规则轮廓，高频做表皮的细微凹凸
    const low = Math.sin(dir.x * 2.1 + n(1) * 6) * Math.cos(dir.y * 1.7 + n(2) * 6);
    const mid = Math.sin(dir.y * 4.3 + n(3) * 6) * Math.cos(dir.z * 3.9 + n(4) * 6);
    const high = Math.sin(dir.x * 9.1 + n(5) * 6) * Math.sin(dir.z * 8.3 + n(6) * 6);
    let r = 1 + low * 0.15 + mid * 0.07 + high * 0.022;

    // 芽眼：在球面上压出小凹坑
    eyes.forEach((eye) => {
      const d = dir.distanceTo(eye);
      if (d < 0.34) {
        r -= (1 - d / 0.34) ** 2 * 0.13;
      }
    });

    v.copy(dir).multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geometry.computeVertexNormals();
  return geometry;
};

// 花瓣：土豆花是合瓣的五角星形，用扇形平面加中脉折角。
const createPetalGeometry = () => {
  const geometry = new THREE.PlaneGeometry(1, 1, 10, 10);
  const pos = geometry.attributes.position;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = y + 0.5;
    const v = x * 2;

    // 基部窄、中段宽、尖端收成角 —— 五角星的一个角
    const width = Math.sin(Math.pow(u, 0.5) * Math.PI * 0.92) * (1 - u * 0.45);
    pos.setXYZ(
      i,
      v * 0.5 * width,
      (u - 0.5) * 1.05,
      // 花瓣向内兜，中脉略折
      -Math.pow(1 - Math.abs(v), 2) * 0.07 - u * u * 0.1
    );
  }

  geometry.computeVertexNormals();
  return geometry;
};

// ─── 组件 ─────────────────────────────────────────────────────

const Leaflet = ({ geometry, length, material }) => (
  <mesh
    geometry={geometry}
    material={material}
    scale={[length * 0.66, length, length]}
  />
);

// 羽状复叶：一根叶轴 + 5 对生小叶 + 顶小叶。
// 这是土豆叶最强的识别特征，比「叶子是绿色」重要得多。
const CompoundLeaf = ({
  leafGeometry, leafMaterial, stemMaterial, scale, unfurl, pairs = 5,
}) => {
  const axisLength = 0.34 * scale;
  const droop = (1 - unfurl) * 0.95;

  return (
    <group rotation={[droop, 0, 0]}>
      {/* 叶轴 */}
      <mesh
        position={[0, 0, axisLength * 0.5]}
        rotation={[Math.PI / 2, 0, 0]}
        material={stemMaterial}
      >
        <cylinderGeometry args={[0.007 * scale, 0.011 * scale, axisLength, 6]} />
      </mesh>

      {Array.from({ length: pairs }, (_, index) => {
        const t = (index + 1) / (pairs + 1);
        const z = axisLength * t;
        // 越靠基部的小叶越大，符合真实复叶的渐变
        const size = 0.125 * scale * (1.2 - t * 0.42) * unfurl;
        // 小叶也随展开度上扬
        const lift = (1 - unfurl) * 0.6;

        return (
          <group key={index} position={[0, 0, z]}>
            {[-1, 1].map((side) => (
              <group
                key={side}
                position={[side * size * 0.58, 0, 0]}
                rotation={[
                  -Math.PI / 2 + lift,
                  side * (0.42 + droop * 0.45),
                  0,
                ]}
              >
                <Leaflet
                  geometry={leafGeometry}
                  material={leafMaterial}
                  length={size}
                />
              </group>
            ))}
          </group>
        );
      })}

      {/* 顶小叶：复叶末端单生的一片，比侧小叶大 */}
      <group
        position={[0, 0, axisLength * 1.1]}
        rotation={[-Math.PI / 2 + (1 - unfurl) * 0.6, 0, 0]}
      >
        <Leaflet
          geometry={leafGeometry}
          material={leafMaterial}
          length={0.15 * scale * unfurl}
        />
      </group>
    </group>
  );
};

// 单朵土豆花：白紫五瓣 + 中心黄色花药束。
const Flower = ({ petalGeometry, petalMaterial, antherMaterial, scale, open }) => (
  <group scale={open}>
    {Array.from({ length: 5 }, (_, index) => {
      const angle = (index / 5) * Math.PI * 2;

      return (
        <group key={index} rotation={[0, angle, 0]}>
          <mesh
            geometry={petalGeometry}
            material={petalMaterial}
            position={[0, 0, 0.052 * scale]}
            rotation={[-Math.PI / 2 + 0.42, 0, 0]}
            scale={0.105 * scale}
          />
        </group>
      );
    })}
    {/* 花药束：五枚聚成锥 */}
    <mesh material={antherMaterial} position={[0, 0.022 * scale, 0]}>
      <coneGeometry args={[0.019 * scale, 0.05 * scale, 6]} />
    </mesh>
  </group>
);

const SuperPotato = ({ growth = 0, quality = 0.5, seed = 1 }) => {
  const groupRef = useRef();
  const g = THREE.MathUtils.clamp(growth / 100, 0, 1);
  const scale = PLANT_SCALE;

  // 几何与材质只建一次，随 seed/quality 变化时才重建。
  const leafGeometry = useMemo(() => createLeafletGeometry(), []);
  const petalGeometry = useMemo(() => createPetalGeometry(), []);
  const tuberGeometries = useMemo(
    () => Array.from({ length: 6 }, (_, i) => createTuberGeometry(seed * 97 + i)),
    [seed]
  );

  React.useEffect(() => () => {
    leafGeometry.dispose();
    petalGeometry.dispose();
    tuberGeometries.forEach((geo) => geo.dispose());
  }, [leafGeometry, petalGeometry, tuberGeometries]);

  // 火星异化：叶片带花青素紫红边，养护差时更明显（胁迫反应）。
  const healthy = quality >= 0.55;
  const leafMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: healthy ? '#5f7a4a' : '#6d6a3e',
    roughness: 0.68,
    metalness: 0.04,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(healthy ? '#3a1f2a' : '#4a2418'),
    emissiveIntensity: 0.22,
  }), [healthy]);

  const stemMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: healthy ? '#6f5040' : '#7d4a36',
    roughness: 0.86,
  }), [healthy]);

  const petalMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ece0f4',
    roughness: 0.46,
    side: THREE.DoubleSide,
    emissive: new THREE.Color('#9d82c8'),
    emissiveIntensity: 0.2,
  }), []);

  const antherMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f5c24b',
    roughness: 0.42,
    emissive: new THREE.Color('#d99a1e'),
    emissiveIntensity: 0.4,
  }), []);

  // 块茎皮色随养护质量：干瘪土黄 → 饱满奶白。清漆高光。
  const tuberMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: quality >= 0.6 ? '#f3e3c6' : quality >= 0.3 ? '#e0c69c' : '#c5a377',
    roughness: 0.46,
    metalness: 0.2,
    emissive: new THREE.Color('#6b3a1c'),
    emissiveIntensity: 0.06,
  }), [quality]);

  React.useEffect(() => () => {
    leafMaterial.dispose();
    stemMaterial.dispose();
    petalMaterial.dispose();
    antherMaterial.dispose();
    tuberMaterial.dispose();
  }, [leafMaterial, stemMaterial, petalMaterial, antherMaterial, tuberMaterial]);

  useFrame((state) => {
    if (!groupRef.current) return;
    // 整株轻微摇曳；不逐叶片起 useFrame（14 片复叶 x 11 小叶太贵）。
    const sway = Math.sin(state.clock.elapsedTime * 0.6) * 0.018;
    groupRef.current.rotation.z = sway;
    groupRef.current.rotation.x = sway * 0.55;
  });

  if (g <= 0.001) return null;

  // 茎高持续增长到 85%，全期都有可见变化。
  const stemHeight = THREE.MathUtils.lerp(
    0.06,
    1,
    THREE.MathUtils.smoothstep(g, 0, 0.85)
  ) * scale;

  // 分蘖数：破土 1 根，展叶后 4 根（土豆是丛生的）。
  const tillerCount = g < POTATO_STAGES.SPROUT ? 1
    : g < POTATO_STAGES.FOLIAGE ? 2 : 4;

  // 每根分蘖上的复叶数，随生长增加。
  const leavesPerTiller = g < POTATO_STAGES.SPROUT ? 1
    : g < POTATO_STAGES.FOLIAGE ? 2 : g < POTATO_STAGES.FLOWER ? 3 : 4;

  const flowerOpen = THREE.MathUtils.clamp(
    Math.min(
      (g - POTATO_STAGES.FLOWER) / 0.08,
      (0.9 - g) / 0.1
    ),
    0,
    1
  );

  const tuberGrow = THREE.MathUtils.clamp(
    (g - POTATO_STAGES.TUBER) / (1 - POTATO_STAGES.TUBER),
    0,
    1
  );

  return (
    <group ref={groupRef}>
      {/* 分蘖丛：每根茎略微外倾，绕中心散开 */}
      {Array.from({ length: tillerCount }, (_, tiller) => {
        const angle = (tiller / Math.max(1, tillerCount)) * Math.PI * 2
          + seededUnit(seed, tiller) * 0.5;
        const lean = tillerCount > 1 ? 0.16 : 0;
        const tillerHeight = stemHeight * (0.82 + seededUnit(seed, tiller + 20) * 0.28);
        const offset = tillerCount > 1 ? 0.045 * scale : 0;

        return (
          <group
            key={tiller}
            position={[Math.cos(angle) * offset, 0, Math.sin(angle) * offset]}
            rotation={[Math.cos(angle) * lean, 0, -Math.sin(angle) * lean]}
          >
            {/* 主茎：土豆茎有棱，用少边数圆柱体现 */}
            <mesh
              position={[0, tillerHeight * 0.5, 0]}
              material={stemMaterial}
            >
              <cylinderGeometry
                args={[0.016 * scale, 0.028 * scale, tillerHeight, 6]}
              />
            </mesh>

            {/* 羽状复叶，绕茎按黄金角螺旋着生 */}
            {Array.from({ length: leavesPerTiller }, (_, index) => {
              const t = (index + 0.55) / leavesPerTiller;
              const leafAngle = index * 2.399 + tiller * 1.1;
              const y = tillerHeight * (0.24 + t * 0.72);
              const unfurl = THREE.MathUtils.clamp(g * 2.6 - t * 0.85, 0.06, 1);
              // 基部的叶最大，向上递减
              const leafScale = scale * (0.95 - t * 0.3);

              return (
                <group
                  key={index}
                  position={[0, y, 0]}
                  rotation={[0, leafAngle, 0.2]}
                >
                  <group position={[0.02 * scale, 0, 0]}>
                    <CompoundLeaf
                      leafGeometry={leafGeometry}
                      leafMaterial={leafMaterial}
                      stemMaterial={stemMaterial}
                      scale={leafScale}
                      unfurl={unfurl}
                    />
                  </group>
                </group>
              );
            })}

            {/* 顶端伞形花序：一根花梗上聚生数朵 */}
            {flowerOpen > 0.01 && tiller < 2 && (
              <group position={[0, tillerHeight * 1.0, 0]}>
                {[0, 1, 2, 3].map((index) => {
                  const fAngle = index * 1.6 + tiller;
                  const spread = 0.055 * scale * flowerOpen;

                  return (
                    <group
                      key={index}
                      position={[
                        Math.cos(fAngle) * spread,
                        0.02 * scale + index * 0.012 * scale,
                        Math.sin(fAngle) * spread,
                      ]}
                    >
                      <Flower
                        petalGeometry={petalGeometry}
                        petalMaterial={petalMaterial}
                        antherMaterial={antherMaterial}
                        scale={scale}
                        open={flowerOpen}
                      />
                    </group>
                  );
                })}
              </group>
            )}
          </group>
        );
      })}

      {/* 块茎：结薯期膨大。6 颗里前 3 颗半露出土面 ——
          这是「超级土豆」最该炫耀的部分，全埋起来等于白做。 */}
      {tuberGrow > 0.02 && tuberGeometries.map((geometry, index) => {
        const angle = index * 2.05 + 0.35;
        const dist = (0.14 + (index % 3) * 0.055) * scale;
        const exposed = index < 3;
        const size = (0.075 + tuberGrow * 0.075) * scale
          * (0.82 + quality * 0.36)
          * (exposed ? 1 : 0.86);

        return (
          <group
            key={index}
            position={[
              Math.cos(angle) * dist,
              // 露出的半埋（只沉 40%），埋着的沉到土下
              exposed ? -size * 0.4 : -size * 1.15,
              Math.sin(angle) * dist,
            ]}
            rotation={[
              seededUnit(seed, index * 7 + 3) * 1.1,
              seededUnit(seed, index * 7 + 4) * Math.PI * 2,
              seededUnit(seed, index * 7 + 5) * 0.7,
            ]}
            scale={[size * 1.14, size * 0.86, size]}
          >
            <mesh geometry={geometry} material={tuberMaterial} />
          </group>
        );
      })}
    </group>
  );
};

export default React.memo(SuperPotato);
