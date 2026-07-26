import { clamp, stableHash } from '../util/deterministic';

export const PLANTING_STATUS = Object.freeze({
  CONFIGURATION: 'configuration',
  GROWTH: 'growth',
  ALLOCATION: 'allocation',
});

export const PLANTING_LAYERS = Object.freeze({
  SURFACE: 'surface',
  MIDDLE: 'middle',
  DEEP: 'deep',
});

export const WATER_LEVELS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

export const INTERVENTIONS = Object.freeze({
  STABILIZE: 'stabilize',
  PRESERVE_EXPRESSION: 'preserve-expression',
});

export const ALLOCATION_KEYS = Object.freeze([
  'seed',
  'feed',
  'dissect',
  'preserve',
]);

const CONFIG_OPTIONS = Object.freeze({
  layer: Object.freeze(Object.values(PLANTING_LAYERS)),
  water: Object.freeze(Object.values(WATER_LEVELS)),
});

const HARVEST_SOLS = Object.freeze([3, 4]);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const deterministicUnit = (seed) => stableHash(seed) / 4294967295;

const getMorphology = (crater) => (
  Array.isArray(crater?.internalMorph)
    ? crater.internalMorph.join(' ')
    : String(crater?.internalMorph || crater?.INT_MORPH1 || '')
);

const getCraterId = (crater) => crater?.id || crater?.CRATER_ID || 'UNKNOWN';

export const deriveCraterEnvironment = (crater) => {
  const latitude = Math.abs(toNumber(crater?.latitude ?? crater?.LAT_CIRC_IMG));
  const diameter = toNumber(crater?.diameter ?? crater?.DIAM_CIRC_IMG, 10);
  const layerNumber = toNumber(crater?.layerNumber ?? crater?.NUMBER_LAYERS, 1);
  const rim = toNumber(crater?.rimDegradation ?? crater?.DEG_RIM, 2);
  const ejecta = toNumber(crater?.ejectaDegradation ?? crater?.DEG_EJC, 2);
  const floor = toNumber(crater?.floorDegradation ?? crater?.DEG_FLR, 2);
  const morphology = getMorphology(crater).toLowerCase();
  const hasRadiation = crater?.hasRd === true || crater?.hasRd === 1;
  const degradation = clamp(((rim + ejecta + floor) / 12) * 100, 0, 100);

  const environment = {
    cold: clamp(18 + (latitude / 90) * 82, 0, 100),
    radiation: hasRadiation ? 88 : clamp(12 + degradation * 0.22, 0, 100),
    water: clamp(28 + (latitude / 90) * 44 + layerNumber * 4, 0, 100),
    minerals: morphology.match(/cpk|cpt|central|peak/) ? 82 : clamp(30 + diameter * 0.35, 0, 76),
    geologicalComplexity: clamp(24 + layerNumber * 15 + (morphology ? 16 : 0), 0, 100),
    instability: clamp(18 + degradation * 0.62 + Math.max(0, layerNumber - 2) * 5, 0, 100),
    layerDiversity: clamp(24 + layerNumber * 22, 0, 100),
  };

  environment.pressure = Math.round(
    (
      environment.cold
      + environment.radiation
      + environment.instability
      + environment.geologicalComplexity
    ) / 4
  );

  return environment;
};

export const getPlantingLayerOptions = (crater) => {
  const layerNumber = Math.max(1, toNumber(crater?.layerNumber ?? crater?.NUMBER_LAYERS, 1));

  return [
    {
      value: PLANTING_LAYERS.SURFACE,
      label: '表层',
      hint: '刺激强 · 产量低',
      detail: '直接暴露于坑面环境，变化最明显。',
    },
    {
      value: PLANTING_LAYERS.MIDDLE,
      label: layerNumber > 1 ? `中层 / ${layerNumber} 层地形` : '坑壁阴影层',
      hint: '刺激与产量平衡',
      detail: '利用坑壁遮蔽，让变化与繁殖保持平衡。',
    },
    {
      value: PLANTING_LAYERS.DEEP,
      label: '坑底深层',
      hint: '刺激弱 · 产量高',
      detail: '环境更稳定，容易收获更多可繁殖块茎。',
    },
  ];
};

