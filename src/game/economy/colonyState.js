// 殖民地状态的构造与访问器。
//
// 结构按多基地设计：Phase 1 只有一个基地，但 bases 是映射而非单个
// farm 对象，Phase 2 接入多坑扩张时不需要重构存档结构。
//
// 划分依据：殖民者、品系、科技、合约属于殖民地级（跨基地共享，
// 一个人不属于某个坑，一次科技解锁是全局的）；库存、地块、灾害、
// 环境属于基地级（实物不会在坑之间瞬移）。

import { stableHash } from '../util/deterministic';
import { deriveCraterEnvironment } from '../planting/plantingEngine';
import { createCellLattice } from './baseLayout';

export const FARM_ZONES = Object.freeze({
  CORE: 'core',
  INNER: 'inner',
  FLOOR: 'inner',
  SHADOW: 'shadow',
  RIM: 'rim',
});

// 地块用途。2.3 原型不再让玩家先开垦小坑位：坑外工业平台开局展开，
// 玩家直接在可见平台上搭生产链，后续扩展才会重新引入开拓成本。
export const CELL_USES = Object.freeze({
  FACILITY: 'facility',
});

// 每个坑只有一个位于几何中心的种植核心，长一棵「超级土豆」。
// 建筑格全部在坑外工业平台上，培育设施通过 corePort 接入坑心主管线。
export const PLANTING_BED_ID = 'core-0-0';

export const POTATO_STATUS = Object.freeze({
  EMPTY: 'empty',
  GROWING: 'growing',
  READY: 'ready',
});

export const FACILITY_TYPES = Object.freeze({
  EXTRACTOR: 'extractor',
  SIFTER: 'sifter',
  SOLAR: 'solar',
  BATTERY: 'battery',
  NUTRIENT: 'nutrient',
  ROOT_FEEDER: 'root-feeder',
  HEATER: 'heater',
  SHIELD: 'shield',
});

export const FACILITY_STATUS = Object.freeze({
  BUILDING: 'building',
  RUNNING: 'running',
  DEGRADED: 'degraded',
  STOPPED: 'stopped',
});

export const TOOL_MODES = Object.freeze({
  CLEAR: 'clear',
  PLANT: 'plant',
  HARVEST: 'harvest',
  REPAIR: 'repair',
  DEMOLISH: 'demolish',
  BUILD_EXTRACTOR: 'build-extractor',
  BUILD_SIFTER: 'build-sifter',
  BUILD_SOLAR: 'build-solar',
  BUILD_BATTERY: 'build-battery',
  BUILD_NUTRIENT: 'build-nutrient',
  BUILD_ROOT_FEEDER: 'build-root-feeder',
  BUILD_HEATER: 'build-heater',
  BUILD_SHIELD: 'build-shield',
});

export const COLONY_OUTCOMES = Object.freeze({
  WON: 'won',
  LOST: 'lost',
});

export const LOSS_REASONS = Object.freeze({
  CONTRACT: 'contract',
  BLACKOUT: 'blackout',
  SEED: 'seed',
});

// 工具 → 设施类型。建造类工具全部走同一条 buildFacility 路径。
export const TOOL_FACILITY = Object.freeze({
  [TOOL_MODES.BUILD_EXTRACTOR]: FACILITY_TYPES.EXTRACTOR,
  [TOOL_MODES.BUILD_SIFTER]: FACILITY_TYPES.SIFTER,
  [TOOL_MODES.BUILD_SOLAR]: FACILITY_TYPES.SOLAR,
  [TOOL_MODES.BUILD_BATTERY]: FACILITY_TYPES.BATTERY,
  [TOOL_MODES.BUILD_NUTRIENT]: FACILITY_TYPES.NUTRIENT,
  [TOOL_MODES.BUILD_ROOT_FEEDER]: FACILITY_TYPES.ROOT_FEEDER,
  [TOOL_MODES.BUILD_HEATER]: FACILITY_TYPES.HEATER,
  [TOOL_MODES.BUILD_SHIELD]: FACILITY_TYPES.SHIELD,
});

export const FACILITY_CATEGORIES = Object.freeze({
  COLLECTION: 'collection',
  ENERGY: 'energy',
  PROCESSING: 'processing',
  CULTIVATION: 'cultivation',
});

const ALL_ZONES = Object.freeze([
  FARM_ZONES.INNER,
  FARM_ZONES.SHADOW,
  FARM_ZONES.RIM,
]);

