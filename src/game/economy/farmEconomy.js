// 经营垂直切片的领域层（策划 §19.5，2.0 实现基准）。
// 纯函数、确定性：同一个坑、同一串操作，永远得到同一局。
// 育种、遗传与人体反馈是待接回子系统，本层不依赖它们。

import { deriveCraterEnvironment } from '../planting/plantingEngine';
import { clamp, seededUnit, stableHash } from '../util/deterministic';

export const FARM_ZONES = Object.freeze({
  FLOOR: 'floor',
  SHADOW: 'shadow',
  RIM: 'rim',
});

export const PLOT_STATUS = Object.freeze({
  LOCKED: 'locked',
  EMPTY: 'empty',
  GROWING: 'growing',
  READY: 'ready',
});

export const FACILITY_TYPES = Object.freeze({
  HARVESTER: 'harvester',
  HEATER: 'heater',
  SHIELD: 'shield',
});

export const TOOL_MODES = Object.freeze({
  PLANT: 'plant',
  HARVEST: 'harvest',
  BUILD_HARVESTER: 'build-harvester',
  BUILD_HEATER: 'build-heater',
  BUILD_SHIELD: 'build-shield',
});

export const FARM_OUTCOMES = Object.freeze({
  WON: 'won',
  LOST: 'lost',
});

// 策划 §19.5 的数值基准。
export const FACILITY_SPECS = Object.freeze({
  [FACILITY_TYPES.HARVESTER]: Object.freeze({
    label: '采冰器',
    cost: 10,
    upkeep: 1,
    waterPerSol: 3,
    hint: '全基地每 SOL +3 水，占用一块空地',
  }),
  [FACILITY_TYPES.HEATER]: Object.freeze({
    label: '加热桩',
    cost: 8,
    upkeep: 2,
    growthBoost: 0.4,
    hint: '所在地块生长速度 +40%',
  }),
  [FACILITY_TYPES.SHIELD]: Object.freeze({
    label: '遮蔽棚',
    cost: 12,
    upkeep: 0,
    hint: '所在地块免疫沙尘暴',
  }),
});

// 区位基准：坑底慢而多，坑缘快而险（策划 §19.5 地块表）。
const ZONE_SPECS = Object.freeze({
  [FARM_ZONES.FLOOR]: Object.freeze({
    label: '坑底',
    maturitySols: 14,
    baseYield: 7,
    yieldSpread: 1,
  }),
  [FARM_ZONES.SHADOW]: Object.freeze({
    label: '坑壁阴影',
    maturitySols: 11,
    baseYield: 5,
    yieldSpread: 1,
  }),
  [FARM_ZONES.RIM]: Object.freeze({
    label: '坑缘',
    maturitySols: 8,
    baseYield: 3,
    yieldSpread: 1,
  }),
});

export const getZoneSpec = (zone) => ZONE_SPECS[zone];

const REACTOR_ENERGY_PER_SOL = 2;
const WATER_PER_GROWING_PLOT = 1;
// 2 颗食用块茎转 1 颗种薯：留种必须真的吃掉产量。
export const TUBERS_PER_SEED = 2;
const STORM_WARNING_SOLS = 4;
const FIRST_STORM_MIN_SOL = 10;
const STORM_INTERVAL_MIN = 14;

const getFarmSeed = (crater) => stableHash(
  `farm|${crater?.id || crater?.CRATER_ID || 'unknown'}`
);

// 同一个坑的同名区位在不同坑里不一样：用真实环境向量调制生长速度。
// 压力越高生长越慢（0.78-1.05 区间），但不改变产量基准 —— 高压坑
// 的收益体现在订单与后续系统，切片里先只调节奏。
const getEnvironmentGrowthFactor = (crater) => {
  const environment = deriveCraterEnvironment(crater);
  return clamp(1.1 - (environment.pressure / 100) * 0.32, 0.78, 1.05);
};

const scheduleStorm = (seed, afterSol, stormIndex) => {
  const announceSol = afterSol
    + Math.round(seededUnit(seed, 900 + stormIndex) * 6);
  return {
    index: stormIndex,
    announceSol,
    arriveSol: announceSol + STORM_WARNING_SOLS,
    resolved: false,
  };
};

