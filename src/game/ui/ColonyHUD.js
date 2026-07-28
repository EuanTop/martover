import React, { useState } from 'react';
import {
  ApartmentOutlined,
  BulbOutlined,
  CloudOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  FilterOutlined,
  FireOutlined,
  RestOutlined,
  SafetyCertificateOutlined,
  ScissorOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  canApplyTool,
  getColonyAlerts,
  getEnergyCap,
  getFactoryBottleneck,
  getFactoryForecast,
  getPotatoYield,
} from '../economy/colonyEconomy';
import {
  CLEAR_COST,
  COLONY_OUTCOMES,
  FACILITY_CATEGORIES,
  FACILITY_STATUS,
  FACILITY_TYPES,
  POTATO_STATUS,
  FACILITY_SPECS,
  LOSS_REASONS,
  TOOL_FACILITY,
  TOOL_MODES,
  TUBERS_PER_SEED,
} from '../economy/colonyState';
import ClockControls from './ClockControls';
import HumanFeedbackScene from './HumanFeedbackScene';
import styles from './ColonyHUD.module.css';

// 直接动作与建造动作分开：建造有 5 种，平铺会把工具栏挤爆。
const directTools = Object.freeze([
  {
    tool: TOOL_MODES.CLEAR,
    label: '开垦',
    hint: `能量 ${CLEAR_COST}`,
    icon: ToolOutlined,
  },
  {
    tool: TOOL_MODES.PLANT,
    label: '种植',
    hint: '消耗 1 种薯',
    icon: ExperimentOutlined,
  },
  {
    tool: TOOL_MODES.HARVEST,
    label: '收获',
    hint: '采收成熟地块',
    icon: ScissorOutlined,
  },
  {
    tool: TOOL_MODES.REPAIR,
    label: '维修',
    hint: '修复受损设施',
    icon: ToolOutlined,
  },
  {
    tool: TOOL_MODES.DEMOLISH,
    label: '拆除',
    hint: '返还一半能量',
    icon: DeleteOutlined,
  },
]);

const buildIcons = Object.freeze({
  [TOOL_MODES.BUILD_EXTRACTOR]: CloudOutlined,
  [TOOL_MODES.BUILD_SIFTER]: FilterOutlined,
  [TOOL_MODES.BUILD_SOLAR]: BulbOutlined,
  [TOOL_MODES.BUILD_BATTERY]: ThunderboltOutlined,
  [TOOL_MODES.BUILD_NUTRIENT]: ExperimentOutlined,
  [TOOL_MODES.BUILD_ROOT_FEEDER]: DeploymentUnitOutlined,
  [TOOL_MODES.BUILD_HEATER]: FireOutlined,
  [TOOL_MODES.BUILD_SHIELD]: SafetyCertificateOutlined,
});

const buildTools = Object.freeze(
  Object.entries(TOOL_FACILITY).map(([tool, facilityType]) => ({
    tool,
    facilityType,
    label: FACILITY_SPECS[facilityType].label,
    spec: FACILITY_SPECS[facilityType],
    icon: buildIcons[tool],
  }))
);

const ALL_TOOLS = Object.freeze([...directTools, ...buildTools]);

const BUILD_GROUPS = Object.freeze([
  { id: FACILITY_CATEGORIES.COLLECTION, label: '采集' },
  { id: FACILITY_CATEGORIES.ENERGY, label: '供能' },
  { id: FACILITY_CATEGORIES.PROCESSING, label: '加工' },
  { id: FACILITY_CATEGORIES.CULTIVATION, label: '培育' },
]);

const CHAIN_STEPS = Object.freeze([
  { type: FACILITY_TYPES.EXTRACTOR, label: '采水' },
  { type: FACILITY_TYPES.SIFTER, label: '矿物' },
  { type: FACILITY_TYPES.NUTRIENT, label: '营养' },
  { type: FACILITY_TYPES.ROOT_FEEDER, label: '根灌' },
]);