// 设施规格同时驱动规则、HUD 与 3D 状态。建造费在下单时支付，
// buildSols 结束前不生产、不吃维持能量。
export const FACILITY_SPECS = Object.freeze({
  [FACILITY_TYPES.EXTRACTOR]: Object.freeze({
    label: '采冰器',
    category: FACILITY_CATEGORIES.COLLECTION,
    cost: 8,
    upkeep: 1.2,
    buildSols: 2,
    waterPerSol: 4.2,
    allowedZones: Object.freeze([FARM_ZONES.SHADOW]),
    hint: '从坑外背阴冰脉接口抽取水冰',
  }),
  [FACILITY_TYPES.SIFTER]: Object.freeze({
    label: '矿物筛分机',
    category: FACILITY_CATEGORIES.COLLECTION,
    cost: 7,
    upkeep: 1,
    buildSols: 2,
    mineralPerSol: 2.4,
    allowedZones: Object.freeze([FARM_ZONES.SHADOW, FARM_ZONES.RIM]),
    hint: '筛取坑外地质接口中的矿物',
  }),
  [FACILITY_TYPES.SOLAR]: Object.freeze({
    label: '光伏阵',
    category: FACILITY_CATEGORIES.ENERGY,
    cost: 10,
    upkeep: 0,
    buildSols: 2,
    energyPerSol: 3,
    allowedZones: ALL_ZONES,
    hint: '每 SOL +3 能量；外缘平台 +30%、相邻光伏互相遮挡 −12%',
  }),
  [FACILITY_TYPES.BATTERY]: Object.freeze({
    label: '蓄电组',
    category: FACILITY_CATEGORIES.ENERGY,
    cost: 8,
    upkeep: 0,
    buildSols: 2,
    energyCapBonus: 30,
    allowedZones: ALL_ZONES,
    hint: '能量上限 +30',
  }),
  [FACILITY_TYPES.NUTRIENT]: Object.freeze({
    label: '营养合成器',
    category: FACILITY_CATEGORIES.PROCESSING,
    cost: 10,
    upkeep: 1.5,
    buildSols: 3,
    waterInput: 1.8,
    mineralInput: 1,
    nutrientPerSol: 2.4,
    remoteEfficiency: 0.65,
    supplierAdjacencyBonus: 0.15,
    allowedZones: Object.freeze([FARM_ZONES.INNER, FARM_ZONES.SHADOW, FARM_ZONES.RIM]),
    hint: '把水与矿物合成为营养液',
  }),
  [FACILITY_TYPES.ROOT_FEEDER]: Object.freeze({
    label: '根区灌注器',
    category: FACILITY_CATEGORIES.CULTIVATION,
    cost: 9,
    upkeep: 1.2,
    buildSols: 2,
    waterPerSol: 5,
    nutrientPerSol: 2,
    requiresCorePort: true,
    allowedZones: Object.freeze([FARM_ZONES.INNER]),
    hint: '接入坑心主管线，输送水与营养',
  }),
  [FACILITY_TYPES.HEATER]: Object.freeze({
    label: '热调节桩',
    category: FACILITY_CATEGORIES.CULTIVATION,
    cost: 6,
    upkeep: 2.2,
    buildSols: 2,
    thermalPerSol: 0.65,
    requiresCorePort: true,
    allowedZones: Object.freeze([FARM_ZONES.INNER]),
    hint: '接入坑心热交换线，稳定根区温度',
  }),
  [FACILITY_TYPES.SHIELD]: Object.freeze({
    label: '辐射遮蔽器',
    category: FACILITY_CATEGORIES.CULTIVATION,
    cost: 9,
    upkeep: 1.5,
    buildSols: 3,
    stabilityPerSol: 0.7,
    requiresCorePort: true,
    allowedZones: Object.freeze([FARM_ZONES.INNER]),
    hint: '接入遮蔽投射线，抵御辐射与风暴',
  }),
});

// 区位基准。种植床固定在坑底，所以只有坑底这一档参与生长计算；
// 坑壁与坑缘的差异改为体现在设施效率上（采冰器、光伏的区位加成）。
const ZONE_SPECS = Object.freeze({
  [FARM_ZONES.CORE]: Object.freeze({ label: '中央土豆' }),
  [FARM_ZONES.INNER]: Object.freeze({ label: '培育接口' }),
  [FARM_ZONES.SHADOW]: Object.freeze({ label: '背阴平台' }),
  [FARM_ZONES.RIM]: Object.freeze({ label: '外缘平台' }),
});