export const createFarmState = (crater) => {
  const seed = getFarmSeed(crater);

  return {
    seed,
    sol: 0,
    water: 24,
    energy: 30,
    tubers: 0,
    seedStock: 4,
    growthFactor: getEnvironmentGrowthFactor(crater),
    plots: [
      { id: 'floor-a', zone: FARM_ZONES.FLOOR, status: PLOT_STATUS.EMPTY, growth: 0, facility: null, stormHalved: false },
      { id: 'floor-b', zone: FARM_ZONES.FLOOR, status: PLOT_STATUS.LOCKED, growth: 0, facility: null, stormHalved: false },
      { id: 'shadow-a', zone: FARM_ZONES.SHADOW, status: PLOT_STATUS.EMPTY, growth: 0, facility: null, stormHalved: false },
      { id: 'shadow-b', zone: FARM_ZONES.SHADOW, status: PLOT_STATUS.LOCKED, growth: 0, facility: null, stormHalved: false },
      { id: 'rim-a', zone: FARM_ZONES.RIM, status: PLOT_STATUS.LOCKED, growth: 0, facility: null, stormHalved: false },
      { id: 'rim-b', zone: FARM_ZONES.RIM, status: PLOT_STATUS.LOCKED, growth: 0, facility: null, stormHalved: false },
    ],
    contracts: [
      {
        id: 'supply-tubers',
        label: '食用块茎供给',
        resource: 'tubers',
        amount: 20,
        deadlineSol: 30,
        status: 'open',
        rewardText: '解锁坑缘地块，能量 +20',
      },
      {
        id: 'supply-seeds',
        label: '种薯外送',
        resource: 'seedStock',
        amount: 10,
        deadlineSol: 55,
        status: 'open',
        rewardText: '切片完成',
      },
    ],
    storm: scheduleStorm(seed, FIRST_STORM_MIN_SOL, 0),
    facilitiesIdle: false,
    outcome: null,
    log: [{ sol: 0, text: '基地建立。TOVER 联盟的两份订单已经生效。' }],
  };
};

const withLog = (state, text) => ({
  ...state,
  log: [...state.log.slice(-19), { sol: state.sol, text }],
});

const getPlot = (state, plotId) => state.plots.find((plot) => plot.id === plotId);

const replacePlot = (state, plotId, patch) => ({
  ...state,
  plots: state.plots.map((plot) => (
    plot.id === plotId ? { ...plot, ...patch } : plot
  )),
});

export const getFacilityUpkeep = (state) => state.plots.reduce(
  (total, plot) => (
    plot.facility ? total + FACILITY_SPECS[plot.facility].upkeep : total
  ),
  0
);

const applyStormArrival = (state) => {
  let next = state;
  let rimLost = 0;
  let shadowHit = 0;

  next = {
    ...next,
    plots: next.plots.map((plot) => {
      const shielded = plot.facility === FACILITY_TYPES.SHIELD;
      const active = plot.status === PLOT_STATUS.GROWING
        || plot.status === PLOT_STATUS.READY;

      if (!active || shielded) return plot;

      if (plot.zone === FARM_ZONES.RIM) {
        rimLost += 1;
        return {
          ...plot, status: PLOT_STATUS.EMPTY, growth: 0, stormHalved: false,
        };
      }

      if (plot.zone === FARM_ZONES.SHADOW) {
        shadowHit += 1;
        return plot.status === PLOT_STATUS.GROWING
          ? { ...plot, growth: plot.growth * 0.5 }
          : { ...plot, stormHalved: true };
      }

      return plot;
    }),
  };

  const summary = [
    rimLost > 0 ? `坑缘 ${rimLost} 块地作物全损` : null,
    shadowHit > 0 ? `坑壁 ${shadowHit} 块地减半` : null,
  ].filter(Boolean).join('，') || '基地未受损失';

  next = withLog(next, `沙尘暴过境：${summary}。`);

  return {
    ...next,
    storm: scheduleStorm(
      next.seed,
      next.sol + STORM_INTERVAL_MIN,
      state.storm.index + 1
    ),
  };
};