export const WATER_OPTIONS = Object.freeze([
  {
    value: WATER_LEVELS.LOW,
    label: '少量',
    hint: '变化更强 · 产量更低',
  },
  {
    value: WATER_LEVELS.MEDIUM,
    label: '适量',
    hint: '平衡',
  },
  {
    value: WATER_LEVELS.HIGH,
    label: '充足',
    hint: '产量更高 · 变化更弱',
  },
]);

const dominantEnvironment = (environment) => (
  Object.entries({
    radiation: environment.radiation,
    cold: environment.cold,
    minerals: environment.minerals,
    instability: environment.instability,
  }).sort((left, right) => right[1] - left[1])[0][0]
);

const getEventText = (environment, sol, intervention) => {
  const dominant = dominantEnvironment(environment);
  const events = {
    radiation: {
      1: '种薯全部发芽，但芽眼的开启时间并不同步。',
      2: '坑面射线增强，一株幼苗的叶脉开始出现重复分叉。',
      3: '切断的细根在休眠后重新闭合，安全收获窗口已经出现。',
      4: '块茎继续膨大，两个芽眼停止响应，组织变化却更加清晰。',
    },
    cold: {
      1: '种薯在日照出现时发芽，阴影到来后立即停止生长。',
      2: '低温使茎叶收缩，根系仍在缓慢向坑底延伸。',
      3: '植株形成稳定的昼夜休眠节律，安全收获窗口已经出现。',
      4: '额外等待让休眠更深，部分芽眼需要更强光照才能再次苏醒。',
    },
    minerals: {
      1: '根须沿裸露矿脉发芽，幼芽表面出现细小反光。',
      2: '矿物结晶进入根系，一株幼苗的导管开始硬化。',
      3: '块茎皮层形成连续矿物纹路，安全收获窗口已经出现。',
      4: '纹路继续增厚，块茎对电流产生微弱而稳定的响应。',
    },
    instability: {
      1: '种薯发芽，根须沿松动土层向三个方向展开。',
      2: '土层滑动，数条幼根断裂，植株短暂失去水分。',
      3: '一株的断裂根系重新连接，安全收获窗口已经出现。',
      4: '额外等待带来更多块茎，但部分新芽已经失去对重力的方向感。',
    },
  };

  if (sol === 2 && intervention === INTERVENTIONS.STABILIZE) {
    return `${events[dominant][sol]} 你固定了根区，植株恢复同步生长。`;
  }

  if (sol === 2 && intervention === INTERVENTIONS.PRESERVE_EXPRESSION) {
    return `${events[dominant][sol]} 你没有消除压力，让异常组织继续表达。`;
  }

  return events[dominant][sol];
};

const createEvent = (environment, sol, intervention = null) => ({
  sol,
  text: getEventText(environment, sol, intervention),
  kind: intervention ? 'intervention' : 'growth',
});

export const createPlantingCycle = (crater, generation = 1) => ({
  status: PLANTING_STATUS.CONFIGURATION,
  generation,
  sol: 0,
  config: {
    layer: PLANTING_LAYERS.MIDDLE,
    water: WATER_LEVELS.MEDIUM,
  },
  intervention: null,
  growthEvents: [],
  safeHarvestPreview: null,
  harvestResult: null,
  allocation: {
    seed: 0,
    feed: 0,
    dissect: 0,
    preserve: 0,
  },
  environment: deriveCraterEnvironment(crater),
});

export const configurePlanting = (cycle, key, value) => {
  if (
    cycle.status !== PLANTING_STATUS.CONFIGURATION
    || !CONFIG_OPTIONS[key]?.includes(value)
  ) {
    return cycle;
  }

  return {
    ...cycle,
    config: {
      ...cycle.config,
      [key]: value,
    },
  };
};

export const startPlanting = (cycle) => {
  if (cycle.status !== PLANTING_STATUS.CONFIGURATION) return cycle;

  return {
    ...cycle,
    status: PLANTING_STATUS.GROWTH,
    sol: 1,
    growthEvents: [createEvent(cycle.environment, 1)],
  };
};

