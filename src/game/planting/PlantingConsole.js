import React from 'react';
import {
  ALLOCATION_KEYS,
  canCompletePlantingCycle,
  getAllocatedTuberCount,
  getPlantingLayerOptions,
  INTERVENTIONS,
  PLANTING_STATUS,
  WATER_OPTIONS,
} from './plantingEngine';

const COLORS = Object.freeze({
  ink: '#562913',
  orange: '#F57435',
  pale: '#F2A888',
  active: '#FFE1D1',
  white: '#FFF5EE',
});

const allocationLabels = Object.freeze({
  seed: {
    label: '留种',
    detail: '延续下一代',
  },
  feed: {
    label: '食用',
    detail: '进入人体反馈',
  },
  dissect: {
    label: '解剖',
    detail: '揭示隐藏变化',
  },
  preserve: {
    label: '保存',
    detail: '建立血统退路',
  },
});

const consoleButtonStyle = {
  width: '100%',
  border: `1px solid ${COLORS.ink}`,
  background: 'rgba(242, 168, 136, 0.72)',
  color: COLORS.ink,
  padding: '10px 12px',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background 160ms ease, color 160ms ease',
};

const ChoiceButton = ({
  active,
  compact = false,
  label,
  hint,
  detail,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    style={{
      ...consoleButtonStyle,
      background: active ? COLORS.active : 'rgba(242, 168, 136, 0.52)',
      boxShadow: active ? `inset 3px 0 0 ${COLORS.ink}` : 'none',
    }}
  >
    <span style={{
      display: compact ? 'block' : 'flex',
      alignItems: compact ? undefined : 'baseline',
      justifyContent: compact ? undefined : 'space-between',
      gap: compact ? undefined : 12,
    }}>
      <strong style={{
        display: 'block',
        fontSize: 14,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </strong>
      <span style={{
        display: 'block',
        marginTop: compact ? 4 : 0,
        fontSize: compact ? 10 : 11,
        lineHeight: compact ? 1.35 : 'normal',
        opacity: 0.72,
      }}>
        {hint}
      </span>
    </span>
    {detail && (
      <span style={{
        display: 'block',
        marginTop: 4,
        fontSize: 11,
        lineHeight: 1.45,
        opacity: 0.72,
      }}>
        {detail}
      </span>
    )}
  </button>
);

const ActionButton = ({ children, onClick, disabled = false, secondary = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      border: `1px solid ${COLORS.ink}`,
      background: secondary ? 'transparent' : COLORS.ink,
      color: secondary ? COLORS.ink : COLORS.white,
      minHeight: 42,
      padding: '9px 14px',
      fontSize: 13,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.38 : 1,
      flex: 1,
    }}
  >
    {children}
  </button>
);

const SolTrack = ({ sol }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 4,
    margin: '12px 0 16px',
  }}>
    {[1, 2, 3, 4].map((item) => (
      <div key={item}>
        <div style={{
          height: 3,
          background: item <= sol ? COLORS.ink : 'rgba(86, 41, 19, 0.24)',
        }} />
        <div style={{
          marginTop: 5,
          fontSize: 10,
          opacity: item <= sol ? 1 : 0.46,
        }}>
          SOL {item}
        </div>
      </div>
    ))}
  </div>
);

const Metric = ({ label, value, suffix = '' }) => (
  <div style={{
    borderTop: `1px solid rgba(86, 41, 19, 0.48)`,
    paddingTop: 7,
  }}>
    <div style={{ fontSize: 10, opacity: 0.62 }}>{label}</div>
    <div style={{ fontSize: 18, lineHeight: 1.2 }}>
      {value}{suffix}
    </div>
  </div>
);

const ConfigurationStage = ({
  planting,
  selectedCrater,
  onConfigure,
  onStart,
}) => {
  const layerOptions = getPlantingLayerOptions(selectedCrater);

  return (
    <>
      <SectionLabel>选择坑内种植层</SectionLabel>
      <div style={{ display: 'grid', gap: 5 }}>
        {layerOptions.map((option) => (
          <ChoiceButton
            key={option.value}
            active={planting.config.layer === option.value}
            label={option.label}
            hint={option.hint}
            detail={option.detail}
            onClick={() => onConfigure('layer', option.value)}
          />
        ))}
      </div>

      <SectionLabel>分配本代水量</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 5,
      }}>
        {WATER_OPTIONS.map((option) => (
          <ChoiceButton
            key={option.value}
            active={planting.config.water === option.value}
            compact
            label={option.label}
            hint={option.hint}
            onClick={() => onConfigure('water', option.value)}
          />
        ))}
      </div>

      <p style={{
        fontSize: 11,
        lineHeight: 1.5,
        margin: '14px 0 10px',
        opacity: 0.7,
      }}>
        表层与少水会强化变化；深层与多水会保住产量。投入后本代将持续 4 个火星日。
      </p>

      <ActionButton onClick={onStart}>投入 2 颗种薯</ActionButton>
    </>
  );
};