export const advanceFarmSol = (state) => {
  if (!state || state.outcome) return state;

  let next = { ...state, sol: state.sol + 1 };
  next.energy = next.energy + REACTOR_ENERGY_PER_SOL;

  // 设施结算：能量不足时全部停转（产水与增益一并失效）并告警。
  const upkeep = getFacilityUpkeep(next);
  const facilitiesIdle = upkeep > next.energy;

  if (!facilitiesIdle) {
    next.energy -= upkeep;
    const harvesterCount = next.plots.filter(
      (plot) => plot.facility === FACILITY_TYPES.HARVESTER
    ).length;
    next.water += harvesterCount * FACILITY_SPECS.harvester.waterPerSol;
  }

  if (facilitiesIdle && !state.facilitiesIdle) {
    next = withLog(next, '能量不足，全部设施停转。');
  }
  next.facilitiesIdle = facilitiesIdle;

  // 地块生长：先按水量决定哪些地块得到灌溉（顺序即地块顺序）。
  const growingPlots = next.plots.filter(
    (plot) => plot.status === PLOT_STATUS.GROWING
  );
  let waterBudget = next.water;
  const wateredIds = new Set();

  growingPlots.forEach((plot) => {
    if (waterBudget >= WATER_PER_GROWING_PLOT) {
      waterBudget -= WATER_PER_GROWING_PLOT;
      wateredIds.add(plot.id);
    }
  });

  const stalledCount = growingPlots.length - wateredIds.size;
  next.water = waterBudget;

  next.plots = next.plots.map((plot) => {
    if (plot.status !== PLOT_STATUS.GROWING) return plot;
    if (!wateredIds.has(plot.id)) return plot;

    const spec = ZONE_SPECS[plot.zone];
    const heaterBoost = plot.facility === FACILITY_TYPES.HEATER && !facilitiesIdle
      ? 1 + FACILITY_SPECS.heater.growthBoost
      : 1;
    const growth = plot.growth
      + (100 / spec.maturitySols) * next.growthFactor * heaterBoost;

    return growth >= 100
      ? { ...plot, growth: 100, status: PLOT_STATUS.READY }
      : { ...plot, growth };
  });

  if (stalledCount > 0 && next.sol % 5 === 0) {
    next = withLog(next, `缺水：${stalledCount} 块地生长停滞。`);
  }

  // 沙尘暴：预告与到达。
  if (next.storm && next.sol === next.storm.announceSol) {
    next = withLog(
      next,
      `沙尘暴预告：${STORM_WARNING_SOLS} SOL 后抵达，坑缘全损、坑壁减半。`
    );
  }
  if (next.storm && next.sol >= next.storm.arriveSol) {
    next = applyStormArrival(next);
  }

  // 订单期限：任一违约即失败（策划 §19.5）。
  const expired = next.contracts.find(
    (contract) => contract.status === 'open' && next.sol > contract.deadlineSol
  );

  if (expired) {
    next = {
      ...withLog(next, `订单「${expired.label}」违约，基地失败。`),
      contracts: next.contracts.map((contract) => (
        contract.id === expired.id
          ? { ...contract, status: 'failed' }
          : contract
      )),
      outcome: FARM_OUTCOMES.LOST,
    };
  }

  return next;
};

export const plantPlot = (state, plotId) => {
  const plot = getPlot(state, plotId);

  if (
    !plot
    || state.outcome
    || plot.status !== PLOT_STATUS.EMPTY
    || plot.facility === FACILITY_TYPES.HARVESTER
    || state.seedStock < 1
  ) {
    return state;
  }

  return withLog(
    replacePlot(
      { ...state, seedStock: state.seedStock - 1 },
      plotId,
      { status: PLOT_STATUS.GROWING, growth: 0, stormHalved: false }
    ),
    `${ZONE_SPECS[plot.zone].label}地块播种。`
  );
};

export const harvestPlot = (state, plotId) => {
  const plot = getPlot(state, plotId);

  if (!plot || state.outcome || plot.status !== PLOT_STATUS.READY) {
    return state;
  }

  const spec = ZONE_SPECS[plot.zone];
  const jitter = Math.round(
    (seededUnit(state.seed, stableHash(`${plotId}|${state.sol}`)) * 2 - 1)
      * spec.yieldSpread
  );
  let yieldCount = Math.max(1, spec.baseYield + jitter);

  if (plot.stormHalved) {
    yieldCount = Math.max(1, Math.ceil(yieldCount / 2));
  }

  return withLog(
    replacePlot(
      { ...state, tubers: state.tubers + yieldCount },
      plotId,
      { status: PLOT_STATUS.EMPTY, growth: 0, stormHalved: false }
    ),
    `收获 ${yieldCount} 颗食用块茎。`
  );
};

