import * as THREE from 'three';
import {
  FLOOR_DEPTH,
  PLAIN_OUTER,
  TERRAIN_BANDS,
  TERRAIN_RADIUS,
  ZONE_BANDS,
} from './terrainBands';

// 尺度常量的定义已移到 terrainBands.js（不 import three）：
// 经济层的地块网格需要分带常量，但不能因此被拖进 three。
// 这里 re-export 保持既有导入路径全部有效。
export {
  FLOOR_DEPTH,
  PLAIN_OUTER,
  TERRAIN_BANDS,
  TERRAIN_RADIUS,
  ZONE_BANDS,
};

const MIN_CRATER_DIAMETER_KM = 1.8;
const MAX_CRATER_DIAMETER_KM = 45;
const MARS_WORLD_SCALE = 2;

// 真实直径 1.8-45 km 的比值是 25 倍。旧标定 lerp(0.032, 0.056)
// 只有 1.75 倍，所有坑看起来一样大；同时最小的坑覆盖约 200 km 弧长。
// 现在整体缩小并拉开区间，恢复相对尺度感。
export const getCraterDisplayScale = (crater) => {
  const raw = Number(crater?.diameter);
  // 只有真正缺值（undefined/NaN）才回落到默认 6 km。
  // 用 `|| 6` 会把 diameter: 0 这种坏数据也当成平均大小的坑，
  // 而它应当夹到最小值。
  const diameter = THREE.MathUtils.clamp(
    Number.isFinite(raw) ? raw : 6,
    MIN_CRATER_DIAMETER_KM,
    MAX_CRATER_DIAMETER_KM
  );
  const normalized = (
    Math.log(diameter) - Math.log(MIN_CRATER_DIAMETER_KM)
  ) / (
    Math.log(MAX_CRATER_DIAMETER_KM) - Math.log(MIN_CRATER_DIAMETER_KM)
  );

  return THREE.MathUtils.lerp(0.011, 0.044, normalized);
};

export const getCraterWorldRadius = (crater) => (
  getCraterDisplayScale(crater) * MARS_WORLD_SCALE * TERRAIN_RADIUS
);

// 坑体挂载半径。火星球体是闭合不透明的，任何低于球面 1.0 的几何
// 都会被球面遮挡，所以坑体必须整体在球面之上：挂载点抬高
// FLOOR_DEPTH*scale，让最低处的坑底恰好落在球面 1.0 上，
// 「凹下去」的部分由球面上的开洞（getCraterHoleAngle）露出来。
export const getCraterMountRadius = (crater) => (
  1 + FLOOR_DEPTH * getCraterDisplayScale(crater)
);

// 球面开洞的角半径（弧度）。洞必须盖住整个延伸网格的不透明区
// （坑体 + 周边平原），取平原外沿角半径的 0.85 倍：淡出裙边
// （0.85-1.0）压在球面之上，洞缘永远被地形盖住，不露缝。
export const getCraterHoleAngle = (crater) => (
  Math.asin(Math.min(
    1,
    getCraterDisplayScale(crater) * TERRAIN_RADIUS * PLAIN_OUTER
  )) * 0.85
);
