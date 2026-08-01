// 殖民地经营规则层。所有生产、施工、损伤与培育计算保持纯函数，
// React 和 Three.js 只负责把这里的状态显示出来。

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
  FACILITY_STATUS,
  FACILITY_TYPES,
  FARM_ZONES,
  getActiveBase,
  getCell,
  getZoneSpec,
  LOSS_REASONS,
  patchBase,
  patchCell,
  PLANTING_BED_ID,
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

const getNeighbourCells = (base, cellId) => getNeighbourIds(cellId)
  .map((id) => getCell(base, id))
  .filter(Boolean);

const isCorePort = (cell) => Boolean(cell?.corePort);

const getCorePortCells = (base) => base.cells.filter(isCorePort);

export const getFacilityStatus = (facility, facilitiesIdle = false) => {
  if (!facility) return null;
  if (facility.buildRemaining > 0) return FACILITY_STATUS.BUILDING;
  if (facilitiesIdle || facility.integrity <= 20) return FACILITY_STATUS.STOPPED;
  if (facility.integrity < 65) return FACILITY_STATUS.DEGRADED;
  return FACILITY_STATUS.RUNNING;
};

export const getFacilityEfficiency = (facility) => {
  if (!facility || facility.buildRemaining > 0 || facility.integrity <= 20) {
    return 0;
  }
  return clamp(facility.integrity / 100, 0.25, 1);
};

export const isFacilityOperational = (base, cell, type = null) => Boolean(
  cell?.facility
  && (!type || cell.facility.type === type)
  && !base.facilitiesIdle
  && getFacilityEfficiency(cell.facility) > 0
);

const countBuiltFacilities = (base, type) => base.cells.filter(
  (cell) => isFacility(cell, type) && getFacilityEfficiency(cell.facility) > 0
);

const getRawSolarIncome = (base) => {
  const spec = FACILITY_SPECS[FACILITY_TYPES.SOLAR];

  return base.cells.reduce((total, cell) => {
    if (!isFacility(cell, FACILITY_TYPES.SOLAR)) return total;

    const efficiency = getFacilityEfficiency(cell.facility);
    if (efficiency === 0) return total;

    const zoneFactor = cell.zone === FARM_ZONES.RIM
      ? 1.3
      : cell.zone === FARM_ZONES.FLOOR ? 0.75 : 1;
    const crowding = getNeighbourCells(base, cell.id).filter(
      (neighbour) => isFacility(neighbour, FACILITY_TYPES.SOLAR)
    ).length;

    return total
      + spec.energyPerSol
        * zoneFactor
        * Math.max(0.4, 1 - crowding * 0.12)
        * efficiency;
  }, 0);
};

const getRawWaterIncome = (base) => {
  const spec = FACILITY_SPECS[FACILITY_TYPES.EXTRACTOR];
  return countBuiltFacilities(base, FACILITY_TYPES.EXTRACTOR).reduce(
    (total, cell) => total
      + spec.waterPerSol * getFacilityEfficiency(cell.facility),
    BASE_WATER_RECLAIM
  );
};

const getRawMineralIncome = (base) => {
  const spec = FACILITY_SPECS[FACILITY_TYPES.SIFTER];
  return countBuiltFacilities(base, FACILITY_TYPES.SIFTER).reduce(
    (total, cell) => total
      + spec.mineralPerSol * getFacilityEfficiency(cell.facility),
    0
  );
};

const getNutrientEfficiency = (base, cell) => {
  const spec = FACILITY_SPECS[FACILITY_TYPES.NUTRIENT];
  const suppliers = getNeighbourCells(base, cell.id).filter(
    (neighbour) => (
      isFacility(neighbour, FACILITY_TYPES.EXTRACTOR)
      || isFacility(neighbour, FACILITY_TYPES.SIFTER)
    )
  ).length;

  return getFacilityEfficiency(cell.facility)
    * Math.min(1, spec.remoteEfficiency + suppliers * spec.supplierAdjacencyBonus);
};

const getCoreFacilityPower = (base, type, perSol) => (
  getCorePortCells(base).reduce((total, cell) => {
    if (!isFacilityOperational(base, cell, type)) return total;
    return total + perSol * getFacilityEfficiency(cell.facility);
  }, 0)
);

