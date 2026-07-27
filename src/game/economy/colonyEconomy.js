// 殖民地经营的规则层。纯函数、确定性：同一个坑、同一串操作，
// 永远得到同一局。育种、遗传与人体反馈是待接回子系统，本层不依赖它们。

import { clamp } from '../util/deterministic';
import { getNeighbourIds } from './baseLayout';
import {
  BASE_CREW_COUNT,
  BASE_WATER_RECLAIM,
  BLACKOUT_LOSS_SOLS,
  CELL_USES,
  CLEAR_COST,
  COLD_SNAP_DURATION,
  COLD_SNAP_GROWTH_MULTIPLIER,
  COLONY_OUTCOMES,
  FACILITY_SPECS,
  FACILITY_TYPES,
  FARM_ZONES,
  getActiveBase,
  getCell,
  getZoneSpec,
  LOSS_REASONS,
  patchBase,
  patchCell,
  POTATO_BASE_YIELD,
  POTATO_MATURITY_SOLS,
  POTATO_MAX_YIELD,
  POTATO_STATUS,
  REACTOR_ENERGY_PER_SOL,
  scheduleColdSnap,
  scheduleStorm,
  STORM_WARNING_SOLS,
  TOOL_FACILITY,
  TOOL_MODES,
  TUBERS_PER_SEED,
  WATER_PER_CREW,
  WATER_PER_POTATO,
  withLog,
} from './colonyState';

const isFacility = (cell, type) => cell.facility?.type === type;

const countFacilities = (base, type) => base.cells.filter(
  (cell) => isFacility(cell, type)
).length;

const getNeighbourCells = (base, cellId) => getNeighbourIds(cellId)
  .map((id) => getCell(base, id))
  .filter(Boolean);

// 是否被遮蔽棚罩住：自身是遮蔽棚，或任一相邻格是遮蔽棚。
export const isShielded = (base, cellId) => {
  const cell = getCell(base, cellId);
  if (!cell) return false;
  if (isFacility(cell, FACILITY_TYPES.SHIELD)) return true;

  return getNeighbourCells(base, cellId).some(
    (neighbour) => isFacility(neighbour, FACILITY_TYPES.SHIELD)
  );
};

// 是否被加热桩覆盖（自身或相邻）。寒潮只打没有加热覆盖的格子。
export const isHeated = (base, cellId) => {
  const cell = getCell(base, cellId);
  if (!cell) return false;
  if (isFacility(cell, FACILITY_TYPES.HEATER)) return true;

  return getNeighbourCells(base, cellId).some(
    (neighbour) => isFacility(neighbour, FACILITY_TYPES.HEATER)
  );
};

// ─── 速率 ─────────────────────────────────────────────────────

export const getWaterCap = (base) => base.caps.water;

export const getEnergyCap = (base) => (
  base.caps.energy
  + countFacilities(base, FACILITY_TYPES.BATTERY)
    * FACILITY_SPECS[FACILITY_TYPES.BATTERY].energyCapBonus
);

export const getFacilityUpkeep = (base) => base.cells.reduce(
  (total, cell) => (
    cell.facility ? total + FACILITY_SPECS[cell.facility.type].upkeep : total
  ),
  0
);

// 采冰器产水，按相邻坑壁格数加成：阴影区的水冰埋得浅。
// 基础冷凝回收始终存在（哪怕设施全停），否则开局第一批作物会在
// 成熟前旱死，而那时的能量还买不起采冰器 —— 无解的开局。
export const getWaterIncome = (base) => {
  const spec = FACILITY_SPECS[FACILITY_TYPES.EXTRACTOR];

  return base.cells.reduce((total, cell) => {
    if (!isFacility(cell, FACILITY_TYPES.EXTRACTOR)) return total;

    const adjacent = getNeighbourCells(base, cell.id).filter(
      (neighbour) => neighbour.zone === spec.adjacencyZone
    ).length;

    return total + spec.waterPerSol * (1 + adjacent * spec.adjacencyBonus);
  }, BASE_WATER_RECLAIM);
};

