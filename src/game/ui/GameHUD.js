import React from 'react';
import {
  AimOutlined,
  ArrowDownOutlined,
  CloudOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FireOutlined,
  HeartOutlined,
  MoonOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  BREEDING_STAGES,
  canFeedHuman,
  GENERATION_LENGTH_SOLS,
  getCraterZoneOptions,
  getFailureRisk,
  getTuberAllocation,
  HARVEST_UNLOCK_SOL,
  INTERVENTION_EFFECTS,
  INTERVENTION_TYPES,
  TUBER_USES,
  VIEW_MODES,
} from '../simulation/breedingSimulation';
import { RUN_OUTCOMES } from '../session/gameSessionReducer';
import HumanFeedbackPanel from './HumanFeedbackPanel';
import styles from './GameHUD.module.css';

const useOptions = Object.freeze([
  {
    value: TUBER_USES.SEED,
    label: '留种',
    icon: DatabaseOutlined,
  },
  {
    value: TUBER_USES.FEED,
    label: '食用',
    icon: HeartOutlined,
  },
  {
    value: TUBER_USES.DISSECT,
    label: '解剖',
    icon: ExperimentOutlined,
  },
  {
    value: TUBER_USES.PRESERVE,
    label: '保存',
    icon: SafetyCertificateOutlined,
  },
]);

const zoneIcons = Object.freeze({
  rim: AimOutlined,
  shadow: MoonOutlined,
  floor: ArrowDownOutlined,
});

const StatusBar = ({ label, value }) => (
  <div className={styles.statusItem}>
    <span>{label}</span>
    <div className={styles.statusTrack}>
      <i style={{ width: `${value}%` }} />
    </div>
    <strong>{value}</strong>
  </div>
);

const InterventionButton = ({
  icon: Icon,
  type,
  effect,
  count,
  selected,
  onClick,
}) => (
  <button
    type="button"
    className={`${styles.toolButton} ${selected ? styles.selectedTool : ''}`}
    data-type={type}
    onClick={onClick}
    disabled={count <= 0}
    aria-pressed={selected}
    aria-label={`${effect.shortLabel}：${effect.label}。选择后点击坑内作用点确认。`}
  >
    <span className={styles.toolVisual}>
      <Icon />
    </span>
    <span className={styles.toolCopy}>
      <strong>{effect.shortLabel} · {effect.label}</strong>
      <small>{effect.hint}</small>
    </span>
    <span className={styles.toolAction}>
      {selected ? '点击作用点确认' : '选择工具'}
    </span>
    <b>{count}</b>
  </button>
);

