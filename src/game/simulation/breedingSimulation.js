import { deriveCraterEnvironment } from '../planting/plantingEngine';
import { getHumanBreedingModifier } from '../human/humanEngine';
import {
  createBaseGenome,
  deriveGenomeReadout,
  getExpressedTrait,
  isSterile,
  mutateGenome,
  resolveTraitSlots,
} from './genome';

export const VIEW_MODES = Object.freeze({
  PLANET: 'planet',
  CRATER: 'crater',
  HUMAN: 'human',
});

export const BREEDING_STAGES = Object.freeze({
  PLANTING: 'planting',
  GROWING: 'growing',
  ALLOCATION: 'allocation',
  FAILED: 'failed',
  COMPLETE: 'complete',
});

export const CRATER_ZONES = Object.freeze({
  RIM: 'rim',
  SHADOW: 'shadow',
  FLOOR: 'floor',
});

export const INTERVENTION_TYPES = Object.freeze({
  WATER: 'water',
  HEAT: 'heat',
  SHIELD: 'shield',
});

export const TUBER_USES = Object.freeze({
  SEED: 'seed',
  FEED: 'feed',
  DISSECT: 'dissect',
  PRESERVE: 'preserve',
});

export const GENERATION_LENGTH_SOLS = 30;
export const HARVEST_UNLOCK_SOL = 18;


const EVENT_SOLS = Object.freeze([1, 6, 12, 18, 24, 30]);

const ZONE_EFFECTS = Object.freeze({
  [CRATER_ZONES.RIM]: {
    label: '坑缘',
    stimulus: 20,
    stability: -12,
    yield: -2,
    hint: '暴露最强，变化更快',
  },
  [CRATER_ZONES.SHADOW]: {
    label: '坑壁阴影',
    stimulus: 8,
    stability: 4,
    yield: 0,
    hint: '昼夜切换，变化与繁殖平衡',
  },
  [CRATER_ZONES.FLOOR]: {
    label: '坑底',
    stimulus: -7,
    stability: 14,
    yield: 2,
    hint: '保护更强，块茎更稳定',
  },
});