// 光伏产能：坑缘日照好、坑底被坑壁挡；相邻光伏互相遮挡。
// 于是「把光伏挤在一起」是错的，空间布局有真实代价。
export const getSolarIncome = (base) => {
  const spec = FACILITY_SPECS[FACILITY_TYPES.SOLAR];

  return base.cells.reduce((total, cell) => {
    if (!isFacility(cell, FACILITY_TYPES.SOLAR)) return total;

    const zoneFactor = cell.zone === FARM_ZONES.RIM
      ? 1.3
      : cell.zone === FARM_ZONES.FLOOR ? 0.75 : 1;
    const crowding = getNeighbourCells(base, cell.id).filter(
      (neighbour) => isFacility(neighbour, FACILITY_TYPES.SOLAR)
    ).length;

    return total + spec.energyPerSol * zoneFactor * Math.max(0.4, 1 - crowding * 0.12);
  }, 0);
};

export const getEnergyIncome = (base) => (
  REACTOR_ENERGY_PER_SOL + getSolarIncome(base)
);

// ─── 超级土豆 ─────────────────────────────────────────────────

export const getPlantingBed = (base) => base.cells.find(
  (cell) => cell.isPlantingBed
);

export const hasGrowingPotato = (base) => Boolean(
  base.potato && base.potato.status === POTATO_STATUS.GROWING
);

// 耗水端：超级土豆是大头，队伍也喝水。
export const getWaterDrain = (base) => (
  (base.potato ? WATER_PER_POTATO : 0)
  + BASE_CREW_COUNT * WATER_PER_CREW
);

// 超级土豆的生长速度。加热桩必须建在种植床的相邻格才生效 ——
// 种植床只有 3-5 个邻格，这几个位置的争夺就是布局的核心。
export const getPotatoGrowthRate = (colony, base) => {
  const bed = getPlantingBed(base);
  if (!bed) return 0;

  const heaterSpec = FACILITY_SPECS[FACILITY_TYPES.HEATER];
  const heaters = getNeighbourCells(base, bed.id).filter(
    (cell) => isFacility(cell, FACILITY_TYPES.HEATER)
  ).length;
  const boost = base.facilitiesIdle
    ? 1
    : 1 + heaters * heaterSpec.neighbourGrowthBoost;
  const chilled = colony.sol < base.hazards.coldSnapUntilSol && heaters === 0;

  return (100 / POTATO_MATURITY_SOLS)
    * base.growthFactor
    * boost
    * (chilled ? COLD_SNAP_GROWTH_MULTIPLIER : 1);
};

// 收获量 = 长到多大。养护质量（浇够水的比例 + 加热覆盖）决定体积，
// 所以「怎么伺候这一棵」直接就是产量，而不是再乘一个隐藏系数。
export const getPotatoYield = (base) => {
  if (!base.potato) return 0;
  const quality = clamp(base.potato.quality, 0, 1);

  return Math.round(
    POTATO_BASE_YIELD + (POTATO_MAX_YIELD - POTATO_BASE_YIELD) * quality
  );
};

// ─── 事件 ─────────────────────────────────────────────────────

// 风暴严重度随次数升级：前两次只打坑缘，之后波及坑壁，
// 第五次起开始打坏建筑 —— 遮蔽棚花在作物上就等于丢建筑。
export const getStormSeverity = (index) => {
  if (index <= 1) return { zones: [FARM_ZONES.RIM], damagesFacilities: false };
  if (index <= 3) {
    return {
      zones: [FARM_ZONES.RIM, FARM_ZONES.SHADOW],
      damagesFacilities: false,
    };
  }
  return {
    zones: [FARM_ZONES.RIM, FARM_ZONES.SHADOW, FARM_ZONES.FLOOR],
    damagesFacilities: true,
  };
};

