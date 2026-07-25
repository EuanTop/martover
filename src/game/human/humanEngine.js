const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const HUMAN_RESPONSE_STATES = Object.freeze({
  BASELINE: 'baseline',
  RECEIVING: 'receiving',
  ADAPTED: 'adapted',
});

export const createHumanState = () => ({
  responseState: HUMAN_RESPONSE_STATES.BASELINE,
  vitality: 58,
  lifespanYears: 74,
  neuralClarity: 52,
  tissueRepair: 46,
  metabolicLoad: 18,
  adaptations: [],
  lastResponse: null,
});

const RESPONSE_LIBRARY = Object.freeze({
  repair: {
    bodyRegion: 'chest',
    bodyLabel: '胸腔与受损组织',
    sensation: '胸腔先出现短暂灼热，随后旧伤附近的疼痛像被逐层调低。',
    benefit: '组织修复速度提高，细胞开始记住受损前的结构。',
    cost: '修复冲动不会自动停止，长期食用可能形成过度增生。',
    delta: {
      vitality: 10,
      lifespanYears: 3,
      tissueRepair: 20,
      neuralClarity: 0,
      metabolicLoad: 9,
    },
  },
  dormancy: {
    bodyRegion: 'torso',
    bodyLabel: '心肺与代谢系统',
    sensation: '心率缓慢下降，皮肤温度降低，但意识仍保持清醒。',
    benefit: '代谢进入可控休眠，预计寿命被显著拉长。',
    cost: '醒来后的数分钟里，近期记忆会出现轻微断层。',
    delta: {
      vitality: 6,
      lifespanYears: 12,
      tissueRepair: 4,
      neuralClarity: -5,
      metabolicLoad: -6,
    },
  },
  conductivity: {
    bodyRegion: 'neural',
    bodyLabel: '神经与末梢',
    sensation: '舌尖出现微弱金属味，随后四肢动作比意念更早半拍完成。',
    benefit: '神经信号传递更清晰，精细动作和反应速度提高。',
    cost: '强电磁环境会诱发无法主动压制的手指震颤。',
    delta: {
      vitality: 4,
      lifespanYears: 1,
      tissueRepair: 2,
      neuralClarity: 21,
      metabolicLoad: 7,
    },
  },
  orientation: {
    bodyRegion: 'head',
    bodyLabel: '前庭与空间感知',
    sensation: '闭上眼后，身体仍能感到火星地平线和重力方向。',
    benefit: '前庭系统形成内部导航感，失重环境中的定向能力提高。',
    cost: '接近大型旋转设备时，身体会同时感到两个互相冲突的方向。',
    delta: {
      vitality: 5,
      lifespanYears: 2,
      tissueRepair: 1,
      neuralClarity: 12,
      metabolicLoad: 5,
    },
  },
});

export const applyHumanFeeding = (human, harvestResult) => {
  if (!harvestResult?.dominantTrait) return human;

  const response = RESPONSE_LIBRARY[harvestResult.dominantTrait] || RESPONSE_LIBRARY.repair;
  const potency = clamp(harvestResult.expression / 100, 0.25, 1);
  const stability = clamp(harvestResult.stability / 100, 0.2, 1);
  const scaleDelta = (value) => Math.round(value * potency * (value < 0 ? 1 : stability));
  const appliedDelta = Object.fromEntries(
    Object.entries(response.delta).map(([key, value]) => [
      key,
      scaleDelta(value),
    ])
  );
  const adaptation = {
    generation: harvestResult.generation,
    trait: harvestResult.dominantTrait,
    benefit: response.benefit,
    cost: response.cost,
    originCraterId: harvestResult.originCraterId,
  };

  return {
    ...human,
    responseState: HUMAN_RESPONSE_STATES.ADAPTED,
    vitality: clamp(human.vitality + appliedDelta.vitality, 0, 100),
    lifespanYears: clamp(
      human.lifespanYears + appliedDelta.lifespanYears,
      0,
      180
    ),
    neuralClarity: clamp(
      human.neuralClarity + appliedDelta.neuralClarity,
      0,
      100
    ),
    tissueRepair: clamp(
      human.tissueRepair + appliedDelta.tissueRepair,
      0,
      100
    ),
    metabolicLoad: clamp(
      human.metabolicLoad + appliedDelta.metabolicLoad,
      0,
      100
    ),
    adaptations: [...human.adaptations, adaptation],
    lastResponse: {
      ...response,
      trait: harvestResult.dominantTrait,
      potency: Math.round(potency * 100),
      stability: harvestResult.stability,
      appliedDelta,
    },
  };
};

export const getHumanBreedingModifier = (human) => {
  const repairBenefit = Math.max(0, human.tissueRepair - 46) * 0.12;
  const overloadCost = Math.max(0, human.metabolicLoad - 30) * 0.16;

  return {
    observation: Math.round(clamp(
      (human.neuralClarity - 50) * 0.18,
      -10,
      14
    )),
    stability: Math.round(clamp(repairBenefit - overloadCost, -12, 12)),
    description: overloadCost > repairBenefit
      ? '受试者代谢负荷正在压缩本代安全培育窗口。'
      : '受试者的组织反馈提高了本代异常识别能力。',
  };
};
