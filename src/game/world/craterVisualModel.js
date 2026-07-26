import * as THREE from 'three';

const MIN_CRATER_DIAMETER_KM = 1.8;
const MAX_CRATER_DIAMETER_KM = 45;
const MARS_WORLD_SCALE = 2;

// 地形网格外沿，局部单位。这里是唯一定义，
// CraterCultivationScene 从此处导入，避免两份常量互相漂移。
export const TERRAIN_RADIUS = 0.92;

// 地形分带边界（归一化半径 0..1）。种植区、干预标记与碎石
// 全部引用同一组边界，因此「坑底」的植株真的落在坑底。
export const TERRAIN_BANDS = Object.freeze({
  floor: 0.34,
  slope: 0.72,
  rim: 0.86,
});

// 三个种植区各自的归一化半径区间，与上面的地形分带严格对齐。
export const ZONE_BANDS = Object.freeze({
  floor: { inner: 0.06, outer: 0.3 },
  shadow: { inner: 0.4, outer: 0.68 },
  rim: { inner: 0.74, outer: 0.84 },
});

// 真实直径 1.8-45 km 的比值是 25 倍。旧标定 lerp(0.032, 0.056)
// 只有 1.75 倍，所有坑看起来一样大；同时最小的坑覆盖约 200 km 弧长。
// 现在整体缩小并拉开区间，恢复相对尺度感。
export const getCraterDisplayScale = (crater) => {
  const diameter = THREE.MathUtils.clamp(
    Number(crater?.diameter) || 6,
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

// 坑底深度，局部单位。与 CraterCultivationScene 的地形一致。
export const FLOOR_DEPTH = 0.14;

// 坑体挂载半径。下沉后坑底真正低于球面 1.0；
// 场景与相机装置共用此函数，避免两处各自硬编码 1.006。
export const getCraterMountRadius = (crater) => (
  1 - FLOOR_DEPTH * getCraterDisplayScale(crater) * 0.82
);