export const isShielded = (base, cellId) => {
  const cell = getCell(base, cellId);
  if (!cell) return false;

  if (cell.isPlantingBed) {
    return getCoreFacilityPower(
      base,
      FACILITY_TYPES.SHIELD,
      FACILITY_SPECS[FACILITY_TYPES.SHIELD].stabilityPerSol
    ) > 0;
  }

  return [cell, ...getNeighbourCells(base, cellId)].some(
    (candidate) => isFacilityOperational(
      base,
      candidate,
      FACILITY_TYPES.SHIELD
    )
  );
};

export const isHeated = (base, cellId) => {
  const cell = getCell(base, cellId);
  if (!cell) return false;

  if (cell.isPlantingBed) {
    return getCoreFacilityPower(
      base,
      FACILITY_TYPES.HEATER,
      FACILITY_SPECS[FACILITY_TYPES.HEATER].thermalPerSol
    ) > 0;
  }

  return [cell, ...getNeighbourCells(base, cellId)].some(
    (candidate) => isFacilityOperational(
      base,
      candidate,
      FACILITY_TYPES.HEATER
    )
  );
};

export const getWaterCap = (base) => base.caps.water;

export const getEnergyCap = (base) => (
  base.caps.energy
  + countBuiltFacilities(base, FACILITY_TYPES.BATTERY).reduce(
    (total, cell) => total
      + FACILITY_SPECS[FACILITY_TYPES.BATTERY].energyCapBonus
        * getFacilityEfficiency(cell.facility),
    0
  )
);

export const getFacilityUpkeep = (base) => base.cells.reduce(
  (total, cell) => {
    const efficiency = getFacilityEfficiency(cell.facility);
    if (efficiency === 0) return total;
    return total + FACILITY_SPECS[cell.facility.type].upkeep;
  },
  0
);

export const getWaterIncome = (base) => (
  base.facilitiesIdle ? BASE_WATER_RECLAIM : getRawWaterIncome(base)
);

export const getMineralIncome = (base) => (
  base.facilitiesIdle ? 0 : getRawMineralIncome(base)
);

export const getSolarIncome = (base) => (
  base.facilitiesIdle ? 0 : getRawSolarIncome(base)
);

export const getEnergyIncome = (base) => (
  REACTOR_ENERGY_PER_SOL + getSolarIncome(base)
);

export const getPlantingBed = (base) => getCell(base, PLANTING_BED_ID);

export const hasGrowingPotato = (base) => Boolean(
  base.potato && base.potato.status === POTATO_STATUS.GROWING
);

export const getWaterDrain = (base) => (
  BASE_CREW_COUNT * WATER_PER_CREW
  + (base.potato ? WATER_PER_POTATO : 0)
);

export const getPotatoGrowthRate = (colony, base) => {
  const heaterSpec = FACILITY_SPECS[FACILITY_TYPES.HEATER];
  const heat = getCoreFacilityPower(
    base,
    FACILITY_TYPES.HEATER,
    heaterSpec.thermalPerSol
  );
  const thermal = clamp(0.25 + heat, 0, 1);
  const chilled = colony.sol < base.hazards.coldSnapUntilSol && heat === 0;

  return (100 / POTATO_MATURITY_SOLS)
    * base.growthFactor
    * (0.72 + thermal * 0.38)
    * (chilled ? COLD_SNAP_GROWTH_MULTIPLIER : 1);
};

export const getPotatoYield = (base) => {
  if (!base.potato) return 0;
  const quality = clamp(base.potato.quality, 0, 1);
  return Math.round(
    POTATO_BASE_YIELD + (POTATO_MAX_YIELD - POTATO_BASE_YIELD) * quality
  );
};

const getNutrientCapacity = (base) => (
  base.cells.reduce((total, cell) => {
    if (!isFacilityOperational(base, cell, FACILITY_TYPES.NUTRIENT)) {
      return total;
    }
    return total
      + FACILITY_SPECS[FACILITY_TYPES.NUTRIENT].nutrientPerSol
        * getNutrientEfficiency(base, cell);
  }, 0)
);

