// 地形尺度常量的唯一定义。
//
// 这些数字同时被三层消费：3D 场景（craterVisualModel / CraterCultivationScene）、
// 经济层的地块网格（economy/baseLayout）、以及两边的测试。
// craterVisualModel.js 首行 import three，若经济层从那里取分带常量，
// 整个领域层和 vitest 套件都会被拖进 three —— 所以常量单独放在这里，
// 本文件不得 import 任何东西。craterVisualModel.js 再 re-export 一遍，
// 既有的导入路径全部保持有效。

// 地形网格外沿，局部单位（坑体外沿）。
export const TERRAIN_RADIUS = 0.92;

// 周边平原外沿（归一化半径，坑体=1.0）。火星全球贴图在近景下
// 每块地表只摊到约 30px，坑外必然是一团模糊 —— 相机能看到的
// 近处地面必须全部由自建高细节网格覆盖，球面贴图只留作远景。
export const PLAIN_OUTER = 1.8;

// 坑底深度，局部单位。与 CraterCultivationScene 的地形一致。
export const FLOOR_DEPTH = 0.14;

// 地形分带边界（归一化半径 0..1）。种植区、干预标记与碎石
// 全部引用同一组边界，因此「坑底」的植株真的落在坑底。
export const TERRAIN_BANDS = Object.freeze({
  floor: 0.34,
  slope: 0.72,
  rim: 0.86,
});

// 三个种植区各自的归一化半径区间，与上面的地形分带严格对齐。
// baseLayout 的每一环都必须落在这三个区间之内。
export const ZONE_BANDS = Object.freeze({
  floor: { inner: 0.06, outer: 0.3 },
  shadow: { inner: 0.4, outer: 0.68 },
  rim: { inner: 0.74, outer: 0.84 },
});
