import { deriveCraterEnvironment } from '../planting/plantingEngine';
import { getHumanBreedingModifier } from '../human/humanEngine';

export const VIEW_MODES = Object.freeze({
  PLANET: 'planet',
  CRATER: 'crater',
  HUMAN: 'human',
});

export const BREEDING_STAGES = Object.freeze({
  PLANTING: 'planting',
  GROWING: 'growing',
  ALLOCATION: 'allocation',
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

export const INTERVENTION_EFFECTS = Object.freeze({
  [INTERVENTION_TYPES.WATER]: {
    label: '恢复活力',
    shortLabel: '水',
    hint: '叶片抬起，压力下降',
    vigor: 15,
    stress: -9,
    expression: -2,
    growth: 0,
    event: '水沿根区扩散，萎缩的叶片重新展开。',
  },
  [INTERVENTION_TYPES.HEAT]: {
    label: '推进表达',
    shortLabel: '热',
    hint: '芽眼加速，压力上升',
    vigor: 4,
    stress: 6,
    expression: 8,
    growth: 5,
    event: '热量沿坑底推进，休眠芽眼提前展开，组织变化被放大。',
  },
  [INTERVENTION_TYPES.SHIELD]: {
    label: '降低压力',
    shortLabel: '遮蔽',
    hint: '变化变慢，植株更稳定',
    vigor: 5,
    stress: -18,
    expression: -6,
    growth: 0,
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

export const getCraterZoneOptions = () => (
  Object.entries(ZONE_EFFECTS).map(([value, option]) => ({
    value,
    ...option,
  }))
);

export const createBreedingSimulation = (
  crater,
  generation = 1,
  human = null,
  parentSeed = null
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
  resources: {
    water: 3,
    heat: 2,
    shield: 2,
  },
  interventions: [],
  vigor: Math.round(clamp(
    58 + (parentSeed?.reproduction ?? 68) * 0.15,
    48,
    78
  )),
  stress: Math.round(clamp(
    18 - (parentSeed?.stability ?? 74) * 0.1,
    6,
    18
  )),
  expression: Math.round(clamp(
    5 + (parentSeed?.expression ?? 0) * 0.12,
    5,
    18
  )),
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
    vigor: Math.round(clamp(simulation.vigor + vigorDelta, 0, 100)),
    stress: Math.round(clamp(simulation.stress + stressDelta, 0, 100)),
    expression: Math.round(clamp(
      simulation.expression + expressionDelta,
      0,
      100
    )),
    growth: Math.round(clamp(
      (nextSol / GENERATION_LENGTH_SOLS) * 100
        + (simulation.growthAcceleration || 0),
      0,
      100
    )),
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
    vigor: Math.round(clamp(simulation.vigor + effect.vigor, 0, 100)),
    stress: Math.round(clamp(simulation.stress + effect.stress, 0, 100)),
    expression: Math.round(clamp(
      simulation.expression + effect.expression,
      0,
      100
    )),
    growthAcceleration: Math.round(clamp(
      (simulation.growthAcceleration || 0) + effect.growth,
      0,
      18
    )),
    growth: Math.round(clamp(
      simulation.growth + effect.growth,
      0,
      100
    )),
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
  const inheritedStability = parentSeed
    ? 58 + parentSeed.stability * 0.22
    : 74;
  const inheritedReproduction = parentSeed
    ? 68 + parentSeed.reproduction * 0.18
    : 90;
  const baseYield = 5 + Math.round(Math.log10(Math.max(2, diameter)));
  const maturity = simulation.sol / GENERATION_LENGTH_SOLS;
  const tuberCount = Math.round(clamp(
    baseYield
      + zoneEffect.yield
      + maturity * 3
      + simulation.vigor / 35
      - simulation.stress / 55
      + jitter,
    3,
    12
  ));
  const stability = Math.round(clamp(
    inheritedStability
      + zoneEffect.stability
      + simulation.humanModifier.stability
      - simulation.expression * 0.28
      - simulation.stress * 0.18,
    12,
    96
  ));
  const expression = Math.round(clamp(
    simulation.expression
      + zoneEffect.stimulus
      + (simulation.sol - HARVEST_UNLOCK_SOL) * 1.1,
    8,
    100
  ));
  const reproduction = Math.round(clamp(
    inheritedReproduction
      - expression * 0.32
      - simulation.stress * 0.2
      + stability * 0.18,
    8,
    96
  ));
  const dominantEnvironment = getDominantEnvironment(simulation.environment);
  const dominantTrait = TRAIT_BY_ENVIRONMENT[dominantEnvironment];
  const inheritedTraits = parentSeed?.traits
    || (parentSeed?.dominantTrait ? [parentSeed.dominantTrait] : []);
  const traits = [...new Set([...inheritedTraits, dominantTrait])].slice(-3);

  return {
    generation: simulation.generation,
    sampleId: `G${simulation.generation}-${100 + (stableHash(`${seed}|sample`) % 900)}`,
    originCraterId: craterId,
    parentSampleId: parentSeed?.sampleId || null,
    lineageDepth: (parentSeed?.lineageDepth || 0) + 1,
    harvestSol: simulation.sol,
    zone: simulation.zone,
    tuberCount,
    stability,
    expression,
    reproduction,
    dominantTrait,
    traits,
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

  return {
    ...simulation,
    stage: BREEDING_STAGES.ALLOCATION,
    harvestResult,
    tuberAssignments: Array.from(
      { length: harvestResult.tuberCount },
      () => null
    ),
    events: [
      ...simulation.events,
      {
        sol: simulation.sol,
        kind: 'harvest',
        text: `收获 ${harvestResult.tuberCount} 颗块茎。`,
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