const ContractCard = ({ contract, stock, sol, onDeliver }) => {
  const remaining = contract.deadlineSol - sol;
  const progress = Math.min(1, stock / contract.amount);
  const deliverable = contract.status === 'open' && stock >= contract.amount;
  const stateClass = contract.status === 'done'
    ? styles.contractDone
    : contract.status === 'failed' ? styles.contractFailed : '';

  return (
    <div className={`${styles.contractCard} ${stateClass}`}>
      <header>
        <strong>{contract.label}</strong>
        <span className={remaining <= 8 && contract.status === 'open'
          ? styles.deadlineNear
          : ''}
        >
          {contract.status === 'done' ? '已交付'
            : contract.status === 'failed' ? '已违约'
              : `剩 ${Math.max(0, remaining)} SOL`}
        </span>
      </header>
      <div className={styles.contractProgress}>
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <footer>
        <small>
          {Math.min(stock, contract.amount)}/{contract.amount}
          {' · '}
          {contract.rewardText}
        </small>
        {contract.status === 'open' && (
          <button
            type="button"
            className={styles.deliverButton}
            disabled={!deliverable}
            onClick={() => onDeliver(contract.id)}
          >
            交付
          </button>
        )}
      </footer>
    </div>
  );
};

// 净速率条：经营游戏的核心可读性 —— 玩家必须能规划，而不是只能试错。
const RateRow = ({ label, stock, cap, income, drain }) => {
  const net = income - drain;
  const solsToEmpty = net < -0.05 ? Math.floor(stock / -net) : null;
  const critical = solsToEmpty !== null && solsToEmpty <= 6;

  return (
    <div className={`${styles.rateRow} ${critical ? styles.rateCritical : ''}`}>
      <span>{label}</span>
      <b>{Math.floor(stock)}{cap ? `/${cap}` : ''}</b>
      <i>{net >= 0 ? '+' : ''}{net.toFixed(1)}</i>
      <small>
        {solsToEmpty !== null ? `还能撑 ${solsToEmpty} SOL` : '稳定'}
      </small>
    </div>
  );
};

const HumanMonitor = ({ human, generation }) => (
  <aside className={`${styles.hud} ${styles.humanMonitor}`}>
    <header>
      <div>
        <span>CREW BIO-SCAN · GEN {generation}</span>
        <strong>{human.name}</strong>
      </div>
      <i title="生命体征在线" />
    </header>
    <div className={styles.humanViewport}>
      <HumanFeedbackScene human={human} phase="scanning" />
      <b aria-hidden="true" />
      <span>等待本轮土豆样本</span>
    </div>
    <footer>
      <div>
        <span>生命</span>
        <strong>{Math.round(human.vitality)}</strong>
      </div>
      <div>
        <span>生理年龄</span>
        <strong>{human.biologicalAge.toFixed(1)}</strong>
      </div>
      <div>
        <span>代谢负荷</span>
        <strong>{Math.round(human.metabolicLoad)}</strong>
      </div>
    </footer>
  </aside>
);