const getRootCapacity = (base, resource) => {
  const spec = FACILITY_SPECS[FACILITY_TYPES.ROOT_FEEDER];
  const key = resource === 'water' ? 'waterPerSol' : 'nutrientPerSol';

  return getCorePortCells(base).reduce((total, cell) => {
    if (!isFacilityOperational(base, cell, FACILITY_TYPES.ROOT_FEEDER)) {
      return total;
    }
    return total + spec[key] * getFacilityEfficiency(cell.facility);
  }, 0);
};

export const getFactoryForecast = (base) => {
  const nutrientSpec = FACILITY_SPECS[FACILITY_TYPES.NUTRIENT];
  const nutrientCapacity = getNutrientCapacity(base);
  const nutrientRatio = nutrientSpec.nutrientPerSol > 0
    ? nutrientCapacity / nutrientSpec.nutrientPerSol
    : 0;
  const rootWater = base.potato ? getRootCapacity(base, 'water') : 0;
  const rootNutrients = base.potato ? getRootCapacity(base, 'nutrients') : 0;
  const waterIncome = getWaterIncome(base);
  const mineralIncome = getMineralIncome(base);

  return {
    energy: {
      income: getEnergyIncome(base),
      drain: getFacilityUpkeep(base),
    },
    water: {
      income: waterIncome,
      drain: BASE_CREW_COUNT * WATER_PER_CREW
        + nutrientSpec.waterInput * nutrientRatio
        + rootWater,
    },
    minerals: {
      income: mineralIncome,
      drain: nutrientSpec.mineralInput * nutrientRatio,
    },
    nutrients: {
      income: nutrientCapacity,
      drain: rootNutrients,
    },
    delivery: {
      water: rootWater,
      nutrients: rootNutrients,
    },
  };
};

export const getFactoryBottleneck = (base) => {
  const built = (type) => countBuiltFacilities(base, type).length > 0;
  const forecast = getFactoryForecast(base);

  if (!built(FACILITY_TYPES.EXTRACTOR)) {
    return { kind: 'water', text: '先在坑壁阴影建造采冰器' };
  }
  if (!built(FACILITY_TYPES.SIFTER)) {
    return { kind: 'minerals', text: '补一台矿物筛分机' };
  }
  if (!built(FACILITY_TYPES.NUTRIENT)) {
    return { kind: 'nutrients', text: '建造营养合成器接上采集端' };
  }
  if (!built(FACILITY_TYPES.ROOT_FEEDER)) {
    const hasOpenCorePort = getCorePortCells(base)
      .some((cell) => cell.cleared && !cell.use);
    if (!hasOpenCorePort) {
      return { kind: 'delivery', text: '培育主管线接口已被占满，拆除一个接口设施' };
    }
    return { kind: 'delivery', text: '在坑外发亮的培育接口建造根区灌注器' };
  }
  if (!base.potato) {
    return { kind: 'planting', text: '在中央培育核心播下一颗种薯' };
  }
  if (base.facilitiesIdle || forecast.energy.income < forecast.energy.drain) {
    return { kind: 'energy', text: '供电不足，扩建光伏阵或拆除冗余设施' };
  }
  if (forecast.water.income < forecast.water.drain) {
    return { kind: 'water', text: '水流量不足，增加采冰器' };
  }
  if (forecast.minerals.income < forecast.minerals.drain) {
    return { kind: 'minerals', text: '矿物流量不足，增加筛分机' };
  }
  if (!built(FACILITY_TYPES.HEATER)) {
    return { kind: 'thermal', text: '根区缺少热调节，成熟速度偏慢' };
  }
  if (!built(FACILITY_TYPES.SHIELD)) {
    return { kind: 'stability', text: '中央核心尚无辐射遮蔽' };
  }
  return { kind: 'stable', text: '生产链完整，观察库存净流量' };
};

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
  let potato = base.potato;
  let potatoNote = null;

  if (
    potato
    && severity.zones.includes(FARM_ZONES.FLOOR)
    && !isShielded(base, PLANTING_BED_ID)
  ) {
    const shelter = base.environment.shelter ?? 30;
    const bite = clamp(0.3 - (shelter / 100) * 0.18, 0.1, 0.3);
    potato = {
      ...potato,
      quality: Math.max(0, potato.quality - bite),
      stability: Math.max(0, (potato.stability ?? 0.3) - bite),
    };
    potatoNote = '中央土豆被沙尘打伤';
  }

  const cells = base.cells.map((cell) => {
    if (!cell.facility || isShielded(base, cell.id)) return cell;
    if (!severity.zones.includes(cell.zone) || !severity.damagesFacilities) {
      return cell;
    }

    facilitiesHit += 1;
    const integrity = Math.max(0, cell.facility.integrity - 20);
    return {
      ...cell,
      facility: {
        ...cell.facility,
        integrity,
        status: getFacilityStatus(
          { ...cell.facility, integrity },
          base.facilitiesIdle
        ),
      },
    };
  });

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
    summary: [
      potatoNote,
      facilitiesHit > 0 ? `${facilitiesHit} 座设施受损` : null,
    ].filter(Boolean).join('，') || '基地未受损失',
  };
};