// GameSessionContext value 每 tick 全量重建，而子组件没有 memo 屏障，
// 导致 3D 场景与全部 HUD 组件在每颗 SOL tick 时无条件重渲染。
// 纯展示组件包上 memo，让 diffing 只落在真正变化的 props 上。
const GrowthHUD = React.memo(function GrowthHUD({
  simulation,
  selectedIntervention,
  onSelectIntervention,
  onApplyIntervention,
  onHarvest,
}) {
  const latestEvent = simulation.events.at(-1);
  const harvestAvailable = simulation.sol >= HARVEST_UNLOCK_SOL;
  const activeZone = getCraterZoneOptions().find(
    (option) => option.value === simulation.zone
  );
  const selectedEffect = selectedIntervention
    ? INTERVENTION_EFFECTS[selectedIntervention]
    : null;

  return (
    <>
      <div className={styles.growthReadout}>
        <div className={styles.solReadout}>
          <span>GEN {simulation.generation}</span>
          <strong>SOL {String(simulation.sol).padStart(2, '0')}</strong>
          <small>/ {GENERATION_LENGTH_SOLS}</small>
        </div>
        <div className={styles.statusBars}>
          <StatusBar label="生长" value={simulation.growth} />
          <StatusBar label="活力" value={simulation.vigor} />
          <StatusBar label="压力" value={simulation.stress} />
          <StatusBar label="表达" value={simulation.expression} />
          {/* 绝收风险原本被计算但从不显示；既然绝收现在真的会发生，
              玩家需要在下一次干预前看到它。 */}
          <StatusBar label="绝收风险" value={getFailureRisk(simulation)} />
        </div>
      </div>

      <div className={styles.eventLine}>
        <span>{latestEvent?.text}</span>
        {harvestAvailable && (
          <button
            type="button"
            className={styles.primaryAction}
            onClick={onHarvest}
          >
            收获
          </button>
        )}
      </div>

      <div className={styles.interventionPanel}>
        {/* 确认干预原本只能点击 3D 作用点，键盘与读屏用户无法完成
            这一步。这里补一个等价的确认按钮，使整条流程可键盘操作。 */}
        {selectedEffect ? (
          <button
            type="button"
            className={styles.interventionConfirm}
            onClick={() => onApplyIntervention(selectedIntervention)}
            aria-label={
              `确认对${activeZone?.label || '种植区'}执行${selectedEffect.label}`
            }
          >
            <span>第 2 步 · 确认</span>
            <strong>{selectedEffect.label}</strong>
            <small>{selectedEffect.hint}</small>
          </button>
        ) : (
          <div className={styles.interventionTarget}>
            <span>操作流程</span>
            <strong>第 1 步 · 选工具</strong>
            <small>{activeZone?.label || '种植区'}等待作用</small>
          </div>
        )}
        <div className={styles.tools}>
          <InterventionButton
            icon={CloudOutlined}
            type={INTERVENTION_TYPES.WATER}
            effect={INTERVENTION_EFFECTS[INTERVENTION_TYPES.WATER]}
            count={simulation.resources.water}
            selected={selectedIntervention === INTERVENTION_TYPES.WATER}
            onClick={() => onSelectIntervention(
              selectedIntervention === INTERVENTION_TYPES.WATER
                ? null
                : INTERVENTION_TYPES.WATER
            )}
          />
          <InterventionButton
            icon={FireOutlined}
            type={INTERVENTION_TYPES.HEAT}
            effect={INTERVENTION_EFFECTS[INTERVENTION_TYPES.HEAT]}
            count={simulation.resources.heat}
            selected={selectedIntervention === INTERVENTION_TYPES.HEAT}
            onClick={() => onSelectIntervention(
              selectedIntervention === INTERVENTION_TYPES.HEAT
                ? null
                : INTERVENTION_TYPES.HEAT
            )}
          />
          <InterventionButton
            icon={SafetyCertificateOutlined}
            type={INTERVENTION_TYPES.SHIELD}
            effect={INTERVENTION_EFFECTS[INTERVENTION_TYPES.SHIELD]}
            count={simulation.resources.shield}
            selected={selectedIntervention === INTERVENTION_TYPES.SHIELD}
            onClick={() => onSelectIntervention(
              selectedIntervention === INTERVENTION_TYPES.SHIELD
                ? null
                : INTERVENTION_TYPES.SHIELD
            )}
          />
        </div>
      </div>
    </>
  );
});

const PlantingHUD = React.memo(function PlantingHUD({ craterId, onPlantInZone }) {
  return (
  <>
    <div className={styles.plantingLead}>
      <span>{craterId}</span>
      <strong>把这一代种在哪里？</strong>
      <small>越暴露，变化越强；越深入，血统越稳定。</small>
    </div>
    <div className={styles.zoneSelector}>
      {getCraterZoneOptions().map((option) => {
        const Icon = zoneIcons[option.value];

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onPlantInZone(option.value)}
          >
            <Icon />
            <strong>{option.label}</strong>
            <span>{option.hint}</span>
          </button>
        );
      })}
    </div>
  </>
  );
});

const AllocationHUD = React.memo(function AllocationHUD({
  simulation,
  selectedUse,
  onSelectUse,
  onAssignTuber,
  onFeedHuman,
}) {
  const allocation = getTuberAllocation(simulation);
  const assigned = simulation.tuberAssignments.filter(Boolean).length;

  return (
    <>
      <div className={styles.allocationLead}>
        <strong>
          {assigned}/{simulation.tuberAssignments.length}
        </strong>
        <span>先选择用途，再点击坑中的每颗块茎</span>
      </div>
      <div className={styles.useSelector}>
        {useOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={selectedUse === value ? styles.activeUse : ''}
            onClick={() => onSelectUse(value)}
          >
            <Icon />
            <span>{label}</span>
            <b>{allocation[value]}</b>
          </button>
        ))}
      </div>
      <div className={styles.tuberSelector} aria-label="本代收获块茎">
        {simulation.tuberAssignments.map((assignment, index) => (
          <button
            key={index}
            type="button"
            className={assignment ? styles.assignedTuber : ''}
            data-use={assignment || 'unassigned'}
            aria-label={`块茎 ${index + 1}${assignment ? `，已分配为${assignment}` : '，尚未分配'}`}
            onClick={() => onAssignTuber(index, selectedUse)}
          >
            <i />
            <span>{index + 1}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.primaryAction}
        disabled={!canFeedHuman(simulation)}
        onClick={onFeedHuman}
      >
        进入人体反馈
      </button>
    </>
  );
});