const ToolButton = ({ definition, selected, hint, onSelect }) => {
  const Icon = definition.icon;

  return (
    <button
      type="button"
      className={`${styles.toolButton} ${selected ? styles.toolActive : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(selected ? null : definition.tool)}
    >
      <strong><Icon /> {definition.label}</strong>
      <small>{hint}</small>
    </button>
  );
};

const ColonyHUD = ({
  colony,
  base,
  human,
  generation,
  selectedTool,
  onSelectTool,
  onConvertSeeds,
  onDeliverContract,
  onRestart,
  onSetClockSpeed,
}) => {
  const [buildOpen, setBuildOpen] = useState(false);
  const [buildGroup, setBuildGroup] = useState(FACILITY_CATEGORIES.COLLECTION);

  if (!colony || !base) return null;

  const alerts = getColonyAlerts(colony);
  const latestLog = colony.log.at(-1);
  const potatoReady = base.potato?.status === POTATO_STATUS.READY;
  const activeDefinition = ALL_TOOLS.find(
    (definition) => definition.tool === selectedTool
  );
  const eligibleCount = selectedTool
    ? base.cells.filter((cell) => canApplyTool(colony, cell.id, selectedTool)).length
    : 0;
  const energyCap = getEnergyCap(base);
  const forecast = getFactoryForecast(base);
  const bottleneck = getFactoryBottleneck(base);
  const visibleBuildTools = buildTools.filter(
    (definition) => definition.spec.category === buildGroup
  );
  const chainState = CHAIN_STEPS.map((step) => {
    const facilities = base.cells.filter(
      (cell) => cell.facility?.type === step.type
    );
    return {
      ...step,
      built: facilities.some(
        (cell) => cell.facility.buildRemaining === 0
      ),
      running: facilities.some(
        (cell) => cell.facility.status === FACILITY_STATUS.RUNNING
      ),
      building: facilities.some(
        (cell) => cell.facility.status === FACILITY_STATUS.BUILDING
      ),
    };
  });

  const handleSelect = (tool) => {
    onSelectTool(tool);
    // 设施选中后立即把菜单收回，让发亮地块和建筑投影重新成为主体。
    // 继续常驻的菜单会迫使玩家隔着 UI 猜点击位置。
    setBuildOpen(false);
  };

  const unavailableSuffix = (() => {
    if (!selectedTool) return '';
    if (selectedTool === TOOL_MODES.PLANT && base.stores.seedStock < 1) {
      return '：种薯不足，先用「留种」转化';
    }

    const facilityType = TOOL_FACILITY[selectedTool];
    if (!facilityType) return '';
    const spec = FACILITY_SPECS[facilityType];
    if (base.stores.energy < spec.cost) return '：能量不足';
    if (spec.requiresCoreAdjacency) {
      return '：先开垦与培育管线相邻的工业格';
    }
    return '：先开垦符合设施区位的工业格';
  })();

  return (
    <>
      <div className={`${styles.hud} ${styles.topBar}`}>
        <ClockControls
          clock={colony.clock}
          disabled={Boolean(colony.outcome)}
          onSetSpeed={onSetClockSpeed}
        />
        <div className={styles.solCell}>
          <span>基地时钟</span>
          <strong>
            {colony.clock.started
              ? `SOL ${String(colony.sol).padStart(2, '0')}`
              : '等待指令'}
          </strong>
        </div>
        <div className={styles.resourceCell}>
          <span>块茎</span>
          <strong>{base.stores.tubers}</strong>
        </div>
        <div className={styles.resourceCell}>
          <span>种薯</span>
          <strong>{base.stores.seedStock}</strong>
        </div>

        {/* 超级土豆是全坑唯一的产出口，它的状态就是这局的进度条。
            体积（= 收获量）由养护质量决定，所以两者必须同时可见。 */}
        <div className={styles.potatoCell}>
          <span>超级土豆</span>
          {base.potato ? (
            <>
              <strong>
                {potatoReady ? '可收获' : `${Math.round(base.potato.growth)}%`}
              </strong>
              <div className={styles.potatoBars}>
                <i style={{ width: `${base.potato.growth}%` }} />
                <b style={{ width: `${base.potato.quality * 100}%` }} />
              </div>
              <small>预计 {getPotatoYield(base)} 颗 · 养护 {Math.round(base.potato.quality * 100)}%</small>
            </>
          ) : (
            <strong className={styles.potatoEmpty}>种植床空着</strong>
          )}
        </div>
        {alerts.length > 0 && (
          <div className={styles.alertStrip}>
            {alerts.map((alert) => (
              <b
                key={alert.kind}
                className={alert.kind === 'storm' ? styles.alertStorm : ''}
              >
                {alert.text}
              </b>
            ))}
          </div>
        )}
      </div>

      {/* 预测面板：净速率与「还能撑几个 SOL」 */}
      <div className={`${styles.hud} ${styles.forecast}`}>
        <RateRow
          label="水"
          stock={base.stores.water}
          cap={base.caps.water}
          income={forecast.water.income}
          drain={forecast.water.drain}
        />
        <RateRow
          label="能量"
          stock={base.stores.energy}
          cap={energyCap}
          income={forecast.energy.income}
          drain={forecast.energy.drain}
        />
        <RateRow
          label="矿物"
          stock={base.stores.minerals}
          cap={base.caps.minerals}
          income={forecast.minerals.income}
          drain={forecast.minerals.drain}
        />
        <RateRow
          label="营养"
          stock={base.stores.nutrients}
          cap={base.caps.nutrients}
          income={forecast.nutrients.income}
          drain={forecast.nutrients.drain}
        />
      </div>

      <div className={`${styles.hud} ${styles.factoryChain}`}>
        <div className={styles.chainSteps}>
          {chainState.map((step, index) => (
            <React.Fragment key={step.type}>
              <span
                className={`${styles.chainNode} ${
                  step.running ? styles.chainRunning
                    : step.building ? styles.chainBuilding
                      : step.built ? styles.chainStopped : ''
                }`}
              >
                {step.label}
              </span>
              {index < chainState.length - 1 && (
                <i className={styles.chainArrow}>→</i>
              )}
            </React.Fragment>
          ))}
          <i className={styles.chainArrow}>→</i>
          <span className={`${styles.chainNode} ${
            base.potato ? styles.chainRunning : ''
          }`}
          >
            土豆
          </span>
        </div>
        <strong className={styles.bottleneck}>{bottleneck.text}</strong>
      </div>

      <div className={`${styles.hud} ${styles.contracts}`}>
        {colony.contracts.map((contract) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            stock={base.stores[contract.resource]}
            sol={colony.sol}
            onDeliver={onDeliverContract}
          />
        ))}
      </div>

      {human && (
        <HumanMonitor human={human} generation={generation} />
      )}

      {latestLog && (
        <div className={`${styles.hud} ${styles.logLine}`}>
          <span>
            {colony.clock.started ? `SOL ${latestLog.sol}` : '整备'}
            {' · '}
            {latestLog.text}
          </span>
        </div>
      )}

      {!colony.clock.started && !activeDefinition && (
        <div className={`${styles.hud} ${styles.toolHint}`}>
          第一步：打开「建造」，选择采冰器，再点击坑外发亮的工业格。首个有效指令会启动基地时钟。
        </div>
      )}

      {activeDefinition && (
        <div className={`${styles.hud} ${styles.toolHint}`}>
          {eligibleCount > 0
            ? `已选「${activeDefinition.label}」— 点击坑外发亮的工业格执行（${eligibleCount} 格可用）`
            : `「${activeDefinition.label}」当前没有可用地块${unavailableSuffix}`}
        </div>
      )}

      {buildOpen && (
        <div className={`${styles.hud} ${styles.buildPalette}`}>
          <div className={styles.buildTabs} role="tablist" aria-label="设施分类">
            {BUILD_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={buildGroup === group.id}
                className={buildGroup === group.id ? styles.buildTabActive : ''}
                onClick={() => setBuildGroup(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>
          <div className={styles.buildOptions}>
            {visibleBuildTools.map((definition) => (
              <ToolButton
                key={definition.tool}
                definition={definition}
                selected={selectedTool === definition.tool}
                hint={`建造 ${definition.spec.cost} · ${definition.spec.buildSols} SOL · 维持 ${definition.spec.upkeep}/SOL`}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}

      <div className={`${styles.hud} ${styles.toolbar}`} role="toolbar" aria-label="基地工具">
        {directTools.map((definition) => (
          <ToolButton
            key={definition.tool}
            definition={definition}
            selected={selectedTool === definition.tool}
            hint={definition.tool === TOOL_MODES.HARVEST && potatoReady
              ? '超级土豆可收'
              : definition.hint}
            onSelect={handleSelect}
          />
        ))}

        <button
          type="button"
          className={`${styles.toolButton} ${buildOpen ? styles.toolActive : ''}`}
          aria-expanded={buildOpen}
          onClick={() => setBuildOpen((open) => !open)}
        >
          <strong><ApartmentOutlined /> 建造</strong>
          <small>{buildTools.length} 种设施 {buildOpen ? '▾' : '▴'}</small>
        </button>

        <div className={styles.convertCell}>
          <button
            type="button"
            className={styles.toolButton}
            disabled={base.stores.tubers < TUBERS_PER_SEED}
            onClick={() => onConvertSeeds(1)}
          >
            <strong><RestOutlined /> 留种</strong>
            <small>{TUBERS_PER_SEED} 块茎 → 1 种薯</small>
          </button>
        </div>
      </div>

      {colony.outcome && (
        <div className={`${styles.hud} ${styles.outcomeOverlay}`}>
          <div className={styles.outcomePanel}>
            <strong>
              {colony.outcome === COLONY_OUTCOMES.WON ? '基地站稳了' : '基地失败'}
            </strong>
            <p>
              {colony.outcome === COLONY_OUTCOMES.WON
                ? `SOL ${colony.sol}：全部合约按期交付。TOVER 联盟正在评估更大的委托。`
                : colony.lossReason === LOSS_REASONS.BLACKOUT
                  ? `SOL ${colony.sol}：连续断电，设施全部停转。反应堆养不起摊开的基地。`
                  : `SOL ${colony.sol}：合约违约。补给舱不会为一个不能交付的基地续航。`}
            </p>
            <button type="button" onClick={onRestart}>
              重建基地
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ColonyHUD;
