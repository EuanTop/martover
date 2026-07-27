import { describe, expect, it } from 'vitest';
import { getNeighbourIds } from './baseLayout';
import {
  advanceColonySol,
  buildFacility,
  canApplyTool,
  clearCell,
  convertTubersToSeeds,
  deliverContract,
  demolishCell,
  getColonyAlerts,
  getEnergyCap,
  getFactoryBottleneck,
  getFactoryForecast,
  getPotatoYield,
  getRepairCost,
  getStormSeverity,
  getWaterDrain,
  getWaterIncome,
  harvestCell,
  isShielded,
  plantCell,
  repairFacility,
} from './colonyEconomy';
import {
  BASE_WATER_RECLAIM,
  BLACKOUT_LOSS_SOLS,
  CLEAR_COST,
  COLONY_OUTCOMES,
  createColonyState,
  FACILITY_TYPES,
  getActiveBase,
  LOSS_REASONS,
  PLANTING_BED_ID,
  POTATO_BASE_YIELD,
  POTATO_MAX_YIELD,
  POTATO_STATUS,
  TOOL_MODES,
  TUBERS_PER_SEED,
} from './colonyState';

const crater = {
  id: '01-000001',
  latitude: -61,
  longitude: 42,
  diameter: 20,
  layerNumber: 3,
  rimDegradation: 3,
  ejectaDegradation: 3,
  floorDegradation: 2,
  hasRd: true,
};

const base = (colony) => getActiveBase(colony);
const cellOf = (colony, id) => base(colony).cells.find((c) => c.id === id);
const advance = (colony, sols) => {
  let next = colony;
  for (let i = 0; i < sols; i += 1) next = advanceColonySol(next);
  return next;
};

// 给库存开口子，用来隔离测试单一机制。
const withStores = (colony, stores) => ({
  ...colony,
  bases: {
    ...colony.bases,
    'base-01': {
      ...colony.bases['base-01'],
      stores: { ...colony.bases['base-01'].stores, ...stores },
    },
  },
});

const clearAll = (colony) => ({
  ...colony,
  bases: {
    ...colony.bases,
    'base-01': {
      ...colony.bases['base-01'],
      cells: colony.bases['base-01'].cells.map((c) => ({ ...c, cleared: true })),
    },
  },
});