const getResolutionModifiers = (cycle, harvestSol) => {
  const layer = {
    [PLANTING_LAYERS.SURFACE]: {
      yield: -1,
      stability: -9,
      reproduction: -8,
      expression: 18,
      risk: 12,
    },
    [PLANTING_LAYERS.MIDDLE]: {
      yield: 0,
      stability: 0,
      reproduction: 0,
      expression: 8,
      risk: 4,
    },
    [PLANTING_LAYERS.DEEP]: {
      yield: 2,
      stability: 7,
      reproduction: 8,
      expression: -6,
      risk: -5,
    },
  }[cycle.config.layer];

  const water = {
    [WATER_LEVELS.LOW]: {
      yield: -1,
      stability: -3,
      reproduction: -4,
      expression: 13,
      risk: 8,
    },
    [WATER_LEVELS.MEDIUM]: {
      yield: 0,
      stability: 2,
      reproduction: 2,
      expression: 2,
      risk: 0,
    },
    [WATER_LEVELS.HIGH]: {
      yield: 2,
      stability: 5,
      reproduction: 8,
      expression: -10,
      risk: -6,
    },
  }[cycle.config.water];

  const intervention = cycle.intervention === INTERVENTIONS.STABILIZE
    ? {
      yield: 0,
      stability: 9,
      reproduction: 7,
      expression: -5,
      risk: -7,
    }
    : {
      yield: 0,
      stability: -4,
      reproduction: -5,
      expression: 11,
      risk: 6,
    };

  const waiting = harvestSol === 4
    ? {
      yield: 2,
      stability: -9,
      reproduction: -9,
      expression: 16,
      risk: 11,
    }
    : {
      yield: 0,
      stability: 4,
      reproduction: 5,
      expression: 0,
      risk: -4,
    };

  return {
    yield: layer.yield + water.yield + intervention.yield + waiting.yield,
    stability: layer.stability + water.stability + intervention.stability + waiting.stability,
    reproduction: layer.reproduction + water.reproduction + intervention.reproduction + waiting.reproduction,
    expression: layer.expression + water.expression + intervention.expression + waiting.expression,
    risk: layer.risk + water.risk + intervention.risk + waiting.risk,
  };
};

const getPhenomenon = (environment, harvestSol) => {
  const dominant = dominantEnvironment(environment);
  const phenomena = {
    radiation: harvestSol === 4
      ? '块茎切面在休眠时自行闭合，随后长出透明根须。'
      : '块茎切面在休眠时自行闭合。',
    cold: harvestSol === 4
      ? '组织在阴影中完全停滞，并在重新见光后修复损伤。'
      : '组织在阴影中休眠，见光后恢复生长。',
    minerals: harvestSol === 4
      ? '皮层形成导电矿物脉，能够放大微弱神经电信号。'
      : '皮层形成连续矿物脉并储存微弱电荷。',
    instability: harvestSol === 4
      ? '断裂根系自行重连，并保留对旧生长方向的记忆。'
      : '断裂根系在休眠后自行重新连接。',
  };

  return phenomena[dominant];
};

const getCost = (reproduction, stability, harvestSol) => {
  if (reproduction < 25) return '多数芽眼失去萌发能力，本代血统接近中断。';
  if (reproduction < 50) return '部分芽眼不再响应，下一代可用种薯明显减少。';
  if (stability < 50) return '同一块茎的组织表现并不一致，变化尚未稳定。';
  if (harvestSol === 4) return '额外生长消耗了芽眼活性，下一代繁殖速度下降。';
  return '变化仍依赖当前陨石坑，离开产地后可能减弱。';
};

const resolveHarvest = (cycle, crater, harvestSol) => {
  const craterId = getCraterId(crater);
  const seed = [
    craterId,
    cycle.generation,
    cycle.config.layer,
    cycle.config.water,
    cycle.intervention,
    harvestSol,
  ].join('|');
  const random = deterministicUnit(seed);
  const modifiers = getResolutionModifiers(cycle, harvestSol);
  const environment = cycle.environment;
  const diameter = toNumber(crater?.diameter ?? crater?.DIAM_CIRC_IMG, 12);
  const baseYield = clamp(5 + Math.round(Math.log10(Math.max(2, diameter))), 5, 8);
  const jitter = random < 0.28 ? -1 : random > 0.78 ? 1 : 0;
  const tuberCount = clamp(baseYield + modifiers.yield + jitter, 2, 12);
  const expression = Math.round(clamp(
    22 + environment.pressure * 0.38 + modifiers.expression,
    8,
    100
  ));
  const stability = Math.round(clamp(
    88 - environment.instability * 0.28 - environment.radiation * 0.12 + modifiers.stability,
    12,
    96
  ));
  const reproduction = Math.round(clamp(
    88 - environment.radiation * 0.18 - expression * 0.12 + modifiers.reproduction,
    0,
    96
  ));
  const failureRisk = Math.round(clamp(
    8 + environment.instability * 0.22 + environment.radiation * 0.08 + modifiers.risk,
    2,
    72
  ));
  const sampleNumber = 100 + (stableHash(`${seed}|sample`) % 900);

  return {
    sampleId: `G${cycle.generation}-${sampleNumber}`,
    harvestSol,
    tuberCount,
    viableTubers: Math.max(1, Math.round(tuberCount * reproduction / 100)),
    stability,
    reproduction,
    expression,
    failureRisk,
    phenomenon: getPhenomenon(environment, harvestSol),
    cost: getCost(reproduction, stability, harvestSol),
    originCraterId: craterId,
    config: cycle.config,
    intervention: cycle.intervention,
  };
};