const advanceConstruction = (base, sol) => {
  const completed = [];
  const cells = base.cells.map((cell) => {
    if (!cell.facility || cell.facility.buildRemaining <= 0) return cell;

    const buildRemaining = Math.max(0, cell.facility.buildRemaining - 1);
    if (buildRemaining === 0) {
      completed.push(FACILITY_SPECS[cell.facility.type].label);
    }

    return {
      ...cell,
      facility: {
        ...cell.facility,
        buildRemaining,
        completedSol: buildRemaining === 0 ? sol : cell.facility.completedSol,
        status: buildRemaining > 0
          ? FACILITY_STATUS.BUILDING
          : FACILITY_STATUS.RUNNING,
      },
    };
  });

  return { cells, completed };
};

const processNutrients = (base, water, minerals, nutrients) => {
  const spec = FACILITY_SPECS[FACILITY_TYPES.NUTRIENT];
  let nextWater = water;
  let nextMinerals = minerals;
  let nextNutrients = nutrients;

  base.cells.forEach((cell) => {
    if (!isFacilityOperational(base, cell, FACILITY_TYPES.NUTRIENT)) return;

    const efficiency = getNutrientEfficiency(base, cell);
    const desiredWater = spec.waterInput * efficiency;
    const desiredMinerals = spec.mineralInput * efficiency;
    const inputShare = Math.min(
      1,
      desiredWater > 0 ? nextWater / desiredWater : 1,
      desiredMinerals > 0 ? nextMinerals / desiredMinerals : 1
    );
    const output = spec.nutrientPerSol * efficiency * inputShare;

    nextWater -= desiredWater * inputShare;
    nextMinerals -= desiredMinerals * inputShare;
    nextNutrients = Math.min(base.caps.nutrients, nextNutrients + output);
  });

  return {
    water: nextWater,
    minerals: nextMinerals,
    nutrients: nextNutrients,
  };
};

const feedPotato = (base, water, nutrients) => {
  if (!hasGrowingPotato(base)) {
    return {
      water,
      nutrients,
      hydration: 0,
      nutrition: 0,
      thermal: 0,
      stability: 0,
    };
  }

  const waterCapacity = getRootCapacity(base, 'water');
  const nutrientCapacity = getRootCapacity(base, 'nutrients');
  const waterTarget = Math.min(WATER_PER_POTATO, waterCapacity);
  const nutrientTarget = Math.min(2, nutrientCapacity);
  const waterDelivered = Math.min(water, waterTarget);
  const nutrientDelivered = Math.min(nutrients, nutrientTarget);
  const heat = getCoreFacilityPower(
    base,
    FACILITY_TYPES.HEATER,
    FACILITY_SPECS[FACILITY_TYPES.HEATER].thermalPerSol
  );
  const shield = getCoreFacilityPower(
    base,
    FACILITY_TYPES.SHIELD,
    FACILITY_SPECS[FACILITY_TYPES.SHIELD].stabilityPerSol
  );

  return {
    water: water - waterDelivered,
    nutrients: nutrients - nutrientDelivered,
    // 没有完整工厂仍有低效人工维生，不会形成不可恢复死锁。
    hydration: waterCapacity > 0
      ? clamp(waterDelivered / WATER_PER_POTATO, 0, 1)
      : 0.12,
    nutrition: nutrientCapacity > 0
      ? clamp(nutrientDelivered / 2, 0, 1)
      : 0.05,
    thermal: clamp(0.25 + heat, 0, 1),
    stability: clamp(0.3 + shield, 0, 1),
  };
};