export const buildFacility = (state, plotId, type) => {
  const plot = getPlot(state, plotId);
  const spec = FACILITY_SPECS[type];

  if (
    !plot
    || !spec
    || state.outcome
    || plot.status === PLOT_STATUS.LOCKED
    || plot.facility
    || state.energy < spec.cost
  ) {
    return state;
  }

  // 采冰器占用整块空地；加热桩与遮蔽棚可以建在已种植的地块上。
  if (type === FACILITY_TYPES.HARVESTER && plot.status !== PLOT_STATUS.EMPTY) {
    return state;
  }

  return withLog(
    replacePlot(
      { ...state, energy: state.energy - spec.cost },
      plotId,
      { facility: type }
    ),
    `${ZONE_SPECS[plot.zone].label}建成${spec.label}。`
  );
};

export const convertTubersToSeeds = (state, seedCount = 1) => {
  const cost = seedCount * TUBERS_PER_SEED;

  if (state.outcome || seedCount < 1 || state.tubers < cost) return state;

  return withLog(
    {
      ...state,
      tubers: state.tubers - cost,
      seedStock: state.seedStock + seedCount,
    },
    `${cost} 颗食用块茎转化为 ${seedCount} 颗种薯。`
  );
};

export const deliverContract = (state, contractId) => {
  const contract = state.contracts.find((item) => item.id === contractId);

  if (
    !contract
    || state.outcome
    || contract.status !== 'open'
    || state[contract.resource] < contract.amount
  ) {
    return state;
  }

  let next = {
    ...state,
    [contract.resource]: state[contract.resource] - contract.amount,
    contracts: state.contracts.map((item) => (
      item.id === contractId ? { ...item, status: 'done' } : item
    )),
  };

  next = withLog(next, `订单「${contract.label}」交付完成。`);

  // 订单一奖励：解锁坑缘地块 + 能量 20（策划 §19.5）。
  if (contractId === 'supply-tubers') {
    next = {
      ...next,
      energy: next.energy + 20,
      plots: next.plots.map((plot) => (
        plot.id === 'rim-a' && plot.status === PLOT_STATUS.LOCKED
          ? { ...plot, status: PLOT_STATUS.EMPTY }
          : plot
      )),
    };
    next = withLog(next, '坑缘地块解锁，能量补给 +20。');
  }

  const allDone = next.contracts.every((item) => item.status === 'done');

  return allDone
    ? { ...withLog(next, '全部订单完成，基地站稳了。'), outcome: FARM_OUTCOMES.WON }
    : next;
};

// 工具对某块地当前是否可用。场景高亮与 HUD 提示共用这一份
// 判定，与各操作函数的守卫保持一致。
export const canApplyTool = (state, plotId, tool) => {
  if (!state || state.outcome) return false;

  const plot = getPlot(state, plotId);

  if (!plot || plot.status === PLOT_STATUS.LOCKED) return false;

  switch (tool) {
    case TOOL_MODES.PLANT:
      return plot.status === PLOT_STATUS.EMPTY
        && plot.facility !== FACILITY_TYPES.HARVESTER
        && state.seedStock >= 1;
    case TOOL_MODES.HARVEST:
      return plot.status === PLOT_STATUS.READY;
    case TOOL_MODES.BUILD_HARVESTER:
      return !plot.facility
        && plot.status === PLOT_STATUS.EMPTY
        && state.energy >= FACILITY_SPECS.harvester.cost;
    case TOOL_MODES.BUILD_HEATER:
      return !plot.facility
        && state.energy >= FACILITY_SPECS.heater.cost;
    case TOOL_MODES.BUILD_SHIELD:
      return !plot.facility
        && state.energy >= FACILITY_SPECS.shield.cost;
    default:
      return false;
  }
};

// HUD 告警：低水、低能量、待收获、风暴倒计时。
export const getFarmAlerts = (state) => {
  if (!state) return [];
  const alerts = [];
  const growingCount = state.plots.filter(
    (plot) => plot.status === PLOT_STATUS.GROWING
  ).length;

  if (growingCount > 0 && state.water < growingCount * 4) {
    alerts.push({ kind: 'water', text: '水量告急' });
  }
  if (state.facilitiesIdle) {
    alerts.push({ kind: 'energy', text: '设施停转' });
  }
  if (state.plots.some((plot) => plot.status === PLOT_STATUS.READY)) {
    alerts.push({ kind: 'harvest', text: '有地块待收获' });
  }
  if (
    state.storm
    && state.sol >= state.storm.announceSol
    && state.sol < state.storm.arriveSol
  ) {
    alerts.push({
      kind: 'storm',
      text: `沙尘暴 ${state.storm.arriveSol - state.sol} SOL 后抵达`,
    });
  }

  return alerts;
};
