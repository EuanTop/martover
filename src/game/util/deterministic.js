// 确定性随机与数值工具的唯一定义。
//
// stableHash（FNV-1a）此前在 genome.js、breedingSimulation.js、
// plantingEngine.js 与 CraterCultivationScene.js 中各有一份逐字节相同的
// 副本。它决定全部模拟种子，四份副本一旦有人改动其中一份，同一个坑会
// 在不同模块里散出不同的值，而且不会有任何报错。clamp 同样有四份。

export const stableHash = (value) => {
  let hash = 2166136261;
  const text = String(value);

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// 由种子与下标取 0..1 的稳定值。
export const seededUnit = (seed, index) => (
  stableHash(`${seed}:${index}`) / 4294967295
);

// 由种子与命名维度取 -1..1 的稳定值。
// 分隔符固定用 "|"，与 genome.js 原有实现一致 —— 换成 ":" 会改变
// 每一个基因组数值，且不会有任何编译期提示。
export const signedNoise = (seed, key) => (
  (stableHash(`${seed}|${key}`) / 4294967295) * 2 - 1
);