export const advanceColonySol = (colony) => {
  if (!colony || colony.outcome) return colony;

  const baseId = colony.activeBaseId;
  let next = { ...colony, sol: colony.sol + 1 };
  let base = { ...next.bases[baseId] };

  const construction = advanceConstruction(base, next.sol);
  base.cells = construction.cells;

  const energyCap = getEnergyCap(base);
  let energy = Math.min(
    energyCap,
    base.stores.energy + REACTOR_ENERGY_PER_SOL + getRawSolarIncome(base)
  );
  const upkeep = getFacilityUpkeep(base);
  const facilitiesIdle = upkeep > energy;
  energy = Math.max(0, energy - upkeep);

  const wasIdle = base.facilitiesIdle;
  base.facilitiesIdle = facilitiesIdle;
  base.blackoutSols = facilitiesIdle ? base.blackoutSols + 1 : 0;
  base.cells = base.cells.map((cell) => (
    cell.facility
      ? {
        ...cell,
        facility: {
          ...cell.facility,
          status: getFacilityStatus(cell.facility, facilitiesIdle),
        },
      }
      : cell
  ));

  let water = Math.min(
    base.caps.water,
    base.stores.water
      + (facilitiesIdle ? BASE_WATER_RECLAIM : getRawWaterIncome(base))
  );
  let minerals = Math.min(
    base.caps.minerals,
    base.stores.minerals
      + (facilitiesIdle ? 0 : getRawMineralIncome(base))
  );
  let nutrients = base.stores.nutrients;

  if (!facilitiesIdle) {
    const processed = processNutrients(base, water, minerals, nutrients);
    water = processed.water;
    minerals = processed.minerals;
    nutrients = processed.nutrients;
  }

  const crewDraw = Math.min(water, BASE_CREW_COUNT * WATER_PER_CREW);
  water -= crewDraw;

  const feeding = feedPotato(base, water, nutrients);
  water = feeding.water;
  nutrients = feeding.nutrients;

  let potato = base.potato;
  if (hasGrowingPotato(base)) {
    const solQuality = feeding.hydration * 0.35
      + feeding.nutrition * 0.35
      + feeding.thermal * 0.15
      + feeding.stability * 0.15;
    const growth = potato.growth + getPotatoGrowthRate(next, base);
    const solsGrown = potato.solsGrown + 1;
    const average = (key, value) => (
      ((potato[key] ?? 0) * potato.solsGrown + value) / solsGrown
    );

    potato = {
      ...potato,
      growth: Math.min(100, growth),
      solsGrown,
      hydration: average('hydration', feeding.hydration),
      nutrition: average('nutrition', feeding.nutrition),
      thermal: average('thermal', feeding.thermal),
      stability: average('stability', feeding.stability),
      quality: (potato.quality * potato.solsGrown + solQuality) / solsGrown,
      status: growth >= 100 ? POTATO_STATUS.READY : POTATO_STATUS.GROWING,
    };
  }

  base.potato = potato;
  base.stores = {
    ...base.stores,
    water,
    energy,
    minerals,
    nutrients,
  };
  next = patchBase(next, baseId, base);

  if (construction.completed.length > 0) {
    next = withLog(
      next,
      `${construction.completed.join('、')}施工完成，接入工厂网络。`
    );
  }
  if (facilitiesIdle && !wasIdle) {
    next = withLog(next, '供电低于全厂维持需求，生产链停转。');
  }

  if (next.sol >= base.hazards.coldSnap.arriveSol) {
    base = { ...next.bases[baseId] };
    base.hazards = {
      ...base.hazards,
      coldSnapUntilSol: next.sol + COLD_SNAP_DURATION,
      lastColdSnapSol: next.sol,
      coldSnap: scheduleColdSnap(next.sol, base.hazards.coldSnap.index + 1),
    };
    next = patchBase(next, baseId, base);
    next = withLog(
      next,
      `寒潮来袭：没有热调节的中央根区生长减慢，持续 ${COLD_SNAP_DURATION} SOL。`
    );
  }

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
      potato: resolved.potato,
      hazards: { ...resolved.hazards, lastStormSol: next.sol },
    });
    next = withLog(next, `沙尘暴过境：${resolved.summary}。`);
  }

  const stalled = next.bases[baseId];
  const canSowAgain = stalled.stores.seedStock >= 1
    || stalled.stores.tubers >= TUBERS_PER_SEED;
  if (!stalled.potato && !canSowAgain) {
    return {
      ...withLog(next, '最后一颗种薯用尽，基地绝产。'),
      outcome: COLONY_OUTCOMES.LOST,
      lossReason: LOSS_REASONS.SEED,
    };
  }

  if (stalled.blackoutSols >= BLACKOUT_LOSS_SOLS) {
    return {
      ...withLog(next, `连续 ${BLACKOUT_LOSS_SOLS} SOL 断电，基地停摆。`),
      outcome: COLONY_OUTCOMES.LOST,
      lossReason: LOSS_REASONS.BLACKOUT,
    };
  }

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
    `${getZoneSpec(cell.zone).label}新开垦一个工厂位。`
  );
};

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
        hydration: 0,
        nutrition: 0,
        thermal: 0,
        stability: 0,
        plantedSol: colony.sol,
      },
      stores: { ...base.stores, seedStock: base.stores.seedStock - 1 },
    },
    '中央培育核心播下一颗种薯。'
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

