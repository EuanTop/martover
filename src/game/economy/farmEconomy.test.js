import { describe, expect, it } from 'vitest';
import {
  advanceFarmSol,
  buildFacility,
  canApplyTool,
  convertTubersToSeeds,
  createFarmState,
  deliverContract,
  FACILITY_TYPES,
  FARM_OUTCOMES,
  getFarmAlerts,
  harvestPlot,
  plantPlot,
  PLOT_STATUS,
  TOOL_MODES,
  TUBERS_PER_SEED,
} from './farmEconomy';

const crater = {
  id: '01-000001',
  latitude: -61,
  longitude: 42,
  diameter: 24,
  layerNumber: 3,
  rimDegradation: 3,
  ejectaDegradation: 2,
  floorDegradation: 2,
  hasRd: true,
};

const advance = (state, sols) => Array.from({ length: sols }).reduce(
  (current) => advanceFarmSol(current),
  state
);

describe('farmEconomy', () => {
  it('starts with two unlocked plots, two open contracts and a scheduled storm', () => {
    const farm = createFarmState(crater);
    const unlocked = farm.plots.filter(
      (plot) => plot.status !== PLOT_STATUS.LOCKED
    );

    expect(unlocked.map((plot) => plot.id)).toEqual(['floor-a', 'shadow-a']);
    expect(farm.contracts).toHaveLength(2);
    expect(farm.storm.arriveSol - farm.storm.announceSol).toBe(4);
    expect(farm.outcome).toBeNull();
  });

  it('is deterministic for the same crater', () => {
    const runA = advance(plantPlot(createFarmState(crater), 'floor-a'), 20);
    const runB = advance(plantPlot(createFarmState(crater), 'floor-a'), 20);

    expect(runA).toEqual(runB);
  });

  it('grows a watered plot to ready and consumes water each sol', () => {
    let farm = plantPlot(createFarmState(crater), 'shadow-a');

    expect(farm.seedStock).toBe(3);

    farm = advance(farm, 1);
    expect(farm.water).toBeLessThan(24 + 3);
    expect(farm.plots.find((plot) => plot.id === 'shadow-a').growth)
      .toBeGreaterThan(0);

    farm = advance(farm, 30);
    expect(farm.plots.find((plot) => plot.id === 'shadow-a').status)
      .toBe(PLOT_STATUS.READY);
  });

  it('stalls growth without water instead of failing silently', () => {
    let farm = plantPlot(createFarmState(crater), 'floor-a');
    farm = { ...farm, water: 0 };
    const before = farm.plots.find((plot) => plot.id === 'floor-a').growth;

    farm = advanceFarmSol(farm);

    expect(farm.plots.find((plot) => plot.id === 'floor-a').growth).toBe(before);
  });

  it('heater speeds growth and harvester produces water at energy cost', () => {
    let plain = plantPlot(createFarmState(crater), 'floor-a');
    let heated = buildFacility(
      plantPlot(createFarmState(crater), 'floor-a'),
      'floor-a',
      FACILITY_TYPES.HEATER
    );

    expect(heated.energy).toBe(30 - 8);

    plain = advance(plain, 6);
    heated = advance(heated, 6);

    expect(heated.plots[0].growth).toBeGreaterThan(plain.plots[0].growth * 1.3);

    let farm = buildFacility(
      createFarmState(crater),
      'shadow-a',
      FACILITY_TYPES.HARVESTER
    );
    const waterBefore = farm.water;
    farm = advanceFarmSol(farm);
    expect(farm.water).toBe(waterBefore + 3);
  });

  it('idles all facilities when energy cannot cover upkeep', () => {
    let farm = buildFacility(
      createFarmState(crater),
      'shadow-a',
      FACILITY_TYPES.HARVESTER
    );
    farm = { ...farm, energy: 0 };
    const waterBefore = farm.water;

    farm = advanceFarmSol(farm);

    // 反应堆 +2 不够 1 点维护费之外再谈；此处维护 1 < 2，可运转。
    // 提高维护压力：再建一个加热桩（维护 2，共 3 > 2）。
    farm = buildFacility(
      { ...farm, energy: 8 },
      'floor-a',
      FACILITY_TYPES.HEATER
    );
    farm = { ...farm, energy: 0 };
    const waterBeforeIdle = farm.water;
    farm = advanceFarmSol(farm);

    expect(farm.facilitiesIdle).toBe(true);
    expect(farm.water).toBe(waterBeforeIdle);
    expect(waterBefore).toBeLessThanOrEqual(farm.water + 10);
  });

  it('destroys unshielded rim crops and spares shielded ones when the storm lands', () => {
    let farm = createFarmState(crater);
    // 直接解锁坑缘两块地模拟后期状态。
    farm = {
      ...farm,
      seedStock: 4,
      plots: farm.plots.map((plot) => (
        plot.zone === 'rim' ? { ...plot, status: PLOT_STATUS.EMPTY } : plot
      )),
    };
    farm = plantPlot(farm, 'rim-a');
    farm = plantPlot(farm, 'rim-b');
    farm = buildFacility({ ...farm, energy: 30 }, 'rim-b', FACILITY_TYPES.SHIELD);

    // 推进到风暴到达。
    while (!farm.outcome && farm.storm.index === 0) {
      farm = advanceFarmSol(farm);
    }

    const rimA = farm.plots.find((plot) => plot.id === 'rim-a');
    const rimB = farm.plots.find((plot) => plot.id === 'rim-b');

    expect(rimA.status).toBe(PLOT_STATUS.EMPTY);
    // 受护地块保住作物：视风暴到达时间可能仍在生长或已成熟。
    expect([PLOT_STATUS.GROWING, PLOT_STATUS.READY]).toContain(rimB.status);
    expect(farm.storm.index).toBe(1);
  });

  it('fails the base when a contract deadline passes', () => {
    let farm = createFarmState(crater);
    farm = advance(farm, 31);

    expect(farm.outcome).toBe(FARM_OUTCOMES.LOST);
    expect(farm.contracts.find((c) => c.id === 'supply-tubers').status)
      .toBe('failed');
  });

  it('delivers contracts, unlocks the rim plot and wins after both', () => {
    let farm = createFarmState(crater);
    farm = { ...farm, tubers: 25 };

    farm = deliverContract(farm, 'supply-tubers');

    expect(farm.tubers).toBe(5);
    expect(farm.plots.find((plot) => plot.id === 'rim-a').status)
      .toBe(PLOT_STATUS.EMPTY);
    expect(farm.outcome).toBeNull();

    farm = { ...farm, seedStock: 10 };
    farm = deliverContract(farm, 'supply-seeds');

    expect(farm.outcome).toBe(FARM_OUTCOMES.WON);
  });

  it('converts tubers to seeds at the documented ratio', () => {
    let farm = { ...createFarmState(crater), tubers: 5 };

    farm = convertTubersToSeeds(farm, 2);

    expect(farm.tubers).toBe(5 - 2 * TUBERS_PER_SEED);
    expect(farm.seedStock).toBe(4 + 2);

    // 不够转换时保持原状。
    expect(convertTubersToSeeds(farm, 5)).toBe(farm);
  });

  it('harvest returns yield, clears the plot and respects storm halving', () => {
    let farm = plantPlot(createFarmState(crater), 'floor-a');
    // 20 SOL 内成熟且未越过订单期限（越期即判负、操作全部锁定）。
    farm = advance(farm, 20);
    const ready = farm.plots.find((plot) => plot.id === 'floor-a');
    expect(ready.status).toBe(PLOT_STATUS.READY);

    const harvested = harvestPlot(farm, 'floor-a');
    const gained = harvested.tubers - farm.tubers;

    expect(gained).toBeGreaterThanOrEqual(6);
    expect(gained).toBeLessThanOrEqual(8);

    const halved = harvestPlot(
      {
        ...farm,
        plots: farm.plots.map((plot) => (
          plot.id === 'floor-a' ? { ...plot, stormHalved: true } : plot
        )),
      },
      'floor-a'
    );

    expect(halved.tubers - farm.tubers)
      .toBeLessThanOrEqual(Math.ceil(gained / 2));
  });

  it('surfaces storm countdown and harvest alerts', () => {
    let farm = plantPlot(createFarmState(crater), 'floor-a');

    while (farm.sol < farm.storm.announceSol) {
      farm = advanceFarmSol(farm);
    }

    const alerts = getFarmAlerts(farm);
    expect(alerts.some((alert) => alert.kind === 'storm')).toBe(true);
  });

  it('rejects invalid operations without mutating state', () => {
    const farm = createFarmState(crater);

    expect(plantPlot(farm, 'rim-a')).toBe(farm);
    expect(harvestPlot(farm, 'floor-a')).toBe(farm);
    expect(buildFacility(farm, 'rim-a', FACILITY_TYPES.HEATER)).toBe(farm);
    expect(deliverContract(farm, 'supply-tubers')).toBe(farm);
    expect(buildFacility(
      { ...farm, energy: 2 },
      'floor-a',
      FACILITY_TYPES.HEATER
    )).toEqual({ ...farm, energy: 2 });
  });

  it('mirrors operation guards through canApplyTool for UI highlighting', () => {
    const farm = createFarmState(crater);

    // 初始：两块解锁空地可种植、可建设施；锁定地块全部不可用。
    expect(canApplyTool(farm, 'floor-a', TOOL_MODES.PLANT)).toBe(true);
    expect(canApplyTool(farm, 'rim-a', TOOL_MODES.PLANT)).toBe(false);
    expect(canApplyTool(farm, 'floor-a', TOOL_MODES.HARVEST)).toBe(false);
    expect(canApplyTool(farm, 'floor-a', TOOL_MODES.BUILD_HARVESTER)).toBe(true);

    // 种薯耗尽后种植不可用。
    expect(canApplyTool(
      { ...farm, seedStock: 0 },
      'floor-a',
      TOOL_MODES.PLANT
    )).toBe(false);

    // 能量不足时建造不可用。
    expect(canApplyTool(
      { ...farm, energy: 5 },
      'floor-a',
      TOOL_MODES.BUILD_SHIELD
    )).toBe(false);

    // 已种植地块：不能再种、不能放采冰器，但可以加热与遮蔽。
    const planted = plantPlot(farm, 'floor-a');
    expect(canApplyTool(planted, 'floor-a', TOOL_MODES.PLANT)).toBe(false);
    expect(canApplyTool(planted, 'floor-a', TOOL_MODES.BUILD_HARVESTER)).toBe(false);
    expect(canApplyTool(planted, 'floor-a', TOOL_MODES.BUILD_HEATER)).toBe(true);
    expect(canApplyTool(planted, 'floor-a', TOOL_MODES.BUILD_SHIELD)).toBe(true);

    // 判定与实际执行一致：canApplyTool 为 false 的操作不改状态。
    expect(plantPlot(planted, 'floor-a')).toBe(planted);
  });
});
