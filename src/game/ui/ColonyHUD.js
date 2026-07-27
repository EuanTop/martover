import React, { useState } from 'react';
import {
  ApartmentOutlined,
  BulbOutlined,
  CloudOutlined,
  DeleteOutlined,
  ExperimentOutlined,
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
  getWaterDrain,
  getWaterIncome,
} from '../economy/colonyEconomy';
import {
  CLEAR_COST,
  COLONY_OUTCOMES,
  CROP_STATUS,
  FACILITY_SPECS,
  LOSS_REASONS,
  TOOL_FACILITY,
  TOOL_MODES,
  TUBERS_PER_SEED,
} from '../economy/colonyState';
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
    tool: TOOL_MODES.DEMOLISH,
    label: '拆除',
    hint: '返还一半能量',
    icon: DeleteOutlined,
  },
]);

const buildIcons = Object.freeze({
  [TOOL_MODES.BUILD_EXTRACTOR]: CloudOutlined,
  [TOOL_MODES.BUILD_SOLAR]: BulbOutlined,
  [TOOL_MODES.BUILD_BATTERY]: ThunderboltOutlined,
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
  selectedTool,
  onSelectTool,
  onConvertSeeds,
  onDeliverContract,
  onRestart,
}) => {
  const [buildOpen, setBuildOpen] = useState(false);

  if (!colony || !base) return null;

  const alerts = getColonyAlerts(colony);
  const latestLog = colony.log.at(-1);
  const readyCount = base.cells.filter(
    (cell) => cell.crop?.status === CROP_STATUS.READY
  ).length;
  const activeDefinition = ALL_TOOLS.find(
    (definition) => definition.tool === selectedTool
  );
  const eligibleCount = selectedTool
    ? base.cells.filter((cell) => canApplyTool(colony, cell.id, selectedTool)).length
    : 0;
  const energyCap = getEnergyCap(base);
  const upkeep = base.cells.reduce(
    (total, cell) => (
      cell.facility ? total + FACILITY_SPECS[cell.facility.type].upkeep : total
    ),
    0
  );

  const handleSelect = (tool) => {
    onSelectTool(tool);
    if (tool && TOOL_FACILITY[tool]) return;
    setBuildOpen(false);
  };

  return (
    <>
      <div className={`${styles.hud} ${styles.topBar}`}>
        <div className={styles.solCell}>
          <span>基地时钟</span>
          <strong>SOL {String(colony.sol).padStart(2, '0')}</strong>
        </div>
        <div className={styles.resourceCell}>
          <span>块茎</span>
          <strong>{base.stores.tubers}</strong>
        </div>
        <div className={styles.resourceCell}>
          <span>种薯</span>
          <strong>{base.stores.seedStock}</strong>
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
          income={base.facilitiesIdle ? 0 : getWaterIncome(base)}
          drain={getWaterDrain(base)}
        />
        <RateRow
          label="能量"
          stock={base.stores.energy}
          cap={energyCap}
          income={base.facilitiesIdle ? 0 : 6}
          drain={upkeep}
        />
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

      {latestLog && (
        <div className={`${styles.hud} ${styles.logLine}`}>
          <span>SOL {latestLog.sol} · {latestLog.text}</span>
        </div>
      )}

      {activeDefinition && (
        <div className={`${styles.hud} ${styles.toolHint}`}>
          {eligibleCount > 0
            ? `已选「${activeDefinition.label}」— 点击坑内发亮的地块执行（${eligibleCount} 格可用）`
            : `「${activeDefinition.label}」当前没有可用地块${
              selectedTool === TOOL_MODES.PLANT && base.stores.seedStock < 1
                ? '：种薯不足，先用「留种」转化'
                : ''
            }`}
        </div>
      )}

      {buildOpen && (
        <div className={`${styles.hud} ${styles.buildPalette}`}>
          {buildTools.map((definition) => (
            <ToolButton
              key={definition.tool}
              definition={definition}
              selected={selectedTool === definition.tool}
              hint={`能量 ${definition.spec.cost} · 维持 ${definition.spec.upkeep}/SOL — ${definition.spec.hint}`}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      <div className={`${styles.hud} ${styles.toolbar}`} role="toolbar" aria-label="基地工具">
        {directTools.map((definition) => (
          <ToolButton
            key={definition.tool}
            definition={definition}
            selected={selectedTool === definition.tool}
            hint={definition.tool === TOOL_MODES.HARVEST && readyCount > 0
              ? `${readyCount} 格待收`
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
