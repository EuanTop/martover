import React from 'react';
import {
  CloudOutlined,
  ExperimentOutlined,
  FireOutlined,
  RestOutlined,
  SafetyCertificateOutlined,
  ScissorOutlined,
} from '@ant-design/icons';
import {
  canApplyTool,
  FACILITY_SPECS,
  FARM_OUTCOMES,
  getFarmAlerts,
  PLOT_STATUS,
  TOOL_MODES,
  TUBERS_PER_SEED,
} from '../economy/farmEconomy';
import styles from './FarmHUD.module.css';

const toolDefinitions = Object.freeze([
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
    tool: TOOL_MODES.BUILD_HARVESTER,
    label: '采冰器',
    hint: `能量 ${FACILITY_SPECS.harvester.cost} · 全基地 +3 水/SOL`,
    icon: CloudOutlined,
  },
  {
    tool: TOOL_MODES.BUILD_HEATER,
    label: '加热桩',
    hint: `能量 ${FACILITY_SPECS.heater.cost} · 生长 +40%`,
    icon: FireOutlined,
  },
  {
    tool: TOOL_MODES.BUILD_SHIELD,
    label: '遮蔽棚',
    hint: `能量 ${FACILITY_SPECS.shield.cost} · 免疫沙尘暴`,
    icon: SafetyCertificateOutlined,
  },
]);

const resourceDefinitions = Object.freeze([
  { key: 'water', label: '水', lowAt: 6 },
  { key: 'energy', label: '能量', lowAt: 5 },
  { key: 'tubers', label: '食用块茎', lowAt: -1 },
  { key: 'seedStock', label: '种薯', lowAt: 1 },
]);

const ContractCard = ({ contract, farm, onDeliver }) => {
  const stock = farm[contract.resource];
  const remaining = contract.deadlineSol - farm.sol;
  const progress = Math.min(1, stock / contract.amount);
  const deliverable = contract.status === 'open' && stock >= contract.amount;

  return (
    <div
      className={`${styles.contractCard} ${
        contract.status === 'done' ? styles.contractDone : ''
      }`}
    >
      <header>
        <strong>{contract.label}</strong>
        <span className={remaining <= 8 && contract.status === 'open'
          ? styles.deadlineNear
          : ''}
        >
          {contract.status === 'done' ? '已交付' : `剩 ${Math.max(0, remaining)} SOL`}
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

const FarmHUD = ({
  farm,
  selectedTool,
  onSelectTool,
  onConvertSeeds,
  onDeliverContract,
  onRestart,
}) => {
  if (!farm) return null;

  const alerts = getFarmAlerts(farm);
  const latestLog = farm.log.at(-1);
  const readyCount = farm.plots.filter(
    (plot) => plot.status === PLOT_STATUS.READY
  ).length;
  const activeToolDefinition = toolDefinitions.find(
    (definition) => definition.tool === selectedTool
  );
  const eligibleCount = selectedTool
    ? farm.plots.filter((plot) => canApplyTool(farm, plot.id, selectedTool)).length
    : 0;

  return (
    <>
      <div className={`${styles.hud} ${styles.topBar}`}>
        <div className={styles.solCell}>
          <span>基地时钟</span>
          <strong>SOL {String(farm.sol).padStart(2, '0')}</strong>
        </div>
        {resourceDefinitions.map(({ key, label, lowAt }) => (
          <div
            key={key}
            className={`${styles.resourceCell} ${
              farm[key] <= lowAt ? styles.resourceLow : ''
            }`}
          >
            <span>{label}</span>
            <strong>{farm[key]}</strong>
          </div>
        ))}
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

      <div className={`${styles.hud} ${styles.contracts}`}>
        {farm.contracts.map((contract) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            farm={farm}
            onDeliver={onDeliverContract}
          />
        ))}
      </div>

      {latestLog && (
        <div className={`${styles.hud} ${styles.logLine}`}>
          <span>SOL {latestLog.sol} · {latestLog.text}</span>
        </div>
      )}

      {activeToolDefinition && (
        <div className={`${styles.hud} ${styles.toolHint}`}>
          {eligibleCount > 0
            ? `已选「${activeToolDefinition.label}」— 点击坑内发亮的地块执行（${eligibleCount} 块可用）`
            : `「${activeToolDefinition.label}」当前没有可用地块${
              selectedTool === TOOL_MODES.PLANT && farm.seedStock < 1
                ? '：种薯不足，先用「留种」转化'
                : ''
            }`}
        </div>
      )}

      <div className={`${styles.hud} ${styles.toolbar}`} role="toolbar" aria-label="基地工具">
        {toolDefinitions.map(({ tool, label, hint, icon: Icon }) => (
          <button
            key={tool}
            type="button"
            className={`${styles.toolButton} ${
              selectedTool === tool ? styles.toolActive : ''
            }`}
            aria-pressed={selectedTool === tool}
            onClick={() => onSelectTool(selectedTool === tool ? null : tool)}
          >
            <strong><Icon /> {label}</strong>
            <small>
              {tool === TOOL_MODES.HARVEST && readyCount > 0
                ? `${readyCount} 块地待收`
                : hint}
            </small>
          </button>
        ))}
        <div className={styles.convertCell}>
          <button
            type="button"
            className={styles.toolButton}
            disabled={farm.tubers < TUBERS_PER_SEED}
            onClick={() => onConvertSeeds(1)}
          >
            <strong><RestOutlined /> 留种</strong>
            <small>{TUBERS_PER_SEED} 块茎 → 1 种薯</small>
          </button>
        </div>
      </div>

      {farm.outcome && (
        <div className={`${styles.hud} ${styles.outcomeOverlay}`}>
          <div className={styles.outcomePanel}>
            <strong>
              {farm.outcome === FARM_OUTCOMES.WON ? '基地站稳了' : '基地失败'}
            </strong>
            <p>
              {farm.outcome === FARM_OUTCOMES.WON
                ? `SOL ${farm.sol}：两份订单全部按期交付。TOVER 联盟正在评估更大的委托。`
                : `SOL ${farm.sol}：订单违约。补给舱不会为一个不能交付的基地续航。`}
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

export default FarmHUD;