const applyStormArrival = (colony, base) => {
  const severity = getStormSeverity(base.hazards.storm.index);
  let facilitiesHit = 0;
  let potatoNote = null;
  let potato = base.potato;

  // 超级土豆在坑底，只有升级到全区的风暴才够得着它，
  // 且遮蔽棚（自身或相邻）能完全挡下。挡不住也不会死，
  // 而是折损养护质量 —— 收获的体积会小一圈。
  const bed = getPlantingBed(base);

  if (
    potato
    && bed
    && severity.zones.includes(bed.zone)
    && !isShielded(base, bed.id)
  ) {
    const shelter = base.environment.shelter ?? 30;
    const bite = clamp(0.3 - (shelter / 100) * 0.18, 0.1, 0.3);
    potato = { ...potato, quality: Math.max(0, potato.quality - bite) };
    potatoNote = '超级土豆被沙尘打伤，体积受损';
  }

  const cells = base.cells.map((cell) => {
    if (isShielded(base, cell.id)) return cell;
    if (!severity.zones.includes(cell.zone)) return cell;
    if (!severity.damagesFacilities || !cell.facility) return cell;

    facilitiesHit += 1;
    return {
      ...cell,
      facility: {
        ...cell.facility,
        integrity: Math.max(0, cell.facility.integrity - 20),
      },
    };
  });

  const summary = [
    potatoNote,
    facilitiesHit > 0 ? `${facilitiesHit} 座设施受损` : null,
  ].filter(Boolean).join('，') || '基地未受损失';

  return {
    cells,
    potato,
    hazards: {
      ...base.hazards,
      storm: scheduleStorm(
        base.seed,
        colony.sol,
        base.hazards.storm.index + 1
      ),
    },
    summary,
  };
};

// ─── 每 SOL 推进 ───────────────────────────────────────────────

