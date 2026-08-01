import { clamp, signedNoise, stableHash } from '../util/deterministic';

// 品系隐藏基因维度（策划 §5）。这些维度不直接作为主要玩家界面，
// 而是驱动派生出的稳定/繁殖/表达等可见读数。
//
// 关键约束：跨代必须是真累积。旧实现用 `58 + parent.stability * 0.22`
// 这类收缩迭代，数学上是不动点，实测 3 代后完全冻结。
export const GENOME_DIMENSIONS = Object.freeze([
  'dnaRepair',
  'dormancy',
  'metabolism',
  'antioxidant',
  'reproduction',
  'membraneStability',
  'mineralBinding',
  'neuralAffinity',
  'endocrineAffinity',
  'mutationStability',
]);

// 每个隐藏维度对应的显性性状。满槽时由玩家显式解决冲突。
export const TRAIT_BY_DIMENSION = Object.freeze({
  dnaRepair: 'repair',
  dormancy: 'dormancy',
  mineralBinding: 'conductivity',
  membraneStability: 'orientation',
  antioxidant: 'shielding',
  neuralAffinity: 'perception',
  endocrineAffinity: 'regulation',
  metabolism: 'vigor',
});

export const TRAIT_SLOT_COUNT = 3;

// 突变负荷达到此值后品系进入不育风险区。
export const STERILITY_THRESHOLD = 82;

// 确定性单位噪声，取值 -1..1。同一 seed 与 salt 永远给出同一结果，
// 使整条品系可复现，同时让每代的突变方向互不相同。

export const createBaseGenome = () => ({
  dnaRepair: 24,
  dormancy: 20,
  metabolism: 32,
  antioxidant: 22,
  reproduction: 66,
  membraneStability: 30,
  mineralBinding: 18,
  neuralAffinity: 14,
  endocrineAffinity: 12,
  mutationStability: 58,
  mutationLoad: 0,
});

// 环境向量到基因维度的选择压力。每个维度列出驱动它的环境项与权重，
// 使「同一个坑因品系历史/种植区/收获时间不同而给出不同结果」成立。
const SELECTION_PRESSURE = Object.freeze({
  dnaRepair: { radiation: 0.34, instability: 0.06 },
  dormancy: { cold: 0.32, water: -0.05 },
  metabolism: { minerals: 0.13, cold: -0.14 },
  antioxidant: { radiation: 0.19, geologicalComplexity: 0.07 },
  reproduction: { water: 0.16, instability: -0.2, radiation: -0.14 },
  membraneStability: { instability: 0.28, cold: 0.08 },
  mineralBinding: { minerals: 0.31, layerDiversity: 0.09 },
  neuralAffinity: { minerals: 0.17, geologicalComplexity: 0.12 },
  endocrineAffinity: { layerDiversity: 0.16, geologicalComplexity: 0.1 },
  mutationStability: { instability: -0.22, radiation: -0.16, water: 0.08 },
});

// 种植区决定选择压力的整体强度与稳定性代价。
const ZONE_PRESSURE = Object.freeze({
  rim: { gain: 1.5, stabilityCost: 7.5, load: 8.5 },
  shadow: { gain: 1, stabilityCost: 1.5, load: 3.5 },
  floor: { gain: 0.58, stabilityCost: -2.5, load: 1.2 },
});

// 干预直接改写选择压力的方向，而不是只改 HUD 数字。
const INTERVENTION_PRESSURE = Object.freeze({
  water: { reproduction: 2.4, metabolism: 1.1, mutationStability: 1.5, load: -1.6 },
  heat: { metabolism: 2.2, dormancy: -1.7, mutationStability: -2.4, load: 3.4 },
  shield: { membraneStability: 2.1, antioxidant: 1.6, mutationStability: 2.6, load: -2.2 },
});

const getInterventionPressure = (interventions) => (
  interventions.reduce((totals, { type }) => {
    const effect = INTERVENTION_PRESSURE[type];
    if (!effect) return totals;

    Object.entries(effect).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + value;
    });

    return totals;
  }, {})
);

