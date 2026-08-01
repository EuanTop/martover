import React, { useEffect, useMemo, useState } from 'react';
import HumanFeedbackScene from './HumanFeedbackScene';
import styles from './GameHUD.module.css';

const phaseTimeline = Object.freeze([
  { phase: 'receiving', at: 0 },
  { phase: 'scanning', at: 1300 },
  { phase: 'reacting', at: 4500 },
  { phase: 'revealed', at: 7000 },
]);

const phaseLabels = Object.freeze({
  receiving: '样本接收',
  scanning: '全身扫描',
  reacting: '组织响应',
  revealed: '反馈完成',
});

const metricDefinitions = Object.freeze([
  {
    key: 'vitality',
    label: '生命状态',
    unit: '',
  },
  {
    key: 'biologicalAge',
    label: '生理年龄',
    unit: '岁',
    precision: 1,
  },
  {
    key: 'neuralClarity',
    label: '神经清晰',
    unit: '',
  },
  {
    key: 'metabolicLoad',
    label: '代谢负荷',
    unit: '',
  },
]);

const formatValue = (value, precision = 0) => (
  typeof value === 'number' ? value.toFixed(precision) : '--'
);

const formatDelta = (value, precision = 0) => {
  const rounded = Number((value || 0).toFixed(precision));

  if (!rounded) return '±0';
  return rounded > 0 ? `+${rounded}` : String(rounded);
};

const HumanFeedbackPanel = ({
  human,
  generation,
  onNextGeneration,
}) => {
  const [phase, setPhase] = useState('receiving');
  const response = human.lastResponse;
  const revealed = phase === 'revealed';
  const adaptationCount = human.adaptations.length;
  const currentAdaptation = human.adaptations.at(-1);
  const violations = human.violations || [];

  useEffect(() => {
    setPhase('receiving');
    const timers = phaseTimeline.slice(1).map(({ phase: nextPhase, at }) => (
      window.setTimeout(() => setPhase(nextPhase), at)
    ));

    return () => timers.forEach(window.clearTimeout);
  }, [generation, response?.trait]);

  const metrics = useMemo(() => (
    metricDefinitions.map((definition) => ({
      ...definition,
      value: human[definition.key],
      delta: response?.appliedDelta?.[definition.key] || 0,
    }))
  ), [human, response]);

  return (
    <div className={styles.humanPanel}>
      <header className={styles.humanHeader}>
        <div>
          <span>{human.name} · GEN {generation} · {human.condition.label}</span>
          <strong>人体生物反馈</strong>
        </div>
        <div className={styles.scanStatus} data-phase={phase}>
          <i />
          <span>{phaseLabels[phase]}</span>
        </div>
      </header>

      <div className={styles.humanViewport}>
        <HumanFeedbackScene human={human} phase={phase} />
        <div
          className={`${styles.scanLine} ${
            phase === 'scanning' ? styles.scanLineActive : ''
          }`}
        />
        <div className={styles.viewportTicks} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className={styles.sampleTag}>
          <span>{currentAdaptation?.originCraterId}</span>
          <strong>{response?.bodyLabel}</strong>
        </div>
        <div className={styles.adaptationCount}>
          累积响应 {String(adaptationCount).padStart(2, '0')}
        </div>
      </div>

      <div
        className={`${styles.humanOutcome} ${
          revealed ? styles.outcomeRevealed : ''
        }`}
        aria-live="polite"
      >
        <div className={styles.humanNarrative}>
          <span>主观体感</span>
          <strong>
            {revealed ? response?.sensation : '扫描正在沿身体纵轴推进。'}
          </strong>
          <p>{revealed ? response?.benefit : '等待组织反馈稳定。'}</p>
          <small>
            {revealed ? `代价：${response?.cost}` : '副作用尚未完成判读。'}
          </small>
        </div>

        <div className={styles.humanMetrics}>
          {metrics.map((metric) => (
            <div key={metric.key}>
              <span>{metric.label}</span>
              <strong>
                {revealed
                  ? formatValue(metric.value, metric.precision)
                  : '--'}
              </strong>
              <small>
                {revealed
                  ? `${formatDelta(metric.delta, metric.precision)}${metric.unit}`
                  : metric.unit}
              </small>
            </div>
          ))}
        </div>

        {revealed && violations.length > 0 && (
          <div className={styles.boundaryWarning} role="alert">
            <span>越界警告</span>
            <strong>{violations.map((item) => item.label).join('、')}</strong>
            <small>{violations.at(-1).detail}</small>
          </div>
        )}

        <button
          type="button"
          className={styles.primaryAction}
          disabled={!revealed}
          onClick={onNextGeneration}
        >
          带着留种返回火星
        </button>
      </div>
    </div>
  );
};

export default HumanFeedbackPanel;