export const advanceColonySol = (colony) => {
  if (!colony || colony.outcome) return colony;

  const baseId = colony.activeBaseId;
  let next = { ...colony, sol: colony.sol + 1 };
  let base = { ...next.bases[baseId] };

  // 能量：先进账再付维持费，超出上限的部分溢出（蓄电组抬高上限）。
  const energyCap = getEnergyCap(base);
  let energy = Math.min(energyCap, base.stores.energy + getEnergyIncome(base));
  const upkeep = getFacilityUpkeep(base);
  const facilitiesIdle = upkeep > energy;

  // 付不出维持费时设施不是「关机待命」而是掉电停转：能拿的能量照样
  // 被抽干。否则下一个 SOL 攒够了又能开机，基地在开停之间无限震荡，
  // 断电永远累积不到失败线。掉电后想恢复只能拆设施 —— 这才是决策。
  energy = Math.max(0, energy - upkeep);

  const wasIdle = base.facilitiesIdle;
  base.facilitiesIdle = facilitiesIdle;
  base.blackoutSols = facilitiesIdle ? base.blackoutSols + 1 : 0;

  // 水：设施停转时采冰器也停，这让「能量不足」真的会连锁到缺水，
  // 但基础冷凝回收不依赖电力，始终保底。与能量一样有上限 ——
  // 无上限的资源在第一次建造后就不再是约束。
  const water = Math.min(
    getWaterCap(base),
    base.stores.water
      + (facilitiesIdle ? BASE_WATER_RECLAIM : getWaterIncome(base))
  );

  // 灌溉：超级土豆优先，队伍其次。浇够水的比例累积成养护质量，
  // 直接决定最终收获的体积 —— 断水不会让它死，但会让它长不大。
  let waterBudget = water;
  let potato = base.potato;

  if (potato && potato.status === POTATO_STATUS.GROWING) {
    const share = Math.min(1, waterBudget / WATER_PER_POTATO);
    waterBudget = Math.max(0, waterBudget - WATER_PER_POTATO);

    const bed = getPlantingBed(base);
    const heaters = bed
      ? getNeighbourCells(base, bed.id).filter(
        (cell) => isFacility(cell, FACILITY_TYPES.HEATER)
      ).length
      : 0;
    // 单 SOL 的养护评分：水占七成、加热覆盖占三成。
    const solQuality = share * 0.7
      + Math.min(1, heaters / 2) * 0.3 * (base.facilitiesIdle ? 0 : 1);
    // 关键：水决定「长多大」，不决定「长多久」。生长进度按固定节奏
    // 走完，缺水只压低养护质量（也就是最终体积）。否则断水会让
    // 成熟遥遥无期，玩家对着一棵永远长不完的土豆干等 —— 那是惩罚
    // 时间而不是惩罚决策。
    const growth = potato.growth + getPotatoGrowthRate(next, base);
    const solsGrown = potato.solsGrown + 1;

    potato = {
      ...potato,
      growth: Math.min(100, growth),
      solsGrown,
      // 质量是全生长期的滑动平均，一两个 SOL 断水不至于毁掉整棵。
      quality: (potato.quality * potato.solsGrown + solQuality) / solsGrown,
      status: growth >= 100 ? POTATO_STATUS.READY : POTATO_STATUS.GROWING,
    };
  }

  const crewDraw = Math.min(waterBudget, BASE_CREW_COUNT * WATER_PER_CREW);
  waterBudget -= crewDraw;

  base.potato = potato;
  base.stores = { ...base.stores, water: waterBudget, energy };
  next = patchBase(next, baseId, base);

  if (facilitiesIdle && !wasIdle) {
    next = withLog(next, '能量不足，全部设施停转。');
  }

  // 寒潮：加热桩答得了，遮蔽棚答不了。
  if (next.sol >= base.hazards.coldSnap.arriveSol) {
    base = { ...next.bases[baseId] };
    base.hazards = {
      ...base.hazards,
      coldSnapUntilSol: next.sol + COLD_SNAP_DURATION,
      coldSnap: scheduleColdSnap(next.sol, base.hazards.coldSnap.index + 1),
    };
    next = patchBase(next, baseId, base);
    next = withLog(
      next,
      `寒潮来袭：未被加热桩覆盖的地块生长骤降，持续 ${COLD_SNAP_DURATION} SOL。`
    );
  }

  // 沙尘暴：预告与到达。
  base = next.bases[baseId];

  if (next.sol === base.hazards.storm.announceSol) {
    const severity = getStormSeverity(base.hazards.storm.index);
    next = withLog(
      next,
      `沙尘暴预告：${STORM_WARNING_SOLS} SOL 后抵达，波及${
        severity.zones.map((zone) => getZoneSpec(zone).label).join('、')
      }${severity.damagesFacilities ? '，并会损坏设施' : ''}。`
    );
  }

  if (next.sol >= base.hazards.storm.arriveSol) {
    const resolved = applyStormArrival(next, base);
    next = patchBase(next, baseId, {
      cells: resolved.cells,
      hazards: resolved.hazards,
    });
    next = withLog(next, `沙尘暴过境：${resolved.summary}。`);
  }

  // 失败条件三：绝产。没有在长的作物、没有种薯，且手上的块茎也
  // 换不出能种满一格的种薯 —— 基地不会再产出任何东西。这是死局，
  // 必须立刻结算，而不是让玩家对着一个不再变化的画面等到合约超期。
  //
  // 注意判定的是「有没有下一株」，不是「块茎够不够多」：囤着一堆
  // 块茎却一格没种，同样是死局。
  const stalled = next.bases[baseId];
  const canSowAgain = stalled.stores.seedStock >= 1
    || stalled.stores.tubers >= TUBERS_PER_SEED;

  if (!stalled.potato && !canSowAgain) {
    return {
      ...withLog(next, '最后一颗种薯用尽，且没有可收获的作物。基地绝产。'),
      outcome: COLONY_OUTCOMES.LOST,
      lossReason: LOSS_REASONS.SEED,
    };
  }

  // 失败条件一：断电过久。
  if (next.bases[baseId].blackoutSols >= BLACKOUT_LOSS_SOLS) {
    return {
      ...withLog(next, `连续 ${BLACKOUT_LOSS_SOLS} SOL 断电，基地停摆。`),
      outcome: COLONY_OUTCOMES.LOST,
      lossReason: LOSS_REASONS.BLACKOUT,
    };
  }

  // 失败条件二：合约违约。
  const expired = next.contracts.find(
    (contract) => contract.status === 'open' && next.sol > contract.deadlineSol
  );

  if (expired) {
    return {
      ...withLog(next, `合约「${expired.label}」违约，基地失败。`),
      contracts: next.contracts.map((contract) => (
        contract.id === expired.id
          ? { ...contract, status: 'failed' }
          : contract
      )),
      outcome: COLONY_OUTCOMES.LOST,
      lossReason: LOSS_REASONS.CONTRACT,
    };
  }

  return next;
};