// 三种干预各有不可替代的用途。旧配平下遮蔽在稳定与繁殖上严格优于水，
// 产量仅差 0.12 颗，水没有存在理由；现在水独占产量与繁殖，
// 遮蔽独占压力控制但压低表达，热独占表达推进但抬高突变负荷。
export const INTERVENTION_EFFECTS = Object.freeze({
  [INTERVENTION_TYPES.WATER]: {
    label: '提高产量',
    shortLabel: '水',
    hint: '块茎更多，繁殖力上升',
    vigor: 17,
    stress: -6,
    expression: -1,
    growth: 3,
    event: '水沿根区扩散，萎缩的叶片重新展开，块茎开始膨大。',
  },
  [INTERVENTION_TYPES.HEAT]: {
    label: '推进表达',
    shortLabel: '热',
    hint: '性状更强，突变负荷上升',
    vigor: 4,
    stress: 7,
    expression: 9,
    growth: 5,
    event: '热量沿坑底推进，休眠芽眼提前展开，组织变化被放大。',
  },
  [INTERVENTION_TYPES.SHIELD]: {
    label: '降低压力',
    shortLabel: '遮蔽',
    hint: '避免绝收，但性状变化变慢',
    vigor: 3,
    stress: -19,
    expression: -7,
    growth: -1,
    event: '遮蔽场压低环境刺激，植株恢复同步生长。',
  },
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const stableHash = (value) => {
  let hash = 2166136261;
  const text = String(value);

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const getCraterId = (crater) => crater?.id || crater?.CRATER_ID || 'UNKNOWN';

const getDominantEnvironment = (environment) => (
  Object.entries({
    radiation: environment.radiation,
    cold: environment.cold,
    minerals: environment.minerals,
    instability: environment.instability,
  }).sort((left, right) => right[1] - left[1])[0][0]
);

const TRAIT_BY_ENVIRONMENT = Object.freeze({
  radiation: 'repair',
  cold: 'dormancy',
  minerals: 'conductivity',
  instability: 'orientation',
});

const EVENT_LIBRARY = Object.freeze({
  radiation: [
    '芽眼开启时间开始分化。',
    '叶脉在射线峰值后出现重复分叉。',
    '受损根须在阴影中自行闭合。',
    '块茎开始保留受伤前的组织轮廓。',
    '切面修复反应已经可被稳定观察。',
    '修复性表达抵达本代峰值。',
  ],
  cold: [
    '幼芽只在日照出现时伸展。',
    '根系在低温中进入短暂休眠。',
    '植株形成可重复的昼夜停滞节律。',
    '块茎在复温后恢复全部代谢活动。',
    '休眠组织开始延缓自身衰老。',
    '低温记忆抵达本代峰值。',
  ],
  minerals: [
    '根须沿裸露矿脉展开。',
    '叶柄出现细小反光纹路。',
    '矿物结晶进入块茎皮层。',
    '组织开始储存微弱电荷。',
    '导电纹路连接成连续网络。',
    '神经放大型表达抵达本代峰值。',
  ],
  instability: [
    '根须沿松动土层向不同方向展开。',
    '土层位移切断了数条幼根。',
    '断裂根系重新连接并继续生长。',
    '植株开始记住旧的重力方向。',
    '块茎在翻转后仍保持定向萌发。',
    '方向记忆抵达本代峰值。',
  ],
});

// 绝收风险（策划 §4「缺水可能产生强适应，也可能导致绝收」）。
// 公式吸收自旧 plantingEngine 分支，接入主循环后该分支被移除。
export const getFailureRisk = (simulation) => {
  if (!simulation?.zone) return 0;

  const zoneEffect = ZONE_EFFECTS[simulation.zone];

  return Math.round(clamp(
    8
      + simulation.environment.instability * 0.22
      + simulation.environment.radiation * 0.08
      + zoneEffect.stimulus * 0.3
      + simulation.stress * 0.24
      - simulation.vigor * 0.16,
    2,
    72
  ));
};

export const getCraterZoneOptions = () => (
  Object.entries(ZONE_EFFECTS).map(([value, option]) => ({
    value,
    ...option,
  }))
);

export const DEFAULT_RESOURCES = Object.freeze({
  water: 3,
  heat: 2,
  shield: 2,
});

export const createBreedingSimulation = (
  crater,
  generation = 1,
  human = null,
  parentSeed = null,
  resources = DEFAULT_RESOURCES
) => ({
  stage: BREEDING_STAGES.PLANTING,
  generation,
  sol: 0,
  tick: 0,
  zone: null,
  environment: deriveCraterEnvironment(crater),
  parentSeed,
  humanModifier: human ? getHumanBreedingModifier(human) : {
    observation: 0,
    stability: 0,
    description: '',
  },
  // 资源跨代延续，由块茎分配补充，不再每代硬编码重置。
  resources: { ...resources },
  interventions: [],
  // vigor/stress/expression 内部全程保留浮点。旧实现每 tick 取整，
  // 实测把 101 个坑的环境差异全部量化成同一个增量。
  vigor: clamp(56 + (parentSeed?.reproduction ?? 68) * 0.16, 44, 82),
  stress: clamp(18 - (parentSeed?.stability ?? 74) * 0.1, 5, 22),
  expression: clamp(4 + (parentSeed?.expression ?? 0) * 0.14, 3, 22),
  growth: 0,
  growthAcceleration: 0,
  events: [],
  harvestResult: null,
  tuberAssignments: [],
});

export const plantInZone = (simulation, zone) => {
  if (
    simulation.stage !== BREEDING_STAGES.PLANTING
    || !ZONE_EFFECTS[zone]
  ) {
    return simulation;
  }

  return {
    ...simulation,
    stage: BREEDING_STAGES.GROWING,
    zone,
    events: [{
      sol: 0,
      kind: 'decision',
      text: `种薯进入${ZONE_EFFECTS[zone].label}。${ZONE_EFFECTS[zone].hint}。`,
    }],
  };
};

const createGrowthEvent = (simulation, sol) => {
  const dominantEnvironment = getDominantEnvironment(simulation.environment);
  const eventIndex = EVENT_SOLS.indexOf(sol);

  return {
    sol,
    kind: 'growth',
    text: EVENT_LIBRARY[dominantEnvironment][eventIndex],
  };
};

export const advanceBreedingSimulation = (simulation) => {
  if (
    simulation.stage !== BREEDING_STAGES.GROWING
    || simulation.sol >= GENERATION_LENGTH_SOLS
  ) {
    return simulation;
  }

  const nextSol = simulation.sol + 1;
  const zoneEffect = ZONE_EFFECTS[simulation.zone];
  const environmentalPressure = simulation.environment.pressure / 100;
  const stressDelta = environmentalPressure * 2.2 + zoneEffect.stimulus * 0.045;
  const vigorDelta = 1.7 - stressDelta * 0.55;
  const expressionDelta = (
    environmentalPressure * 1.35
    + zoneEffect.stimulus * 0.025
    + simulation.humanModifier.observation * 0.012
  );
  const shouldRecordEvent = EVENT_SOLS.includes(nextSol);

  return {
    ...simulation,
    tick: simulation.tick + 1,
    sol: nextSol,
    vigor: clamp(simulation.vigor + vigorDelta, 0, 100),
    stress: clamp(simulation.stress + stressDelta, 0, 100),
    expression: clamp(simulation.expression + expressionDelta, 0, 100),
    growth: clamp(
      (nextSol / GENERATION_LENGTH_SOLS) * 100
        + (simulation.growthAcceleration || 0),
      0,
      100
    ),
    events: shouldRecordEvent
      ? [...simulation.events, createGrowthEvent(simulation, nextSol)]
      : simulation.events,
  };
};

export const applyIntervention = (simulation, type) => {
  const effect = INTERVENTION_EFFECTS[type];

  if (
    simulation.stage !== BREEDING_STAGES.GROWING
    || !effect
    || simulation.resources[type] <= 0
  ) {
    return simulation;
  }

  return {
    ...simulation,
    resources: {
      ...simulation.resources,
      [type]: simulation.resources[type] - 1,
    },
    interventions: [
      ...simulation.interventions,
      { type, sol: simulation.sol },
    ],
    vigor: clamp(simulation.vigor + effect.vigor, 0, 100),
    stress: clamp(simulation.stress + effect.stress, 0, 100),
    expression: clamp(simulation.expression + effect.expression, 0, 100),
    growthAcceleration: clamp(
      (simulation.growthAcceleration || 0) + effect.growth,
      0,
      18
    ),
    growth: clamp(simulation.growth + effect.growth, 0, 100),
    events: [
      ...simulation.events,
      { sol: simulation.sol, kind: 'intervention', text: effect.event },
    ],
  };
};

const resolveHarvest = (simulation, crater) => {
  const zoneEffect = ZONE_EFFECTS[simulation.zone];
  const craterId = getCraterId(crater);
  const interventionSignature = simulation.interventions
    .map(({ type, sol }) => `${type}:${sol}`)
    .join(',');
  const seed = [
    craterId,
    simulation.generation,
    simulation.zone,
    simulation.sol,
    interventionSignature,
  ].join('|');
  const jitter = (stableHash(seed) % 3) - 1;
  const diameter = toNumber(crater?.diameter ?? crater?.DIAM_CIRC_IMG, 12);
  const parentSeed = simulation.parentSeed;
  // 基因组真累积到下一代，没有收缩系数，因此品系持续漂移而不是收敛。
  const genome = mutateGenome(
    parentSeed?.genome || createBaseGenome(),
    {
      environment: simulation.environment,
      zone: simulation.zone,
      harvestSol: simulation.sol,
      generationLength: GENERATION_LENGTH_SOLS,
      interventions: simulation.interventions,
      seed,
    }
  );
  const readout = deriveGenomeReadout(genome);
  const humanModifier = simulation.humanModifier;
  const stability = Math.round(clamp(
    readout.stability + humanModifier.stability,
    4,
    98
  ));
  const expression = Math.round(clamp(
    readout.expression
      + zoneEffect.stimulus * 0.35
      + (simulation.sol - HARVEST_UNLOCK_SOL) * 0.6,
    2,
    100
  ));
  const reproduction = readout.reproduction;
  const sterile = isSterile(genome);
  const baseYield = 5 + Math.round(Math.log10(Math.max(2, diameter)));
  const maturity = simulation.sol / GENERATION_LENGTH_SOLS;
  const tuberCount = sterile ? 0 : Math.round(clamp(
    baseYield
      + zoneEffect.yield
      + maturity * 3
      + simulation.vigor / 35
      - simulation.stress / 55
      + reproduction / 42
      + jitter,
    2,
    12
  ));
  const dominantEnvironment = getDominantEnvironment(simulation.environment);
  const dominantTrait = getExpressedTrait(genome);
  const inheritedTraits = parentSeed?.traits || [];
  // 满槽时交给玩家显式解决，而不是静默丢弃（旧实现的 .slice(-3)）。
  const { traits, conflict } = resolveTraitSlots(inheritedTraits, dominantTrait);

  return {
    generation: simulation.generation,
    sampleId: `G${simulation.generation}-${100 + (stableHash(`${seed}|sample`) % 900)}`,
    originCraterId: craterId,
    parentSampleId: parentSeed?.sampleId || null,
    lineageDepth: (parentSeed?.lineageDepth || 0) + 1,
    harvestSol: simulation.sol,
    zone: simulation.zone,
    genome,
    tuberCount,
    stability,
    expression,
    reproduction,
    sterile,
    dominantTrait,
    traits,
    traitConflict: conflict,
    phenomenon: EVENT_LIBRARY[dominantEnvironment][
      simulation.sol >= 24 ? 4 : 3
    ],
  };
};

export const harvestBreedingSimulation = (simulation, crater) => {
  if (
    simulation.stage !== BREEDING_STAGES.GROWING
    || simulation.sol < HARVEST_UNLOCK_SOL
  ) {
    return simulation;
  }

  const harvestResult = resolveHarvest(simulation, crater);
  // 绝收与不育在这里终止本代：没有块茎可分配，玩家必须依赖保存样本回退。
  const failed = harvestResult.tuberCount <= 0;

  return {
    ...simulation,
    stage: failed ? BREEDING_STAGES.FAILED : BREEDING_STAGES.ALLOCATION,
    harvestResult,
    tuberAssignments: Array.from(
      { length: harvestResult.tuberCount },
      () => null
    ),
    events: [
      ...simulation.events,
      {
        sol: simulation.sol,
        kind: failed ? 'failure' : 'harvest',
        text: failed
          ? (harvestResult.sterile
            ? '本代块茎全部不育，没有可留种的样本。'
            : '本代绝收，坑内没有可回收的块茎。')
          : `收获 ${harvestResult.tuberCount} 颗块茎。`,
      },
    ],
  };
};

export const assignTuberUse = (simulation, tuberIndex, use) => {
  if (
    simulation.stage !== BREEDING_STAGES.ALLOCATION
    || !Object.values(TUBER_USES).includes(use)
    || tuberIndex < 0
    || tuberIndex >= simulation.tuberAssignments.length
  ) {
    return simulation;
  }

  const tuberAssignments = [...simulation.tuberAssignments];
  tuberAssignments[tuberIndex] = use;

  return {
    ...simulation,
    tuberAssignments,
  };
};

export const getTuberAllocation = (simulation) => (
  Object.values(TUBER_USES).reduce((allocation, use) => ({
    ...allocation,
    [use]: simulation?.tuberAssignments?.filter((item) => item === use).length || 0,
  }), {})
);

export const canFeedHuman = (simulation) => {
  if (simulation?.stage !== BREEDING_STAGES.ALLOCATION) return false;

  const allocation = getTuberAllocation(simulation);
  const allAssigned = simulation.tuberAssignments.every(Boolean);

  return allAssigned && allocation.seed > 0 && allocation.feed > 0;
};

export const PRESERVED_SAMPLE_LIMIT = 2;

// 分配产生真实后果（策划 §7「块茎即资源」）。
// 旧实现把 tuberAssignments 存进存档后再无任何代码读取，
// 分配几颗留种完全不影响结果。
export const resolveAllocationOutcome = (simulation) => {
  const allocation = getTuberAllocation(simulation);
  const harvestResult = simulation.harvestResult;
  const genome = harvestResult.genome;

  // 留种数量决定下一代的起始活力与容错：多留种等于有后备。
  const seedVigorBonus = Math.min(allocation.seed - 1, 4) * 2.4;
  // 解剖揭示隐藏基因维度，代价是消耗样本。
  const revealedDimensions = allocation.dissect > 0
    ? Object.entries(genome)
      .filter(([key]) => key !== 'mutationLoad')
      .sort((left, right) => right[1] - left[1])
      .slice(0, Math.min(allocation.dissect * 2, 6))
      .map(([key]) => key)
    : [];

  return {
    parentSeed: {
      ...harvestResult,
      seedCount: allocation.seed,
      seedVigorBonus,
      revealedDimensions,
    },
    // 食用的块茎决定人体反馈强度。
    feedCount: allocation.feed,
    // 保存的块茎进入库存，失败时可回退。
    preservedCount: allocation.preserve,
    revealedDimensions,
    // 水与遮蔽由留种和保存补给，热由解剖补给。
    resourceGain: {
      water: Math.min(allocation.seed, 3),
      heat: Math.min(allocation.dissect, 2),
      shield: Math.min(allocation.preserve, 2),
    },
  };
};