const SectionLabel = ({ children }) => (
  <div style={{
    margin: '14px 0 7px',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.66,
  }}>
    {children}
  </div>
);

const GrowthStage = ({
  planting,
  onAdvance,
  onIntervention,
  onHarvest,
}) => {
  const needsIntervention = planting.sol === 2 && !planting.intervention;
  const canAdvance = planting.sol < 3 && !needsIntervention;

  return (
    <>
      <SolTrack sol={planting.sol} />

      <div style={{
        borderTop: `1px solid ${COLORS.ink}`,
        borderBottom: `1px solid ${COLORS.ink}`,
      }}>
        {planting.growthEvents.map((event, index) => (
          <div
            key={`${event.sol}-${event.kind}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '44px 1fr',
              gap: 8,
              padding: '9px 0',
              borderBottom: index < planting.growthEvents.length - 1
                ? '1px solid rgba(86, 41, 19, 0.22)'
                : 'none',
            }}
          >
            <strong style={{ fontSize: 11 }}>S{event.sol}</strong>
            <span style={{ fontSize: 12, lineHeight: 1.5 }}>{event.text}</span>
          </div>
        ))}
      </div>

      {needsIntervention && (
        <>
          <SectionLabel>根区受压，做一次干预</SectionLabel>
          <div style={{ display: 'grid', gap: 5 }}>
            <ChoiceButton
              active={false}
              label="固定根区"
              hint="保繁殖 · 降低变化"
              detail="稳定断裂根系，让更多芽眼保持可用。"
              onClick={() => onIntervention(INTERVENTIONS.STABILIZE)}
            />
            <ChoiceButton
              active={false}
              label="保留环境刺激"
              hint="强化变化 · 承担风险"
              detail="不消除压力，观察异常组织是否继续表达。"
              onClick={() => onIntervention(INTERVENTIONS.PRESERVE_EXPRESSION)}
            />
          </div>
        </>
      )}

      {planting.sol === 2 && planting.intervention && (
        <div style={{
          marginTop: 12,
          padding: '8px 10px',
          borderLeft: `3px solid ${COLORS.ink}`,
          background: 'rgba(255, 225, 209, 0.42)',
          fontSize: 12,
        }}>
          已执行：
          {planting.intervention === INTERVENTIONS.STABILIZE
            ? '固定根区'
            : '保留环境刺激'}
        </div>
      )}

      {canAdvance && (
        <div style={{ marginTop: 12, display: 'flex' }}>
          <ActionButton onClick={onAdvance}>
            观察 SOL {planting.sol + 1}
          </ActionButton>
        </div>
      )}

      {planting.sol === 3 && planting.safeHarvestPreview && (
        <>
          <SectionLabel>安全收获窗口</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
            marginBottom: 10,
          }}>
            <Metric label="预计块茎" value={planting.safeHarvestPreview.tuberCount} />
            <Metric label="稳定" value={planting.safeHarvestPreview.stability} />
            <Metric label="繁殖" value={planting.safeHarvestPreview.reproduction} />
          </div>
          <p style={{
            fontSize: 12,
            lineHeight: 1.5,
            margin: '0 0 10px',
          }}>
            现在收获更稳。继续等待会增加块茎和性状表达，也会损耗芽眼活性。
          </p>
          <div style={{ display: 'flex', gap: 7 }}>
            <ActionButton onClick={() => onHarvest(3)}>现在收获</ActionButton>
            <ActionButton secondary onClick={() => onHarvest(4)}>继续等待 1 SOL</ActionButton>
          </div>
        </>
      )}
    </>
  );
};

const AllocationStage = ({
  planting,
  onUpdateAllocation,
  onInspect,
  onComplete,
}) => {
  const result = planting.harvestResult;
  const allocated = getAllocatedTuberCount(planting);
  const remaining = result.tuberCount - allocated;
  const canComplete = canCompletePlantingCycle(planting);

  return (
    <>
      <SolTrack sol={planting.sol} />

      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        borderTop: `1px solid ${COLORS.ink}`,
        paddingTop: 10,
      }}>
        <div>
          <div style={{ fontSize: 10, opacity: 0.65 }}>本代收获</div>
          <div style={{ fontSize: 38, lineHeight: 1 }}>
            {result.tuberCount}
            <span style={{ fontSize: 12, marginLeft: 5 }}>颗块茎</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          <div>{result.sampleId}</div>
          <div style={{ opacity: 0.65 }}>SOL {result.harvestSol} 收获</div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 8,
        margin: '12px 0',
      }}>
        <Metric label="稳定" value={result.stability} />
        <Metric label="繁殖" value={result.reproduction} />
        <Metric label="环境表达" value={result.expression} />
      </div>

      <div style={{
        padding: '9px 10px',
        borderLeft: `3px solid ${COLORS.ink}`,
        background: 'rgba(255, 225, 209, 0.42)',
      }}>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>{result.phenomenon}</div>
        <div style={{ fontSize: 11, lineHeight: 1.45, marginTop: 5, opacity: 0.68 }}>
          代价：{result.cost}
        </div>
      </div>

      <div style={{ display: 'flex', marginTop: 8 }}>
        <ActionButton secondary onClick={onInspect}>
          查看 MRI 切面
        </ActionButton>
      </div>

      <SectionLabel>分配每一颗收获</SectionLabel>
      <div style={{ display: 'grid', gap: 4 }}>
        {ALLOCATION_KEYS.map((key) => {
          const item = allocationLabels[key];

          return (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 30px 26px 30px',
                gap: 5,
                alignItems: 'center',
                minHeight: 36,
                borderBottom: '1px solid rgba(86, 41, 19, 0.2)',
              }}
            >
              <div>
                <strong style={{ fontSize: 12 }}>{item.label}</strong>
                <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.6 }}>
                  {item.detail}
                </span>
              </div>
              <button
                type="button"
                aria-label={`减少${item.label}`}
                onClick={() => onUpdateAllocation(key, -1)}
                style={stepperButtonStyle}
              >
                -
              </button>
              <strong style={{ textAlign: 'center', fontSize: 13 }}>
                {planting.allocation[key]}
              </strong>
              <button
                type="button"
                aria-label={`增加${item.label}`}
                onClick={() => onUpdateAllocation(key, 1)}
                style={stepperButtonStyle}
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        margin: '9px 0',
        fontSize: 11,
        color: remaining === 0 ? COLORS.ink : '#8B1E10',
      }}>
        <span>已分配 {allocated} / {result.tuberCount}</span>
        <span>
          {remaining === 0 ? '全部块茎已有去向' : `尚有 ${remaining} 颗未分配`}
        </span>
      </div>

      <ActionButton disabled={!canComplete} onClick={onComplete}>
        {planting.allocation.seed > 0 ? '确认本代分配' : '至少保留 1 颗种薯'}
      </ActionButton>
    </>
  );
};

const stepperButtonStyle = {
  width: 30,
  height: 26,
  border: `1px solid ${COLORS.ink}`,
  background: 'transparent',
  color: COLORS.ink,
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};

const PlantingConsole = ({
  planting,
  selectedCrater,
  onConfigure,
  onStart,
  onAdvance,
  onIntervention,
  onHarvest,
  onUpdateAllocation,
  onInspect,
  onComplete,
}) => {
  if (!planting) return null;

  return (
    <>
      <style>{`
        .martover-planting-console {
          position: fixed;
          top: 92px;
          left: 20px;
          width: min(340px, calc(100vw - 40px));
          max-height: calc(100vh - 132px);
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .martover-planting-console {
            top: auto;
            bottom: 18px;
            left: 14px;
            width: calc(100vw - 28px);
            max-height: min(64vh, calc(100vh - 116px));
          }
        }
      `}</style>
      <aside
        className="martover-planting-console"
        data-planting-status={planting.status}
        data-planting-sol={planting.sol}
        style={{
          zIndex: 2400,
          color: COLORS.ink,
          background: COLORS.orange,
          backdropFilter: 'blur(8px)',
          border: `1px solid ${COLORS.ink}`,
          padding: 4,
          boxShadow: '0 12px 40px rgba(86, 41, 19, 0.12)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          border: `1px solid rgba(86, 41, 19, 0.58)`,
          padding: '13px 14px 14px',
          boxSizing: 'border-box',
          maxHeight: '100%',
          overflowY: 'auto',
        }}>
          <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1, opacity: 0.65 }}>
                MARTOVER / CULTIVATION
              </div>
              <h2 style={{
                fontSize: 20,
                lineHeight: 1.1,
                margin: '4px 0 0',
                fontWeight: 600,
              }}>
                G{planting.generation} 种植循环
              </h2>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, lineHeight: 1.5 }}>
              <div>{selectedCrater?.id || 'UNKNOWN'}</div>
              <div style={{ opacity: 0.6 }}>SOL {planting.sol} / 4</div>
            </div>
          </header>

          {planting.status === PLANTING_STATUS.CONFIGURATION && (
            <ConfigurationStage
              planting={planting}
              selectedCrater={selectedCrater}
              onConfigure={onConfigure}
              onStart={onStart}
            />
          )}

          {planting.status === PLANTING_STATUS.GROWTH && (
            <GrowthStage
              planting={planting}
              onAdvance={onAdvance}
              onIntervention={onIntervention}
              onHarvest={onHarvest}
            />
          )}

          {planting.status === PLANTING_STATUS.ALLOCATION && (
            <AllocationStage
              planting={planting}
              onUpdateAllocation={onUpdateAllocation}
              onInspect={onInspect}
              onComplete={onComplete}
            />
          )}
        </div>
      </aside>
    </>
  );
};

export default PlantingConsole;