// ─── 操作 ─────────────────────────────────────────────────────
//
// 每个操作在守卫不通过时返回**同一个引用**，调用方可以用引用相等
// 判断「这次点击有没有生效」。canApplyTool 与这些守卫必须一致。

const updateBase = (colony, patch, logText) => {
  const next = patchBase(colony, colony.activeBaseId, patch);
  return logText ? withLog(next, logText) : next;
};

export const clearCell = (colony, cellId) => {
  const base = getActiveBase(colony);
  const cell = getCell(base, cellId);

  if (
    !cell || colony.outcome || cell.cleared || base.stores.energy < CLEAR_COST
  ) {
    return colony;
  }

  const cleared = patchCell(base, cellId, { cleared: true });

  return updateBase(
    colony,
    {
      cells: cleared.cells,
      stores: { ...base.stores, energy: base.stores.energy - CLEAR_COST },
    },
    `${getZoneSpec(cell.zone).label}新开垦一块地。`
  );
};

// 种下唯一那棵超级土豆。只有种植床能种。
export const plantCell = (colony, cellId) => {
  const base = getActiveBase(colony);
  const cell = getCell(base, cellId);

  if (
    !cell
    || colony.outcome
    || !cell.isPlantingBed
    || !cell.cleared
    || base.potato
    || base.stores.seedStock < 1
  ) {
    return colony;
  }

  return updateBase(
    colony,
    {
      potato: {
        status: POTATO_STATUS.GROWING,
        growth: 0,
        solsGrown: 0,
        quality: 0,
        plantedSol: colony.sol,
      },
      stores: { ...base.stores, seedStock: base.stores.seedStock - 1 },
    },
    '种植床播下一颗种薯。这个坑只养得起这一棵。'
  );
};

export const harvestCell = (colony, cellId) => {
  const base = getActiveBase(colony);
  const cell = getCell(base, cellId);

  if (
    !cell
    || colony.outcome
    || !cell.isPlantingBed
    || base.potato?.status !== POTATO_STATUS.READY
  ) {
    return colony;
  }

  const yieldCount = getPotatoYield(base);
  const grade = base.potato.quality >= 0.75
    ? '饱满'
    : base.potato.quality >= 0.45 ? '匀称' : '干瘪';

  return updateBase(
    colony,
    {
      potato: null,
      stores: { ...base.stores, tubers: base.stores.tubers + yieldCount },
    },
    `收获一棵${grade}的超级土豆，得 ${yieldCount} 颗块茎。`
  );
};

export const buildFacility = (colony, cellId, type) => {
  const base = getActiveBase(colony);
  const cell = getCell(base, cellId);
  const spec = FACILITY_SPECS[type];

  if (
    !cell
    || !spec
    || colony.outcome
    // 种植床是唯一能长土豆的地方，不能被设施占掉。
    || cell.isPlantingBed
    || !cell.cleared
    || cell.use
    || base.stores.energy < spec.cost
  ) {
    return colony;
  }

  const built = patchCell(base, cellId, {
    use: CELL_USES.FACILITY,
    facility: { type, integrity: 100 },
  });

  return updateBase(
    colony,
    {
      cells: built.cells,
      stores: { ...base.stores, energy: base.stores.energy - spec.cost },
    },
    `${getZoneSpec(cell.zone).label}建成${spec.label}。`
  );
};