const canPlaceFacility = (base, cell, type) => {
  const spec = FACILITY_SPECS[type];
  if (!cell || !spec || cell.isPlantingBed || !cell.cleared || cell.use) {
    return false;
  }
  if (!spec.allowedZones.includes(cell.zone)) return false;
  // 培育类设施必须占用坑外主管线接口；其他设施不占接口，避免
  // 开局把根灌、热控、遮蔽的少数接入口误用掉。
  if (isCorePort(cell) && !spec.requiresCorePort) return false;
  if (spec.requiresCorePort && !isCorePort(cell)) return false;
  return true;
};

export const buildFacility = (colony, cellId, type) => {
  const base = getActiveBase(colony);
  const cell = getCell(base, cellId);
  const spec = FACILITY_SPECS[type];
  if (
    colony.outcome
    || !canPlaceFacility(base, cell, type)
    || base.stores.energy < spec.cost
  ) {
    return colony;
  }

  const built = patchCell(base, cellId, {
    use: CELL_USES.FACILITY,
    facility: {
      type,
      integrity: 100,
      buildRemaining: spec.buildSols,
      completedSol: null,
      status: FACILITY_STATUS.BUILDING,
    },
  });

  return updateBase(
    colony,
    {
      cells: built.cells,
      stores: { ...base.stores, energy: base.stores.energy - spec.cost },
    },
    `${spec.label}开始施工，预计 ${spec.buildSols} SOL 完成。`
  );
};

export const getRepairCost = (facility) => {
  if (!facility || facility.integrity >= 100 || facility.buildRemaining > 0) {
    return 0;
  }
  return Math.max(2, Math.ceil((100 - facility.integrity) / 20) * 2);
};

export const repairFacility = (colony, cellId) => {
  const base = getActiveBase(colony);
  const cell = getCell(base, cellId);
  const cost = getRepairCost(cell?.facility);
  if (!cell || colony.outcome || cost === 0 || base.stores.energy < cost) {
    return colony;
  }

  const repaired = patchCell(base, cellId, {
    facility: {
      ...cell.facility,
      integrity: 100,
      status: base.facilitiesIdle
        ? FACILITY_STATUS.STOPPED
        : FACILITY_STATUS.RUNNING,
    },
  });

  return updateBase(
    colony,
    {
      cells: repaired.cells,
      stores: { ...base.stores, energy: base.stores.energy - cost },
    },
    `${FACILITY_SPECS[cell.facility.type].label}维修完成，消耗 ${cost} 能量。`
  );
};