// 核心生成关系（策划 §5）：
//   offspring = mutate(genome, environment, zone, harvestSol, interventions, seed)
// 增量直接叠加到上一代，没有任何收缩系数，因此品系会持续漂移而不是收敛。
export const mutateGenome = (genome, {
  environment,
  zone,
  harvestSol,
  generationLength,
  interventions = [],
  seed,
}) => {
  const zonePressure = ZONE_PRESSURE[zone] || ZONE_PRESSURE.shadow;
  const interventionPressure = getInterventionPressure(interventions);
  // 收获越晚，选择压力作用得越久，性状越明显。
  const exposure = clamp(harvestSol / generationLength, 0, 1.35);
  // 高 mutationStability 抑制随机漂移，但不抑制定向选择。
  const drift = clamp(1.35 - genome.mutationStability / 100, 0.28, 1.3);
  const next = { ...genome };

  GENOME_DIMENSIONS.forEach((dimension) => {
    const pressure = SELECTION_PRESSURE[dimension] || {};
    // 环境项归一化到 0..1 后加权求和，再放大到有意义的量级。
    // 除以 10 的旧标定只能移动约 3 点，常量基线会淹没环境差异。
    const directional = Object.entries(pressure).reduce(
      (total, [key, weight]) => total + ((environment[key] || 0) / 100) * weight,
      0
    ) * 42;
    const mutation = signedNoise(seed, dimension) * 2.6 * drift;
    const delta = directional * zonePressure.gain * exposure
      + mutation
      + (interventionPressure[dimension] || 0);

    next[dimension] = clamp(genome[dimension] + delta, 0, 100);
  });

  // 繁殖力与突变稳定性额外承担种植区与暴露时长的代价。
  next.reproduction = clamp(
    next.reproduction - zonePressure.stabilityCost * exposure,
    0,
    100
  );
  next.mutationStability = clamp(
    next.mutationStability - zonePressure.stabilityCost * 0.45 * exposure,
    0,
    100
  );
  next.mutationLoad = clamp(
    genome.mutationLoad
      + (zonePressure.load + (interventionPressure.load || 0)) * exposure
      - next.mutationStability * 0.045,
    0,
    100
  );

  return next;
};

// 玩家可见读数由基因组派生，基因组本身不再是玩家界面。
export const deriveGenomeReadout = (genome) => ({
  stability: Math.round(clamp(
    genome.mutationStability * 0.62
      + genome.membraneStability * 0.3
      - genome.mutationLoad * 0.34,
    4,
    98
  )),
  reproduction: Math.round(clamp(
    genome.reproduction - genome.mutationLoad * 0.42,
    0,
    98
  )),
  // 表达由最突出的两个维度主导，而不是六个维度取平均。
  // 取平均会把各维度对环境的不同反应互相抵消，使 101 个坑读数趋同。
  expression: Math.round(clamp(
    (() => {
      const expressive = [
        genome.dnaRepair,
        genome.dormancy,
        genome.mineralBinding,
        genome.neuralAffinity,
        genome.antioxidant,
        genome.endocrineAffinity,
      ].sort((left, right) => right - left);

      return expressive[0] * 0.82
        + expressive[1] * 0.34
        + genome.mutationLoad * 0.22;
    })(),
    2,
    100
  )),
});

// 显性性状取当前最突出的隐藏维度，因此性状会随品系漂移而改变。
export const getExpressedTrait = (genome) => {
  const baseline = createBaseGenome();
  const [dimension] = Object.entries(TRAIT_BY_DIMENSION)
    .map(([key]) => [key, genome[key] - baseline[key]])
    .sort((left, right) => right[1] - left[1])[0];

  return TRAIT_BY_DIMENSION[dimension];
};

// 不育判定用玩家实际看到的繁殖读数，而不是原始基因字段：
// 原始字段还剩 8.8 时读数已经归零，两者不一致会让「不育」永不触发。
export const isSterile = (genome) => (
  deriveGenomeReadout(genome).reproduction <= 0
  || genome.mutationLoad >= STERILITY_THRESHOLD
);

// 性状槽满时返回待解决的冲突，而不是静默截断（旧实现的 .slice(-3)）。
export const resolveTraitSlots = (traits, incomingTrait) => {
  if (traits.includes(incomingTrait)) {
    return { traits, conflict: null };
  }

  if (traits.length < TRAIT_SLOT_COUNT) {
    return { traits: [...traits, incomingTrait], conflict: null };
  }

  return {
    traits,
    conflict: { incomingTrait, candidates: traits },
  };
};

export const applyTraitChoice = (traits, incomingTrait, replacedTrait) => {
  if (!replacedTrait) return traits;

  return traits.map(
    (trait) => (trait === replacedTrait ? incomingTrait : trait)
  );
};