export const demolishCell = (colony, cellId) => {
  const base = getActiveBase(colony);
  const cell = getCell(base, cellId);

  if (!cell || colony.outcome || !cell.facility) return colony;

  const spec = FACILITY_SPECS[cell.facility.type];
  // 拆除返还一半建造费，取整向下。
  const refund = Math.floor(spec.cost / 2);
  const razed = patchCell(base, cellId, { use: null, facility: null });

  return updateBase(
    colony,
    {
      cells: razed.cells,
      stores: {
        ...base.stores,
        energy: Math.min(getEnergyCap(base), base.stores.energy + refund),
      },
    },
    `拆除${spec.label}，回收 ${refund} 能量。`
  );
};

export const convertTubersToSeeds = (colony, seedCount = 1) => {
  const base = getActiveBase(colony);
  const cost = seedCount * TUBERS_PER_SEED;

  if (colony.outcome || seedCount < 1 || base.stores.tubers < cost) {
    return colony;
  }

  return updateBase(
    colony,
    {
      stores: {
        ...base.stores,
        tubers: base.stores.tubers - cost,
        seedStock: base.stores.seedStock + seedCount,
      },
    },
    `${cost} 颗块茎转化为 ${seedCount} 颗种薯。`
  );
};

export const deliverContract = (colony, contractId) => {
  const base = getActiveBase(colony);
  const contract = colony.contracts.find((item) => item.id === contractId);

  if (
    !contract
    || colony.outcome
    || contract.status !== 'open'
    || base.stores[contract.resource] < contract.amount
  ) {
    return colony;
  }

  let next = patchBase(colony, colony.activeBaseId, {
    stores: {
      ...base.stores,
      [contract.resource]: base.stores[contract.resource] - contract.amount,
      energy: Math.min(
        getEnergyCap(base),
        base.stores.energy + contract.energyReward
      ),
    },
  });

  next = {
    ...next,
    contracts: next.contracts.map((item) => (
      item.id === contractId ? { ...item, status: 'done' } : item
    )),
  };
  next = withLog(next, `合约「${contract.label}」交付完成。${contract.rewardText}`);

  return next.contracts.every((item) => item.status === 'done')
    ? { ...withLog(next, '全部合约完成，基地站稳了。'), outcome: COLONY_OUTCOMES.WON }
    : next;
};

// 工具对某格当前是否可用。3D 场景高亮与 HUD 提示共用这一份判定，
// 与上面各操作的守卫严格一致 —— 高亮了却点不动是最糟的经营手感。
export const canApplyTool = (colony, cellId, tool) => {
  if (!colony || colony.outcome) return false;

  const base = getActiveBase(colony);
  const cell = getCell(base, cellId);

  if (!cell) return false;

  if (tool === TOOL_MODES.CLEAR) {
    return !cell.cleared && base.stores.energy >= CLEAR_COST;
  }

  if (!cell.cleared) return false;

  switch (tool) {
    case TOOL_MODES.PLANT:
      return cell.isPlantingBed
        && !base.potato
        && base.stores.seedStock >= 1;
    case TOOL_MODES.HARVEST:
      return cell.isPlantingBed
        && base.potato?.status === POTATO_STATUS.READY;
    case TOOL_MODES.DEMOLISH:
      return Boolean(cell.facility);
    default: {
      const facilityType = TOOL_FACILITY[tool];
      if (!facilityType) return false;

      // 种植床不能被设施占掉。
      return !cell.isPlantingBed
        && !cell.use
        && base.stores.energy >= FACILITY_SPECS[facilityType].cost;
    }
  }
};