describe('colonyEconomy', () => {
  it('is deterministic for the same crater and action sequence', () => {
    const run = () => {
      let colony = createColonyState(crater);
      colony = plantCell(colony, 'floor-0-0');
      colony = plantCell(colony, 'floor-0-1');
      return advance(colony, 20);
    };

    expect(run()).toEqual(run());
  });

  it('starts with 26 cells and no permanently locked content', () => {
    // 旧实现锁死 4/6 地块且只有一条解锁路径，三分之一内容永远进不去。
    const colony = createColonyState(crater);

    expect(base(colony).cells).toHaveLength(26);
    expect(base(colony).cells.every((cell) => 'cleared' in cell)).toBe(true);
    // 未开垦的格子随时可以花能量开垦，不是死内容。
    const unclearedId = base(colony).cells.find((c) => !c.cleared).id;
    expect(canApplyTool(colony, unclearedId, TOOL_MODES.CLEAR)).toBe(true);
  });

  it('never lets energy exceed the cap, and batteries raise it', () => {
    // 旧实现反应堆 +2/SOL 无上限，能量无限累积。
    let colony = createColonyState(crater);
    const capBefore = getEnergyCap(base(colony));

    colony = advance(colony, 20);
    expect(base(colony).stores.energy).toBeLessThanOrEqual(capBefore);

    colony = withStores(clearAll(colony), { energy: 40 });
    colony = buildFacility(colony, 'rim-4-0', FACILITY_TYPES.BATTERY);
    colony = advance(colony, 2);

    expect(cellOf(colony, 'rim-4-0').facility.type)
      .toBe(FACILITY_TYPES.BATTERY);
    expect(getEnergyCap(base(colony))).toBeGreaterThan(capBefore);
  });

  it('draws far more water for the super potato than the crew alone', () => {
    // 超级土豆是基地唯一的水槽大头：一台采冰器撑不住它 + 队伍。
    let colony = withStores(clearAll(createColonyState(crater)), {
      energy: 40, seedStock: 4,
    });
    colony = buildFacility(colony, 'shadow-2-1', FACILITY_TYPES.EXTRACTOR);
    const idleDrain = getWaterDrain(base(colony));
    colony = plantCell(colony, PLANTING_BED_ID);

    expect(getWaterDrain(base(colony))).toBeGreaterThan(idleDrain);
    expect(getWaterDrain(base(colony)))
      .toBeGreaterThan(getWaterIncome(base(colony)));
  });

  it('only runs an extractor after construction completes in a shadow slot', () => {
    let colony = withStores(clearAll(createColonyState(crater)), { energy: 40 });

    expect(buildFacility(colony, 'floor-1-0', FACILITY_TYPES.EXTRACTOR))
      .toBe(colony);

    colony = buildFacility(colony, 'shadow-2-1', FACILITY_TYPES.EXTRACTOR);
    expect(getWaterIncome(base(colony))).toBe(BASE_WATER_RECLAIM);

    colony = advance(colony, 2);
    expect(getWaterIncome(base(colony))).toBeGreaterThan(BASE_WATER_RECLAIM);
  });

  it('reserves core neighbours for cultivation facilities', () => {
    let colony = withStores(clearAll(createColonyState(crater)), { energy: 40 });

    expect(buildFacility(colony, 'floor-1-0', FACILITY_TYPES.NUTRIENT))
      .toBe(colony);
    colony = buildFacility(
      colony,
      'floor-1-0',
      FACILITY_TYPES.ROOT_FEEDER
    );
    expect(cellOf(colony, 'floor-1-0').facility.type)
      .toBe(FACILITY_TYPES.ROOT_FEEDER);
  });

  it('grows without a factory, but root delivery makes the potato larger', () => {
    let watered = withStores(clearAll(createColonyState(crater)), {
      energy: 40,
      water: 60,
      nutrients: 30,
    });
    watered = buildFacility(
      watered,
      'floor-1-0',
      FACILITY_TYPES.ROOT_FEEDER
    );
    watered = advance(watered, 2);
    watered = withStores(watered, { water: 60, nutrients: 30 });
    watered = plantCell(watered, PLANTING_BED_ID);
    watered = advance(watered, 24);

    expect(base(watered).potato.status).toBe(POTATO_STATUS.READY);

    // 不完整工厂仍能低效维生，但不会得到同样的体积。
    let dry = withStores(createColonyState(crater), { water: 0 });
    dry = plantCell(dry, PLANTING_BED_ID);
    dry = advance(dry, 24);

    expect(base(dry).potato.quality)
      .toBeLessThan(base(watered).potato.quality);
    expect(getPotatoYield(base(dry)))
      .toBeLessThan(getPotatoYield(base(watered)));
  });

  it('makes yield a function of care quality, not a hidden roll', () => {
    // 「怎么伺候这一棵」直接就是产量。
    const poor = { ...createColonyState(crater) };
    poor.bases['base-01'] = {
      ...poor.bases['base-01'],
      potato: { status: POTATO_STATUS.READY, growth: 100, solsGrown: 16, quality: 0 },
    };
    const great = { ...createColonyState(crater) };
    great.bases['base-01'] = {
      ...great.bases['base-01'],
      potato: { status: POTATO_STATUS.READY, growth: 100, solsGrown: 16, quality: 1 },
    };

    expect(getPotatoYield(base(poor))).toBe(POTATO_BASE_YIELD);
    expect(getPotatoYield(base(great))).toBe(POTATO_MAX_YIELD);
  });

  it('speeds the potato only from heaters adjacent to the planting bed', () => {
    // 热控只能放在中央七个邻格，施工完成后才生效。
    const neighbour = getNeighbourIds(PLANTING_BED_ID)[0];
    const far = base(createColonyState(crater)).cells.find(
      (cell) => cell.zone === 'rim'
    ).id;

    const run = (heaterCell) => {
      let colony = withStores(clearAll(createColonyState(crater)), {
        energy: 40, water: 90,
      });
      if (heaterCell) {
        colony = buildFacility(colony, heaterCell, FACILITY_TYPES.HEATER);
        colony = advance(colony, 2);
      }
      colony = plantCell(colony, PLANTING_BED_ID);
      return advance(colony, 6);
    };

    const plain = run(null);
    const adjacent = run(neighbour);
    const distant = run(far);

    expect(base(adjacent).potato.growth)
      .toBeGreaterThan(base(plain).potato.growth);
    // 远处甚至不是合法落点。
    expect(base(distant).potato.growth)
      .toBeCloseTo(base(plain).potato.growth, 5);
  });

  it('idles every facility when energy cannot cover upkeep', () => {
    // 四座热调节桩 8.8 E/SOL > 反应堆 6 E/SOL。
    let colony = withStores(clearAll(createColonyState(crater)), { energy: 40 });
    ['floor-1-0', 'floor-1-1', 'floor-1-2', 'floor-1-3']
      .forEach((id) => { colony = buildFacility(colony, id, FACILITY_TYPES.HEATER); });
    colony = buildFacility(colony, 'shadow-2-1', FACILITY_TYPES.EXTRACTOR);
    colony = advance(colony, 2);
    colony = withStores(colony, { energy: 0, water: 5 });

    const ticked = advanceColonySol(colony);

    expect(base(ticked).facilitiesIdle).toBe(true);
    // 停转的采冰器不产水，只剩不依赖电力的基础冷凝回收。
    expect(base(ticked).stores.water)
      .toBeLessThanOrEqual(5 + BASE_WATER_RECLAIM);
    // 掉电时能量照样被抽干，不能靠「关机攒电」自动恢复。
    expect(base(ticked).stores.energy).toBe(0);
  });

  it('loses the base after a sustained blackout', () => {
    let colony = withStores(clearAll(createColonyState(crater)), { energy: 40 });
    colony = buildFacility(colony, 'floor-1-0', FACILITY_TYPES.HEATER);
    colony = buildFacility(colony, 'floor-1-1', FACILITY_TYPES.HEATER);
    colony = buildFacility(colony, 'floor-1-2', FACILITY_TYPES.HEATER);
    colony = buildFacility(colony, 'floor-1-3', FACILITY_TYPES.HEATER);
    colony = advance(colony, 2);
    colony = withStores(colony, { energy: 0 });
    colony = advance(colony, BLACKOUT_LOSS_SOLS + 2);

    expect(colony.outcome).toBe(COLONY_OUTCOMES.LOST);
    expect(colony.lossReason).toBe(LOSS_REASONS.BLACKOUT);
  });

  it('escalates storm severity and eventually damages facilities', () => {
    expect(getStormSeverity(0).zones).toEqual(['rim']);
    expect(getStormSeverity(0).damagesFacilities).toBe(false);
    expect(getStormSeverity(2).zones).toContain('shadow');
    expect(getStormSeverity(5).damagesFacilities).toBe(true);
    expect(getStormSeverity(5).zones).toHaveLength(3);
  });

  it('protects the central potato only from an adjacent completed shield', () => {
    let colony = withStores(clearAll(createColonyState(crater)), { energy: 40 });
    colony = buildFacility(colony, 'floor-1-0', FACILITY_TYPES.SHIELD);

    expect(isShielded(base(colony), PLANTING_BED_ID)).toBe(false);
    colony = advance(colony, 3);
    expect(isShielded(base(colony), PLANTING_BED_ID)).toBe(true);
    expect(buildFacility(colony, 'rim-4-0', FACILITY_TYPES.SHIELD))
      .toBe(colony);
  });

  it('charges upkeep for shields so blanketing them is not free', () => {
    // 旧实现遮蔽棚 upkeep 为 0，铺满即永久删除唯一的事件系统。
    let colony = withStores(clearAll(createColonyState(crater)), { energy: 60 });
    ['floor-1-0', 'floor-1-2', 'floor-1-4']
      .forEach((id) => { colony = buildFacility(colony, id, FACILITY_TYPES.SHIELD); });
    colony = advance(colony, 3);

    const before = base(colony).stores.energy;
    colony = advanceColonySol(colony);

    // 三座遮蔽棚 4.5 E/SOL 已经吃掉大半反应堆产出。
    expect(base(colony).stores.energy - before).toBeLessThan(2);
  });

  it('harvests the potato, frees the bed and converts tubers to seeds', () => {
    let colony = withStores(createColonyState(crater), { water: 60 });
    colony = plantCell(colony, PLANTING_BED_ID);
    colony = advance(colony, 24);
    colony = harvestCell(colony, PLANTING_BED_ID);

    expect(base(colony).stores.tubers).toBeGreaterThanOrEqual(POTATO_BASE_YIELD);
    expect(base(colony).potato).toBeNull();

    const tubers = base(colony).stores.tubers;
    const seeds = base(colony).stores.seedStock;
    colony = convertTubersToSeeds(colony, 1);

    expect(base(colony).stores.tubers).toBe(tubers - TUBERS_PER_SEED);
    expect(base(colony).stores.seedStock).toBe(seeds + 1);
  });

  it('keeps the planting bed free of facilities', () => {
    // 种植床是唯一能长土豆的地方，被设施占掉就等于断了唯一产出口。
    const colony = withStores(createColonyState(crater), { energy: 40 });

    expect(buildFacility(colony, PLANTING_BED_ID, FACILITY_TYPES.HEATER))
      .toBe(colony);
    expect(canApplyTool(colony, PLANTING_BED_ID, TOOL_MODES.BUILD_HEATER))
      .toBe(false);
  });

  it('allows only one potato at a time', () => {
    let colony = withStores(createColonyState(crater), { seedStock: 4 });
    colony = plantCell(colony, PLANTING_BED_ID);

    // 已经有一棵了，再种是空操作。
    expect(plantCell(colony, PLANTING_BED_ID)).toBe(colony);
    // 别的格子也种不了 —— 一个坑只有一棵。
    const other = base(colony).cells.find((cell) => !cell.isPlantingBed);
    expect(plantCell(colony, other.id)).toBe(colony);
  });

  it('spends energy to clear a cell and refunds half when demolishing', () => {
    let colony = createColonyState(crater);
    const unclearedId = base(colony).cells.find(
      (cell) => !cell.cleared && cell.ring > 1
    ).id;
    const energyBefore = base(colony).stores.energy;

    colony = clearCell(colony, unclearedId);
    expect(cellOf(colony, unclearedId).cleared).toBe(true);
    expect(base(colony).stores.energy).toBe(energyBefore - CLEAR_COST);

    colony = buildFacility(colony, unclearedId, FACILITY_TYPES.BATTERY);
    const afterBuild = base(colony).stores.energy;
    colony = demolishCell(colony, unclearedId);

    expect(base(colony).stores.energy).toBeGreaterThan(afterBuild);
    expect(cellOf(colony, unclearedId).facility).toBeNull();
  });

  it('delivers a contract, banks the reward and wins after the last one', () => {
    let colony = createColonyState(crater);
    const [first] = colony.contracts;
    colony = withStores(colony, { tubers: first.amount, energy: 5 });
    colony = deliverContract(colony, first.id);

    expect(colony.contracts[0].status).toBe('done');
    expect(base(colony).stores.energy).toBeGreaterThan(5);
    expect(colony.outcome).toBeNull();

    colony.contracts.slice(1).forEach((contract) => {
      colony = withStores(colony, { [contract.resource]: contract.amount });
      colony = deliverContract(colony, contract.id);
    });

    expect(colony.outcome).toBe(COLONY_OUTCOMES.WON);
  });

  it('fails the base when a contract deadline passes', () => {
    const colony = advance(createColonyState(crater), 30);

    expect(colony.outcome).toBe(COLONY_OUTCOMES.LOST);
    expect(colony.lossReason).toBe(LOSS_REASONS.CONTRACT);
  });

  it('rejects invalid operations by returning the same reference', () => {
    // canApplyTool 为 false 与「操作返回同一引用」必须严格互为等价，
    // 否则 3D 高亮了却点不动。
    const colony = createColonyState(crater);
    const unclearedId = base(colony).cells.find((c) => !c.cleared).id;

    expect(plantCell(colony, unclearedId)).toBe(colony);
    expect(plantCell(colony, 'no-such-cell')).toBe(colony);
    expect(harvestCell(colony, 'floor-0-0')).toBe(colony);
    expect(demolishCell(colony, 'floor-0-0')).toBe(colony);
    expect(convertTubersToSeeds(colony, 1)).toBe(colony);
    expect(deliverContract(colony, 'supply-01')).toBe(colony);
    expect(buildFacility(colony, 'floor-0-0', 'no-such-facility')).toBe(colony);
  });

  it('mirrors every operation guard through canApplyTool', () => {
    const colony = withStores(createColonyState(crater), { energy: 40 });

    base(colony).cells.forEach((cell) => {
      const ops = [
        [TOOL_MODES.PLANT, plantCell],
        [TOOL_MODES.HARVEST, harvestCell],
        [TOOL_MODES.DEMOLISH, demolishCell],
        [TOOL_MODES.CLEAR, clearCell],
      ];

      ops.forEach(([tool, operation]) => {
        const allowed = canApplyTool(colony, cell.id, tool);
        const changed = operation(colony, cell.id) !== colony;

        expect(changed).toBe(allowed);
      });
    });
  });

  it('freezes every operation once the run is over', () => {
    const finished = { ...createColonyState(crater), outcome: COLONY_OUTCOMES.LOST };

    expect(advanceColonySol(finished)).toBe(finished);
    expect(plantCell(finished, 'floor-0-0')).toBe(finished);
    expect(canApplyTool(finished, 'floor-0-0', TOOL_MODES.PLANT)).toBe(false);
  });

  it('surfaces storm countdown and harvest alerts', () => {
    let colony = withStores(createColonyState(crater), { water: 60 });
    colony = plantCell(colony, 'floor-0-0');
    colony = advance(colony, 24);

    const kinds = getColonyAlerts(colony).map((alert) => alert.kind);
    expect(kinds).toContain('harvest');
  });

  it('warns when nothing is growing instead of silently stalling', () => {
    // 一格没种是可恢复的（有块茎就能转种薯），但玩家很容易没察觉
    // 自己已经停产，然后对着不再变化的画面等到合约超期。
    const idle = createColonyState(crater);
    const kinds = getColonyAlerts(idle).map((alert) => alert.kind);

    expect(kinds).toContain('idle');
  });

  it('ends the run when no further crop is possible', () => {
    // 真死局：没有在长的作物、没种薯、块茎也换不出一颗种薯。
    // 必须立刻结算，而不是让玩家等到合约超期。
    const dead = advanceColonySol(
      withStores(createColonyState(crater), { seedStock: 0, tubers: 1 })
    );

    expect(dead.outcome).toBe(COLONY_OUTCOMES.LOST);
    expect(dead.lossReason).toBe(LOSS_REASONS.SEED);
  });

  it('keeps a stocked base alive even with no seeds in hand', () => {
    // 手上有块茎就还能翻身，不能判死。
    const recoverable = advanceColonySol(
      withStores(createColonyState(crater), { seedStock: 0, tubers: 12 })
    );

    expect(recoverable.outcome).toBeNull();
  });

  it('caps water so it cannot be hoarded into irrelevance', () => {
    // 无上限的资源在第一次建造之后就不再是约束 —— 能量与水同理。
    let colony = withStores(clearAll(createColonyState(crater)), { energy: 60 });
    ['shadow-2-0', 'shadow-2-2', 'shadow-2-4']
      .forEach((id) => { colony = buildFacility(colony, id, FACILITY_TYPES.EXTRACTOR); });
    colony = advance(colony, 2);
    colony = advance(colony, 40);

    expect(base(colony).stores.water)
      .toBeLessThanOrEqual(base(colony).caps.water);
  });

  it('reclaims enough water on its own to reach the first harvest', () => {
    // 开局没有采冰器：基础冷凝回收保证第一棵土豆能长成（哪怕干瘪），
    // 否则开局是无解的死局 —— 那时的能量还买不起采冰器。
    let colony = createColonyState(crater);
    colony = plantCell(colony, PLANTING_BED_ID);
    colony = advance(colony, 26);

    expect(base(colony).potato.status).toBe(POTATO_STATUS.READY);
  });

  it('lets a plain three-cell rotation meet the first contract in time', () => {
    // 首个合约的可达性是旧设计的致命伤（差坑上数学上不可能）。
    // 只种初始三格、不扩张、不留种，必须在截止前攒够。
    let colony = createColonyState(crater);
    colony = buildFacility(colony, 'shadow-2-0', FACILITY_TYPES.EXTRACTOR);

    base(colony).cells
      .filter((cell) => cell.cleared && !cell.use)
      .forEach((cell) => { colony = plantCell(colony, cell.id); });

    const [contract] = colony.contracts;

    for (let sol = 0; sol < contract.deadlineSol; sol += 1) {
      colony = advanceColonySol(colony);
      base(colony).cells.forEach((cell) => {
        if (canApplyTool(colony, cell.id, TOOL_MODES.HARVEST)) {
          colony = harvestCell(colony, cell.id);
        }
      });
    }

    expect(base(colony).stores.tubers)
      .toBeGreaterThanOrEqual(contract.amount);
  });

  it('turns water and minerals into nutrients, then feeds the center', () => {
    let colony = withStores(clearAll(createColonyState(crater)), {
      energy: 80,
      water: 20,
    });
    colony = buildFacility(colony, 'shadow-2-0', FACILITY_TYPES.EXTRACTOR);
    colony = buildFacility(colony, 'shadow-2-1', FACILITY_TYPES.SIFTER);
    colony = buildFacility(colony, 'shadow-3-0', FACILITY_TYPES.NUTRIENT);
    colony = buildFacility(colony, 'floor-1-0', FACILITY_TYPES.ROOT_FEEDER);
    colony = advance(colony, 3);

    const bottleneck = getFactoryBottleneck(base(colony));
    const forecast = getFactoryForecast(base(colony));
    expect(bottleneck.kind).not.toBe('delivery');
    expect(forecast.minerals.income).toBeGreaterThan(0);
    expect(forecast.nutrients.income).toBeGreaterThan(0);

    colony = plantCell(colony, PLANTING_BED_ID);
    colony = advance(colony, 3);
    expect(base(colony).potato.hydration).toBeGreaterThan(0.12);
    expect(base(colony).potato.nutrition).toBeGreaterThan(0.05);
  });

  it('degrades damaged facilities and repairs them with energy', () => {
    let colony = withStores(clearAll(createColonyState(crater)), { energy: 50 });
    colony = buildFacility(colony, 'shadow-2-0', FACILITY_TYPES.EXTRACTOR);
    colony = advance(colony, 2);

    const damagedCells = base(colony).cells.map((cell) => (
      cell.id === 'shadow-2-0'
        ? {
          ...cell,
          facility: { ...cell.facility, integrity: 40, status: 'degraded' },
        }
        : cell
    ));
    colony = {
      ...colony,
      bases: {
        ...colony.bases,
        'base-01': { ...base(colony), cells: damagedCells },
      },
    };

    const cost = getRepairCost(cellOf(colony, 'shadow-2-0').facility);
    expect(cost).toBeGreaterThan(0);
    colony = repairFacility(colony, 'shadow-2-0');
    expect(cellOf(colony, 'shadow-2-0').facility.integrity).toBe(100);
  });
});
