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
  FLOOR: 'floor',
  SHADOW: 'shadow',
  RIM: 'rim',
});

// 地块用途。旧实现用 LOCKED 状态锁死 4/6 的地块且只有一条解锁路径，
// 三分之一的内容永远进不去。现在 26 格全部存在，靠「开垦」逐步展开。
export const CELL_USES = Object.freeze({
  CROP: 'crop',
  FACILITY: 'facility',
});

export const CROP_STATUS = Object.freeze({
  GROWING: 'growing',
  READY: 'ready',
});

export const FACILITY_TYPES = Object.freeze({
  EXTRACTOR: 'extractor',
  SOLAR: 'solar',
  BATTERY: 'battery',
  HEATER: 'heater',
  SHIELD: 'shield',
});

export const TOOL_MODES = Object.freeze({
  CLEAR: 'clear',
  PLANT: 'plant',
  HARVEST: 'harvest',
  DEMOLISH: 'demolish',
  BUILD_EXTRACTOR: 'build-extractor',
  BUILD_SOLAR: 'build-solar',
  BUILD_BATTERY: 'build-battery',
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
  [TOOL_MODES.BUILD_SOLAR]: FACILITY_TYPES.SOLAR,
  [TOOL_MODES.BUILD_BATTERY]: FACILITY_TYPES.BATTERY,
  [TOOL_MODES.BUILD_HEATER]: FACILITY_TYPES.HEATER,
  [TOOL_MODES.BUILD_SHIELD]: FACILITY_TYPES.SHIELD,
});

// 设施规格。upkeep 是每 SOL 的能量维持费 —— 遮蔽棚此前是 0，
// 铺满即永久删除沙尘暴（唯一的事件系统），现在它也要烧能量。
export const FACILITY_SPECS = Object.freeze({
  [FACILITY_TYPES.EXTRACTOR]: Object.freeze({
    label: '采冰器',
    cost: 8,
    upkeep: 1.5,
    waterPerSol: 3,
    hint: '每 SOL +3 水；相邻坑壁格每格 +12%',
    // 采冰器建在坑壁旁更有效：阴影区的水冰埋得浅。
    adjacencyZone: FARM_ZONES.SHADOW,
    adjacencyBonus: 0.12,
  }),
  [FACILITY_TYPES.SOLAR]: Object.freeze({
    label: '光伏阵',
    cost: 10,
    upkeep: 0,
    energyPerSol: 3,
    hint: '每 SOL +3 能量；坑缘 +30%、坑底 −25%、相邻光伏互相遮挡 −12%',
  }),
  [FACILITY_TYPES.BATTERY]: Object.freeze({
    label: '蓄电组',
    cost: 8,
    upkeep: 0,
    energyCapBonus: 30,
    hint: '能量上限 +30',
  }),
  [FACILITY_TYPES.HEATER]: Object.freeze({
    label: '加热桩',
    cost: 6,
    upkeep: 2.5,
    growthBoost: 0.45,
    neighbourGrowthBoost: 0.25,
    hint: '自身生长 +45%，相邻格 +25%',
  }),
  [FACILITY_TYPES.SHIELD]: Object.freeze({
    label: '遮蔽棚',
    cost: 9,
    upkeep: 1.5,
    hint: '自身与相邻格免疫沙尘暴',
  }),
});

// 区位基准：坑底慢而多，坑缘快而险。
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

// ─── 速率基准 ──────────────────────────────────────────────────
// 旧版：反应堆 +2/SOL 无上限，一台采冰器 +3 水养 3 块地耗 3 水，
// 于是水和能量在第一次建造之后都不再是约束。现在能量有上限、
// 水有多个消耗端争抢，且两者都有上限。
export const REACTOR_ENERGY_PER_SOL = 6;
export const BASE_ENERGY_CAP = 40;
export const BASE_WATER_CAP = 60;
// 基地自带的冷凝回收：保证「一台采冰器都没有」时也能撑到建起第一台，
// 但远不足以支撑扩张。没有它，开局第一批作物会在成熟前旱死，
// 而那时的能量还买不起采冰器 —— 死局。
export const BASE_WATER_RECLAIM = 1.6;
export const WATER_PER_CROP_CELL = 1;
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
// 节奏要求：玩家持续操作时一轮应在 15 分钟内走完。推论是等待必须
// 可跳过，且节奏由玩家的决策密度门控 —— 所以时钟状态放在 reducer
// 里（可测、可序列化），而不是组件的 useState。
export const SOL_BASE_MS = 2400;
export const SPEED_STEPS = Object.freeze([1, 2, 4]);
// 单次「跳到下一节点」最多推进的 SOL 数：即使一路无事也要交还控制权。
export const SKIP_MAX_SOLS = 15;

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
    deadlineSol: 26,
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
    // 26 格全部存在。cleared=false 即待开垦，不是永久锁死。
    // 初始开垦 4 格：坑底 3 格种植 + 坑壁 1 格。开局的必修课是
    // 「先建采冰器」，它会占掉坑壁那格，剩下 3 格农田恰好够
    // 在首个合约截止前攒出交付量（含产量抖动的最差情况）。
    cells: createCellLattice(seed).map((cell) => ({
      id: cell.id,
      zone: cell.zone,
      ring: cell.ring,
      cleared: cell.ring === 0
        || cell.id === 'floor-1-0'
        || cell.id === 'shadow-2-0',
      use: null,
      crop: null,
      facility: null,
    })),
    stores: { water: 30, energy: 22, tubers: 0, seedStock: 4 },
    // 水与能量都有上限：无上限的资源在第一次建造之后就不再是约束。
    // 水的上限靠储水罐（暂未开放）与蓄电组之外的手段抬高，
    // Phase 1 固定，逼玩家把多余的产能变成地块而不是存起来。
    caps: { water: BASE_WATER_CAP, energy: BASE_ENERGY_CAP },
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
  schemaVersion: 1,
  sol: 0,
  clock: { paused: false, speed: 1, autoPauseArmed: true },

  activeBaseId: 'base-01',
  baseOrder: ['base-01'],
  bases: { 'base-01': createBaseState(crater, 'base-01') },

  contracts: CONTRACT_LADDER.map((contract) => ({
    ...contract,
    status: 'open',
  })),

  outcome: null,
  lossReason: null,
  log: [{ sol: 0, text: '首舱着陆。TOVER 联盟的供给合约已生效。' }],
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