const createDefaultAllocation = (tuberCount) => {
  const seed = Math.min(2, tuberCount);
  const remainingAfterSeed = tuberCount - seed;
  const feed = remainingAfterSeed > 0 ? 1 : 0;
  const remainingAfterFeed = remainingAfterSeed - feed;
  const dissect = remainingAfterFeed > 0 ? 1 : 0;

  return {
    seed,
    feed,
    dissect,
    preserve: remainingAfterFeed - dissect,
  };
};

export const advancePlanting = (cycle, crater) => {
  if (cycle.status !== PLANTING_STATUS.GROWTH) return cycle;
  if (cycle.sol === 2 && !cycle.intervention) return cycle;
  if (cycle.sol >= 3) return cycle;

  const nextSol = cycle.sol + 1;
  const nextCycle = {
    ...cycle,
    sol: nextSol,
    growthEvents: [
      ...cycle.growthEvents,
      createEvent(cycle.environment, nextSol),
    ],
  };

  if (nextSol === 3) {
    return {
      ...nextCycle,
      safeHarvestPreview: resolveHarvest(nextCycle, crater, 3),
    };
  }

  return nextCycle;
};

export const chooseIntervention = (cycle, intervention) => {
  if (
    cycle.status !== PLANTING_STATUS.GROWTH
    || cycle.sol !== 2
    || !Object.values(INTERVENTIONS).includes(intervention)
  ) {
    return cycle;
  }

  return {
    ...cycle,
    intervention,
    growthEvents: [
      ...cycle.growthEvents.filter((event) => event.kind !== 'intervention'),
      createEvent(cycle.environment, 2, intervention),
    ],
  };
};

export const harvestPlanting = (cycle, crater, harvestSol) => {
  if (
    cycle.status !== PLANTING_STATUS.GROWTH
    || cycle.sol !== 3
    || !HARVEST_SOLS.includes(harvestSol)
  ) {
    return cycle;
  }

  const result = resolveHarvest(cycle, crater, harvestSol);
  const growthEvents = harvestSol === 4
    ? [...cycle.growthEvents, createEvent(cycle.environment, 4)]
    : cycle.growthEvents;

  return {
    ...cycle,
    status: PLANTING_STATUS.ALLOCATION,
    sol: harvestSol,
    growthEvents,
    harvestResult: result,
    allocation: createDefaultAllocation(result.tuberCount),
  };
};

export const updateAllocation = (cycle, key, delta) => {
  if (
    cycle.status !== PLANTING_STATUS.ALLOCATION
    || !ALLOCATION_KEYS.includes(key)
  ) {
    return cycle;
  }

  const allocated = ALLOCATION_KEYS.reduce(
    (total, allocationKey) => total + cycle.allocation[allocationKey],
    0
  );
  const nextValue = cycle.allocation[key] + delta;
  const nextAllocated = allocated + delta;

  if (!Number.isInteger(delta) || delta === 0) return cycle;
  if (nextValue < 0) return cycle;
  if (nextAllocated > cycle.harvestResult.tuberCount) return cycle;

  return {
    ...cycle,
    allocation: {
      ...cycle.allocation,
      [key]: nextValue,
    },
  };
};

export const getAllocatedTuberCount = (cycle) => (
  ALLOCATION_KEYS.reduce(
    (total, key) => total + (cycle?.allocation?.[key] || 0),
    0
  )
);

export const canCompletePlantingCycle = (cycle) => (
  cycle?.status === PLANTING_STATUS.ALLOCATION
  && getAllocatedTuberCount(cycle) === cycle.harvestResult.tuberCount
  && cycle.allocation.seed > 0
);