export const demolishCell = (colony, cellId) => {
  const base = getActiveBase(colony);
  const cell = getCell(base, cellId);
  if (!cell || colony.outcome || !cell.facility) return colony;

  const spec = FACILITY_SPECS[cell.facility.type];
  const refund = Math.floor(spec.cost * 0.4);
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
    case TOOL_MODES.REPAIR: {
      const cost = getRepairCost(cell.facility);
      return cost > 0 && base.stores.energy >= cost;
    }
    case TOOL_MODES.DEMOLISH:
      return Boolean(cell.facility);
    default: {
      const facilityType = TOOL_FACILITY[tool];
      return Boolean(
        facilityType
        && canPlaceFacility(base, cell, facilityType)
        && base.stores.energy >= FACILITY_SPECS[facilityType].cost
      );
    }
  }
};

export const getDecisionPoints = (colony) => {
  if (!colony || colony.outcome) return [];
  const base = getActiveBase(colony);
  const points = [];
  const forecast = getFactoryForecast(base);

  if (base.cells.some(
    (cell) => cell.facility?.completedSol === colony.sol
  )) {
    points.push({ kind: 'construction-complete', urgency: 2 });
  }
  if (base.hazards.lastStormSol === colony.sol) {
    points.push({ kind: 'storm-arrival', urgency: 3 });
  }
  if (base.hazards.lastColdSnapSol === colony.sol) {
    points.push({ kind: 'cold-snap-arrival', urgency: 2 });
  }
  colony.contracts
    .filter((contract) => contract.status === 'open')
    .forEach((contract) => {
      const remaining = contract.deadlineSol - colony.sol;
      if (remaining >= 0 && remaining <= 1) {
        points.push({
          kind: 'contract-deadline',
          urgency: 3,
          contractId: contract.id,
          remaining,
        });
      }
    });

  if (
    forecast.water.income < forecast.water.drain
    && base.stores.water / Math.max(0.01, forecast.water.drain - forecast.water.income) <= 3
  ) {
    points.push({ kind: 'water-critical', urgency: 3 });
  }
  if (base.facilitiesIdle) points.push({ kind: 'blackout', urgency: 3 });
  if (
    colony.sol === base.hazards.storm.announceSol
    || colony.sol === base.hazards.storm.arriveSol - 1
  ) {
    points.push({ kind: 'storm-warning', urgency: 3 });
  }
  if (!base.potato && base.stores.seedStock < 1) {
    points.push({ kind: 'production-stalled', urgency: 3 });
  }
  if (base.cells.some(
    (cell) => cell.facility && cell.facility.integrity <= 40
  )) {
    points.push({ kind: 'repair-needed', urgency: 2 });
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
  if (!base.potato) points.push({ kind: 'empty-bed', urgency: 1 });
  return points;
};

export const getColonyAlerts = (colony) => {
  if (!colony) return [];
  const base = getActiveBase(colony);
  const alerts = [];
  const bottleneck = getFactoryBottleneck(base);

  if (bottleneck.kind !== 'stable') {
    alerts.push({ kind: bottleneck.kind, text: bottleneck.text });
  }
  if (base.facilitiesIdle) {
    alerts.push({
      kind: 'energy',
      text: `设施停转 ${base.blackoutSols}/${BLACKOUT_LOSS_SOLS} SOL`,
    });
  }
  if (base.cells.some(
    (cell) => cell.facility && cell.facility.integrity < 65
  )) {
    alerts.push({ kind: 'repair', text: '工厂中有受损设施' });
  }
  if (base.potato?.status === POTATO_STATUS.READY) {
    alerts.push({ kind: 'harvest', text: '超级土豆可收获' });
  }
  if (!base.potato) {
    alerts.push({
      kind: 'idle',
      text: base.stores.seedStock >= 1 ? '中央培育核心空着' : '停产：需先留种',
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