// 决策点探测。自动暂停与「跳到下一节点」共用这一份判定 ——
// 节奏因此由玩家的决策密度决定，而不是由时钟强制的等待决定。
// urgency 3：不处理就会亏损或失败，自动暂停。
// urgency 2：值得停下来看一眼，跳转会停在这里。
// urgency 1：提示性质，不打断。
export const getDecisionPoints = (colony) => {
  if (!colony || colony.outcome) return [];

  const base = getActiveBase(colony);
  const points = [];
  const water = base.stores.water;
  const waterNet = (base.facilitiesIdle ? BASE_WATER_RECLAIM : getWaterIncome(base))
    - getWaterDrain(base);

  if (waterNet < -0.05 && water / -waterNet <= 3) {
    points.push({ kind: 'water-critical', urgency: 3 });
  }
  if (base.facilitiesIdle) {
    points.push({ kind: 'blackout', urgency: 3 });
  }
  if (
    colony.sol === base.hazards.storm.announceSol
    || (colony.sol > base.hazards.storm.announceSol
      && colony.sol < base.hazards.storm.arriveSol
      && colony.sol === base.hazards.storm.arriveSol - 1)
  ) {
    points.push({ kind: 'storm-warning', urgency: 3 });
  }
  // 绝产前兆：种植床空着，且种薯也见底。
  if (!base.potato && base.stores.seedStock < 1) {
    points.push({ kind: 'production-stalled', urgency: 3 });
  }
  // 养护告急：土豆在长但水跟不上，体积会缩水 —— 这是产量在流失，
  // 不是「以后再说」的事。
  if (
    hasGrowingPotato(base)
    && base.stores.water < WATER_PER_POTATO * 2
    && waterNet < 0
  ) {
    points.push({ kind: 'potato-thirsty', urgency: 3 });
  }

  if (base.potato?.status === POTATO_STATUS.READY) {
    points.push({ kind: 'harvest-ready', urgency: 2 });
  }
  if (colony.contracts.some(
    (contract) => contract.status === 'open'
      && base.stores[contract.resource] >= contract.amount
  )) {
    points.push({ kind: 'contract-deliverable', urgency: 2 });
  }
  if (colony.contracts.some(
    (contract) => contract.status === 'open'
      && contract.deadlineSol - colony.sol === 5
  )) {
    points.push({ kind: 'deadline-near', urgency: 2 });
  }
  if (!base.potato) {
    points.push({ kind: 'empty-bed', urgency: 1 });
  }

  return points;
};

// HUD 告警。
export const getColonyAlerts = (colony) => {
  if (!colony) return [];

  const base = getActiveBase(colony);
  const alerts = [];

  if (hasGrowingPotato(base) && base.stores.water < WATER_PER_POTATO * 3) {
    alerts.push({ kind: 'water', text: '水量告急，土豆将缩水' });
  }
  if (base.facilitiesIdle) {
    alerts.push({
      kind: 'energy',
      text: `设施停转 ${base.blackoutSols}/${BLACKOUT_LOSS_SOLS} SOL`,
    });
  }
  if (base.potato?.status === POTATO_STATUS.READY) {
    alerts.push({ kind: 'harvest', text: '超级土豆可收获' });
  }
  // 种植床空着是可恢复的（有块茎就能转种薯），但玩家很容易没察觉
  // 自己已经停产。不结算失败，只报警。
  if (!base.potato) {
    alerts.push({
      kind: 'idle',
      text: base.stores.seedStock >= 1 ? '种植床空着' : '停产：需先留种',
    });
  }
  if (colony.sol < base.hazards.coldSnapUntilSol) {
    alerts.push({ kind: 'cold', text: '寒潮持续中' });
  }
  if (
    colony.sol >= base.hazards.storm.announceSol
    && colony.sol < base.hazards.storm.arriveSol
  ) {
    alerts.push({
      kind: 'storm',
      text: `沙尘暴 ${base.hazards.storm.arriveSol - colony.sol} SOL 后抵达`,
    });
  }

  return alerts;
};