export const getZoneSpec = (zone) => ZONE_SPECS[zone];

// ─── 超级土豆 ─────────────────────────────────────────────────
// 一个坑只长一棵，产量由「长到多大」决定而不是「种了几格」。
// 成熟需要的养护量远大于单格作物：这棵树是整个基地的唯一产出口。
export const POTATO_MATURITY_SOLS = 16;
// 体积随养护质量增长，收获量 = 最终体积。基准 12，满养护可到 26。
export const POTATO_BASE_YIELD = 12;
export const POTATO_MAX_YIELD = 26;
// 超级土豆的耗水远高于普通作物 —— 它是基地唯一的水槽大头，
// 且必须压过一台采冰器（含邻接加成约 5.7/SOL），否则「建一台就
// 解决水」的老毛病会原样回来。想养满它需要两台以上，或者用
// 蓄水峰值扛过生长期。
export const WATER_PER_POTATO = 6.5;

// ─── 速率基准 ──────────────────────────────────────────────────
// 旧版：反应堆 +2/SOL 无上限，一台采冰器 +3 水养 3 块地耗 3 水，
// 于是水和能量在第一次建造之后都不再是约束。现在能量有上限、
// 水有多个消耗端争抢，且两者都有上限。
export const REACTOR_ENERGY_PER_SOL = 6;
export const BASE_ENERGY_CAP = 40;
export const BASE_WATER_CAP = 60;
export const BASE_MINERAL_CAP = 40;
export const BASE_NUTRIENT_CAP = 30;
// 基地自带的冷凝回收：保证「一台采冰器都没有」时也能撑到建起第一台，
// 但远不足以支撑扩张。没有它，开局第一批作物会在成熟前旱死，
// 而那时的能量还买不起采冰器 —— 死局。
export const BASE_WATER_RECLAIM = 1.6;
// Stage 7 接入真实队伍后，这一项由 Σ getCrewOutput().rationDraw 取代。
export const BASE_CREW_COUNT = 4;
export const WATER_PER_CREW = 0.3;
export const CLEAR_COST = 2;
export const TUBERS_PER_SEED = 2;

// 沙尘暴：间隔逐次缩短，且严重度按次数升级 —— 后期风暴会打坏建筑，
// 于是遮蔽棚花在作物上就等于丢建筑，两者互相竞争。
export const STORM_WARNING_SOLS = 4;
export const FIRST_STORM_SOL = 10;
export const STORM_INTERVAL_START = 18;
export const STORM_INTERVAL_STEP = 2;
export const STORM_INTERVAL_MIN = 9;

// 寒潮：遮蔽棚答不了的第二种事件，反制手段是加热桩，
// 与遮蔽棚争同一份能量。
export const COLD_SNAP_FIRST_SOL = 34;
export const COLD_SNAP_INTERVAL = 22;
export const COLD_SNAP_DURATION = 5;
export const COLD_SNAP_GROWTH_MULTIPLIER = 0.45;

export const BLACKOUT_LOSS_SOLS = 8;

// ─── 时钟 ─────────────────────────────────────────────────────
// 基地进入后先停在 SOL 00 的整备态；首个有效基地操作自动启动时钟，
// 此后连续推进且没有玩家暂停入口。速度只用于开发调试。
export const SOL_BASE_MS = 2400;
export const SPEED_STEPS = Object.freeze([1, 2, 4]);

const getCraterId = (crater) => crater?.id || crater?.CRATER_ID || 'unknown';

// 环境 → 生长速率。旧版返回 0.78-1.05，坑底 14 SOL 成熟意味着好坑
// 13.3 SOL、差坑 18 SOL，首个合约在差坑上数学上不可达。收窄到
// 0.90-1.08：坑的差异改由「形状」承担（哪个区位快、采冰器多有效、
// 风暴多疼），而不是一个决定胜负的速率系数。
export const getEnvironmentGrowthFactor = (environment) => {
  const pressure = environment?.pressure ?? 50;
  return Math.min(1.08, Math.max(0.9, 1.12 - (pressure / 100) * 0.28));
};

export const scheduleStorm = (seed, afterSol, index) => {
  const interval = Math.max(
    STORM_INTERVAL_MIN,
    STORM_INTERVAL_START - index * STORM_INTERVAL_STEP
  );
  const announceSol = afterSol + interval;

  return {
    index,
    announceSol,
    arriveSol: announceSol + STORM_WARNING_SOLS,
  };
};