const FailureHUD = ({ simulation, preservedCount, onRecover }) => (
  <>
    <div className={styles.plantingLead}>
      <span>{simulation.harvestResult?.originCraterId}</span>
      <strong>
        {simulation.harvestResult?.sterile ? '品系不育' : '本代绝收'}
      </strong>
      <small>{simulation.events.at(-1)?.text}</small>
    </div>
    <div className={styles.failureActions}>
      <p>
        {preservedCount > 0
          ? `保存库中还有 ${preservedCount} 份样本，可以回退到上一个稳定品系。`
          : '没有保存样本可以回退，这条品系到此结束。'}
      </p>
      <button
        type="button"
        className={styles.primaryAction}
        onClick={onRecover}
      >
        {preservedCount > 0 ? '取出保存样本重新开始' : '结束本局'}
      </button>
    </div>
  </>
);

const GameHUD = ({
  viewMode,
  selectedCrater,
  simulation,
  human,
  generation,
  lineage,
  selectedUse,
  selectedIntervention,
  onSelectUse,
  onSelectIntervention,
  onPlantInZone,
  onApplyIntervention,
  onHarvest,
  onAssignTuber,
  onFeedHuman,
  onNextGeneration,
  preservedSamples = [],
  onRecover,
  outcome = RUN_OUTCOMES.ACTIVE,
}) => {
  // 本局结束优先于其他所有界面。
  if (outcome !== RUN_OUTCOMES.ACTIVE) {
    return (
      <div className={`${styles.hud} ${styles.promptHud}`}>
        <span>第 {generation} 代 · 本局结束</span>
        <strong>
          {outcome === RUN_OUTCOMES.HUMAN_LOST
            ? '受试者已无法继续接受反馈'
            : '品系已经断绝'}
        </strong>
        <small>
          共延续 {lineage.length} 代。
          {outcome === RUN_OUTCOMES.HUMAN_LOST
            ? '生命状态归零，或生理年龄超过了预计寿命。'
            : '没有可留种的块茎，也没有保存样本可以回退。'}
        </small>
      </div>
    );
  }

  if (viewMode === VIEW_MODES.PLANET && selectedCrater) return null;

  if (viewMode === VIEW_MODES.HUMAN) {
    return (
      <div className={`${styles.hud} ${styles.humanHud}`}>
        <HumanFeedbackPanel
          human={human}
          generation={generation}
          onNextGeneration={onNextGeneration}
        />
      </div>
    );
  }

  if (viewMode === VIEW_MODES.PLANET) {
    return (
      <div className={`${styles.hud} ${styles.promptHud}`}>
        <span>第 {generation} 代</span>
        <strong>
          {lineage.length === 0
            ? '旋转火星，选择一处陨石坑'
            : '为留种选择下一处环境'}
        </strong>
      </div>
    );
  }

  if (!simulation) return null;

  // 绝收或不育：本代没有块茎可分配，玩家必须依赖保存样本回退。
  if (simulation.stage === BREEDING_STAGES.FAILED) {
    return (
      <div className={`${styles.hud} ${styles.plantingHud}`}>
        <FailureHUD
          simulation={simulation}
          preservedCount={preservedSamples.length}
          onRecover={onRecover}
        />
      </div>
    );
  }

  if (simulation.stage === BREEDING_STAGES.PLANTING) {
    return (
      <div className={`${styles.hud} ${styles.plantingHud}`}>
        <PlantingHUD
          craterId={selectedCrater?.id}
          onPlantInZone={onPlantInZone}
        />
      </div>
    );
  }

  return (
    <div className={`${styles.hud} ${styles.actionHud}`}>
      {simulation.stage === BREEDING_STAGES.GROWING && (
        <GrowthHUD
          simulation={simulation}
          selectedIntervention={selectedIntervention}
          onSelectIntervention={onSelectIntervention}
          onApplyIntervention={onApplyIntervention}
          onHarvest={onHarvest}
        />
      )}
      {simulation.stage === BREEDING_STAGES.ALLOCATION && (
        <AllocationHUD
          simulation={simulation}
          selectedUse={selectedUse}
          onSelectUse={onSelectUse}
          onAssignTuber={onAssignTuber}
          onFeedHuman={onFeedHuman}
        />
      )}
    </div>
  );
};

export default GameHUD;
