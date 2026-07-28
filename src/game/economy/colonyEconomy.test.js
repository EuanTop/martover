import { describe, expect, it } from 'vitest';
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
const corePortId = (colony, index = 0) => (
  base(colony).cells.filter((cell) => cell.corePort)[index].id
);
const shadowId = (colony, index = 0) => (
  base(colony).cells.filter((cell) => cell.zone === 'shadow' && !cell.corePort)[index].id
);
const rimId = (colony, index = 0) => (
  base(colony).cells.filter((cell) => cell.zone === 'rim' && !cell.corePort)[index].id
);
const advance = (colony, sols) => {
  let next = colony;
  for (let i = 0; i < sols; i += 1) next = advanceColonySol(next);
  return next;
};

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

const buildStarterFactory = (colony) => {
  let next = colony;
  next = buildFacility(next, shadowId(next, 0), FACILITY_TYPES.EXTRACTOR);
  next = buildFacility(next, shadowId(next, 1), FACILITY_TYPES.SIFTER);
  next = buildFacility(next, rimId(next, 0), FACILITY_TYPES.NUTRIENT);
  next = buildFacility(next, corePortId(next, 0), FACILITY_TYPES.ROOT_FEEDER);
  return next;
};

describe('colonyEconomy', () => {
  it('is deterministic for the same crater and action sequence', () => {
    const run = () => {
      let colony = createColonyState(crater);
      colony = buildStarterFactory(colony);
      colony = advance(colony, 3);
      colony = plantCell(colony, PLANTING_BED_ID);
      return advance(colony, 12);
    };

    expect(run()).toEqual(run());
  });

  it('starts with one central potato core and 62 cleared exterior factory cells', () => {
    const colony = createColonyState(crater);
    const cells = base(colony).cells;

    expect(cells).toHaveLength(63);
    expect(cellOf(colony, PLANTING_BED_ID).isPlantingBed).toBe(true);
    expect(cells.filter((cell) => cell.corePort)).toHaveLength(8);
    expect(cells.every((cell) => cell.cleared)).toBe(true);
    expect(cells.some((cell) => canApplyTool(colony, cell.id, TOOL_MODES.CLEAR)))
      .toBe(false);
  });

  it('keeps energy capped, and batteries raise the cap', () => {
    let colony = createColonyState(crater);
    const capBefore = getEnergyCap(base(colony));

    colony = advance(colony, 20);
    expect(base(colony).stores.energy).toBeLessThanOrEqual(capBefore);

    colony = withStores(colony, { energy: 40 });
    const batteryCell = rimId(colony);
    colony = buildFacility(colony, batteryCell, FACILITY_TYPES.BATTERY);
    colony = advance(colony, 2);

    expect(cellOf(colony, batteryCell).facility.type)
      .toBe(FACILITY_TYPES.BATTERY);
    expect(getEnergyCap(base(colony))).toBeGreaterThan(capBefore);
  });

  it('draws far more water for the super potato than the crew alone', () => {
    let colony = withStores(createColonyState(crater), { energy: 40, seedStock: 4 });
    colony = buildFacility(colony, shadowId(colony), FACILITY_TYPES.EXTRACTOR);
    const idleDrain = getWaterDrain(base(colony));
    colony = plantCell(colony, PLANTING_BED_ID);

    expect(getWaterDrain(base(colony))).toBeGreaterThan(idleDrain);
    expect(getWaterDrain(base(colony)))
      .toBeGreaterThan(getWaterIncome(base(colony)));
  });

  it('only runs an extractor after construction completes in a shadow platform cell', () => {
    let colony = withStores(createColonyState(crater), { energy: 40 });
    const port = corePortId(colony);
    const shadow = shadowId(colony);

    expect(buildFacility(colony, port, FACILITY_TYPES.EXTRACTOR)).toBe(colony);

    colony = buildFacility(colony, shadow, FACILITY_TYPES.EXTRACTOR);
    expect(getWaterIncome(base(colony))).toBe(BASE_WATER_RECLAIM);

    colony = advance(colony, 2);
    expect(getWaterIncome(base(colony))).toBeGreaterThan(BASE_WATER_RECLAIM);
  });

  it('reserves core ports for cultivation facilities', () => {
    let colony = withStores(createColonyState(crater), { energy: 40 });
    const port = corePortId(colony);
    const nonPort = shadowId(colony);

    expect(buildFacility(colony, port, FACILITY_TYPES.NUTRIENT)).toBe(colony);
    expect(buildFacility(colony, nonPort, FACILITY_TYPES.ROOT_FEEDER)).toBe(colony);

    colony = buildFacility(colony, port, FACILITY_TYPES.ROOT_FEEDER);
    expect(cellOf(colony, port).facility.type).toBe(FACILITY_TYPES.ROOT_FEEDER);
  });

  it('grows without a full factory, but root delivery makes the potato larger', () => {
    let supported = withStores(createColonyState(crater), {
      energy: 40,
      water: 60,
      nutrients: 30,
    });
    supported = buildFacility(
      supported,
      corePortId(supported),
      FACILITY_TYPES.ROOT_FEEDER
    );
    supported = advance(supported, 2);
    supported = withStores(supported, { water: 60, nutrients: 30 });
    supported = plantCell(supported, PLANTING_BED_ID);
    supported = advance(supported, 24);

    expect(base(supported).potato.status).toBe(POTATO_STATUS.READY);

    let dry = withStores(createColonyState(crater), { water: 0 });
    dry = plantCell(dry, PLANTING_BED_ID);
    dry = advance(dry, 24);

    expect(base(dry).potato.quality)
      .toBeLessThan(base(supported).potato.quality);
    expect(getPotatoYield(base(dry)))
      .toBeLessThan(getPotatoYield(base(supported)));
  });

  it('makes yield a function of care quality, not a hidden roll', () => {
    const poor = createColonyState(crater);
    poor.bases['base-01'] = {
      ...poor.bases['base-01'],
      potato: { status: POTATO_STATUS.READY, growth: 100, solsGrown: 16, quality: 0 },
    };
    const great = createColonyState(crater);
    great.bases['base-01'] = {
      ...great.bases['base-01'],
      potato: { status: POTATO_STATUS.READY, growth: 100, solsGrown: 16, quality: 1 },
    };

    expect(getPotatoYield(base(poor))).toBe(POTATO_BASE_YIELD);
    expect(getPotatoYield(base(great))).toBe(POTATO_MAX_YIELD);
  });

  it('speeds the potato only from completed heaters on core ports', () => {
    const run = (heaterCell) => {
      let colony = withStores(createColonyState(crater), { energy: 40, water: 90 });
      if (heaterCell) {
        colony = buildFacility(colony, heaterCell, FACILITY_TYPES.HEATER);
        colony = advance(colony, 2);
      }
      colony = plantCell(colony, PLANTING_BED_ID);
      return advance(colony, 6);
    };

    const seeded = createColonyState(crater);
    const plain = run(null);
    const portHeated = run(corePortId(seeded));
    const distantAttempt = run(rimId(seeded));

    expect(base(portHeated).potato.growth)
      .toBeGreaterThan(base(plain).potato.growth);
    expect(base(distantAttempt).potato.growth)
      .toBeCloseTo(base(plain).potato.growth, 5);
  });

  it('idles every facility when energy cannot cover upkeep', () => {
    let colony = withStores(createColonyState(crater), { energy: 80 });
    [0, 1, 2, 3].forEach((index) => {
      colony = buildFacility(colony, corePortId(colony, index), FACILITY_TYPES.HEATER);
    });
    colony = buildFacility(colony, shadowId(colony), FACILITY_TYPES.EXTRACTOR);
    colony = advance(colony, 2);
    colony = withStores(colony, { energy: 0, water: 5 });

    const ticked = advanceColonySol(colony);

    expect(base(ticked).facilitiesIdle).toBe(true);
    expect(base(ticked).stores.water)
      .toBeLessThanOrEqual(5 + BASE_WATER_RECLAIM);
    expect(base(ticked).stores.energy).toBe(0);
  });

  it('loses the base after a sustained blackout', () => {
    let colony = withStores(createColonyState(crater), { energy: 80 });
    [0, 1, 2, 3].forEach((index) => {
      colony = buildFacility(colony, corePortId(colony, index), FACILITY_TYPES.HEATER);
    });
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
    expect(getStormSeverity(5).zones).toEqual(['rim', 'shadow', 'inner']);
  });

  it('protects the central potato only from a completed shield on a core port', () => {
    let colony = withStores(createColonyState(crater), { energy: 40 });
    const port = corePortId(colony);
    colony = buildFacility(colony, port, FACILITY_TYPES.SHIELD);

    expect(isShielded(base(colony), PLANTING_BED_ID)).toBe(false);
    colony = advance(colony, 3);
    expect(isShielded(base(colony), PLANTING_BED_ID)).toBe(true);
    expect(buildFacility(colony, rimId(colony), FACILITY_TYPES.SHIELD)).toBe(colony);
  });

  it('charges upkeep for shields so blanketing them is not free', () => {
    let colony = withStores(createColonyState(crater), { energy: 80 });
    [0, 1, 2].forEach((index) => {
      colony = buildFacility(colony, corePortId(colony, index), FACILITY_TYPES.SHIELD);
    });
    colony = advance(colony, 3);

    const before = base(colony).stores.energy;
    colony = advanceColonySol(colony);

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

  it('keeps the planting bed free of facilities and allows only one potato', () => {
    let colony = withStores(createColonyState(crater), { energy: 40, seedStock: 4 });

    expect(buildFacility(colony, PLANTING_BED_ID, FACILITY_TYPES.HEATER))
      .toBe(colony);
    expect(canApplyTool(colony, PLANTING_BED_ID, TOOL_MODES.BUILD_HEATER))
      .toBe(false);

    colony = plantCell(colony, PLANTING_BED_ID);
    expect(plantCell(colony, PLANTING_BED_ID)).toBe(colony);
    expect(plantCell(colony, shadowId(colony))).toBe(colony);
  });

  it('refunds part of a demolished facility and keeps clear hidden for open cells', () => {
    let colony = withStores(createColonyState(crater), { energy: 40 });
    const id = rimId(colony);

    expect(clearCell(colony, id)).toBe(colony);
    colony = buildFacility(colony, id, FACILITY_TYPES.BATTERY);
    const afterBuild = base(colony).stores.energy;
    colony = demolishCell(colony, id);

    expect(base(colony).stores.energy).toBeGreaterThan(afterBuild);
    expect(cellOf(colony, id).facility).toBeNull();
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
    const colony = advance(createColonyState(crater), 35);

    expect(colony.outcome).toBe(COLONY_OUTCOMES.LOST);
    expect(colony.lossReason).toBe(LOSS_REASONS.CONTRACT);
  });

  it('rejects invalid operations by returning the same reference', () => {
    const colony = createColonyState(crater);
    const exterior = shadowId(colony);

    expect(plantCell(colony, exterior)).toBe(colony);
    expect(plantCell(colony, 'no-such-cell')).toBe(colony);
    expect(harvestCell(colony, PLANTING_BED_ID)).toBe(colony);
    expect(demolishCell(colony, PLANTING_BED_ID)).toBe(colony);
    expect(convertTubersToSeeds(colony, 1)).toBe(colony);
    expect(deliverContract(colony, 'supply-01')).toBe(colony);
    expect(buildFacility(colony, PLANTING_BED_ID, 'no-such-facility')).toBe(colony);
  });

  it('mirrors direct operation guards through canApplyTool', () => {
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
    expect(plantCell(finished, PLANTING_BED_ID)).toBe(finished);
    expect(canApplyTool(finished, PLANTING_BED_ID, TOOL_MODES.PLANT)).toBe(false);
  });

  it('surfaces storm countdown, idle state and harvest alerts', () => {
    const idleKinds = getColonyAlerts(createColonyState(crater)).map(
      (alert) => alert.kind
    );
    expect(idleKinds).toContain('idle');

    let colony = withStores(createColonyState(crater), { water: 60 });
    colony = plantCell(colony, PLANTING_BED_ID);
    colony = advance(colony, 24);

    const kinds = getColonyAlerts(colony).map((alert) => alert.kind);
    expect(kinds).toContain('harvest');
  });

  it('ends the run only when no further crop is possible', () => {
    const dead = advanceColonySol(
      withStores(createColonyState(crater), { seedStock: 0, tubers: 1 })
    );

    expect(dead.outcome).toBe(COLONY_OUTCOMES.LOST);
    expect(dead.lossReason).toBe(LOSS_REASONS.SEED);

    const recoverable = advanceColonySol(
      withStores(createColonyState(crater), { seedStock: 0, tubers: 12 })
    );
    expect(recoverable.outcome).toBeNull();
  });

  it('caps water so it cannot be hoarded into irrelevance', () => {
    let colony = withStores(createColonyState(crater), { energy: 60 });
    [0, 1, 2].forEach((index) => {
      colony = buildFacility(colony, shadowId(colony, index), FACILITY_TYPES.EXTRACTOR);
    });
    colony = advance(colony, 2);
    colony = advance(colony, 40);

    expect(base(colony).stores.water)
      .toBeLessThanOrEqual(base(colony).caps.water);
  });

  it('reclaims enough water on its own to reach the first harvest', () => {
    let colony = createColonyState(crater);
    colony = plantCell(colony, PLANTING_BED_ID);
    colony = advance(colony, 26);

    expect(base(colony).potato.status).toBe(POTATO_STATUS.READY);
  });

  it('lets a starter factory meet the first contract in time', () => {
    let colony = buildStarterFactory(createColonyState(crater));
    colony = advance(colony, 3);
    colony = plantCell(colony, PLANTING_BED_ID);

    const [contract] = colony.contracts;
    while (
      !colony.outcome
      && colony.sol <= contract.deadlineSol
      && base(colony).stores.tubers < contract.amount
    ) {
      colony = advanceColonySol(colony);
      if (canApplyTool(colony, PLANTING_BED_ID, TOOL_MODES.HARVEST)) {
        colony = harvestCell(colony, PLANTING_BED_ID);
      }
    }

    expect(base(colony).stores.tubers)
      .toBeGreaterThanOrEqual(contract.amount);
    colony = deliverContract(colony, contract.id);
    expect(colony.contracts[0].status).toBe('done');
  });

  it('turns water and minerals into nutrients, then feeds the center', () => {
    let colony = withStores(createColonyState(crater), {
      energy: 80,
      water: 20,
    });
    colony = buildFacility(colony, shadowId(colony, 0), FACILITY_TYPES.EXTRACTOR);
    colony = buildFacility(colony, shadowId(colony, 1), FACILITY_TYPES.SIFTER);
    colony = buildFacility(colony, rimId(colony, 0), FACILITY_TYPES.NUTRIENT);
    colony = buildFacility(colony, corePortId(colony, 0), FACILITY_TYPES.ROOT_FEEDER);
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
    let colony = withStores(createColonyState(crater), { energy: 50 });
    const id = shadowId(colony);
    colony = buildFacility(colony, id, FACILITY_TYPES.EXTRACTOR);
    colony = advance(colony, 2);

    const damagedCells = base(colony).cells.map((cell) => (
      cell.id === id
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

    const cost = getRepairCost(cellOf(colony, id).facility);
    expect(cost).toBeGreaterThan(0);
    colony = repairFacility(colony, id);
    expect(cellOf(colony, id).facility.integrity).toBe(100);
  });

  it('has at least one legal non-core factory slot for every non-cultivation category', () => {
    const colony = withStores(createColonyState(crater), { energy: 80 });

    [
      FACILITY_TYPES.EXTRACTOR,
      FACILITY_TYPES.SIFTER,
      FACILITY_TYPES.SOLAR,
      FACILITY_TYPES.BATTERY,
      FACILITY_TYPES.NUTRIENT,
    ].forEach((type) => {
      expect(base(colony).cells.some((cell) => (
        canApplyTool(colony, cell.id, {
          [FACILITY_TYPES.EXTRACTOR]: TOOL_MODES.BUILD_EXTRACTOR,
          [FACILITY_TYPES.SIFTER]: TOOL_MODES.BUILD_SIFTER,
          [FACILITY_TYPES.SOLAR]: TOOL_MODES.BUILD_SOLAR,
          [FACILITY_TYPES.BATTERY]: TOOL_MODES.BUILD_BATTERY,
          [FACILITY_TYPES.NUTRIENT]: TOOL_MODES.BUILD_NUTRIENT,
        }[type])
      ))).toBe(true);
    });
  });
});