export const scheduleColdSnap = (afterSol, index) => ({
  index,
  arriveSol: Math.max(COLD_SNAP_FIRST_SOL, afterSol + COLD_SNAP_INTERVAL),
});

// 合约阶梯。每一档的奖励都是能量补给 —— 交付换来的是继续扩张的本钱。
export const CONTRACT_LADDER = Object.freeze([
  Object.freeze({
    id: 'supply-01',
    label: '首批供给',
    resource: 'tubers',
    amount: 14,
    deadlineSol: 34,
    energyReward: 18,
    rewardText: '能量补给 +18',
  }),
  Object.freeze({
    id: 'supply-02',
    label: '扩产订单',
    resource: 'tubers',
    amount: 30,
    deadlineSol: 52,
    energyReward: 26,
    rewardText: '能量补给 +26',
  }),
  Object.freeze({
    id: 'supply-03',
    label: '种薯外送',
    resource: 'seedStock',
    amount: 10,
    deadlineSol: 82,
    energyReward: 0,
    rewardText: '基地站稳',
  }),
]);

export const createBaseState = (crater, id) => {
  const seed = stableHash(`base|${id}|${getCraterId(crater)}`);
  const environment = deriveCraterEnvironment(crater);

  return {
    id,
    craterId: getCraterId(crater),
    seed,
    environment,
    growthFactor: getEnvironmentGrowthFactor(environment),
    cells: [
      {
        id: PLANTING_BED_ID,
        zone: FARM_ZONES.CORE,
        ring: -1,
        isPlantingBed: true,
        cleared: true,
        use: null,
        facility: null,
      },
      ...createCellLattice(seed).map((cell) => ({
        id: cell.id,
        zone: cell.zone,
        ring: cell.ring,
        column: cell.column,
        row: cell.row,
        corePort: cell.corePort,
        isPlantingBed: false,
        cleared: true,
        use: null,
        facility: null,
      })),
    ],
    // 唯一的那棵超级土豆。null = 种植床空着。
    potato: null,
    stores: {
      water: 30,
      energy: 34,
      minerals: 0,
      nutrients: 0,
      tubers: 0,
      seedStock: 4,
    },
    // 水与能量都有上限：无上限的资源在第一次建造之后就不再是约束。
    // 水的上限靠储水罐（暂未开放）与蓄电组之外的手段抬高，
    // Phase 1 固定，逼玩家把多余的产能变成地块而不是存起来。
    caps: {
      water: BASE_WATER_CAP,
      energy: BASE_ENERGY_CAP,
      minerals: BASE_MINERAL_CAP,
      nutrients: BASE_NUTRIENT_CAP,
    },
    hazards: {
      storm: scheduleStorm(seed, FIRST_STORM_SOL - STORM_INTERVAL_START, 0),
      coldSnap: scheduleColdSnap(0, 0),
      coldSnapUntilSol: 0,
    },
    facilitiesIdle: false,
    blackoutSols: 0,
  };
};

export const createColonyState = (crater) => ({
  schemaVersion: 2,
  sol: 0,
  clock: { started: false, speed: 1 },

  activeBaseId: 'base-01',
  baseOrder: ['base-01'],
  bases: { 'base-01': createBaseState(crater, 'base-01') },

  contracts: CONTRACT_LADDER.map((contract) => ({
    ...contract,
    status: 'open',
  })),

  outcome: null,
  lossReason: null,
  log: [{ sol: 0, text: '首舱着陆。坑外工业平台展开，中央土豆等待播种。' }],
});

export const getActiveBase = (colony) => colony?.bases?.[colony.activeBaseId];

export const patchBase = (colony, baseId, patch) => ({
  ...colony,
  bases: {
    ...colony.bases,
    [baseId]: { ...colony.bases[baseId], ...patch },
  },
});

export const getCell = (base, cellId) => base.cells.find(
  (cell) => cell.id === cellId
);

export const patchCell = (base, cellId, patch) => ({
  ...base,
  cells: base.cells.map((cell) => (
    cell.id === cellId ? { ...cell, ...patch } : cell
  )),
});

export const withLog = (colony, text) => ({
  ...colony,
  log: [...colony.log.slice(-19), { sol: colony.sol, text }],
});
