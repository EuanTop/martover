const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const HUMAN_RESPONSE_STATES = Object.freeze({
  BASELINE: 'baseline',
  RECEIVING: 'receiving',
  ADAPTED: 'adapted',
});

// 每名人物至少具备病症、愿望与身体边界（策划 §11）。
export const createHumanState = () => ({
  responseState: HUMAN_RESPONSE_STATES.BASELINE,
  name: 'P-017',
  vitality: 58,
  biologicalAge: 46.2,
  lifespanYears: 74,
  neuralClarity: 52,
  tissueRepair: 46,
  metabolicLoad: 18,
  condition: {
    key: 'marrow-collapse',
    label: '骨髓崩坏 III',
    detail: '造血组织持续衰退，对辐射与代谢负荷格外敏感。',
  },
  wish: {
    label: '再看一次地球的海。',
    detail: '受试者愿意承担风险，但拒绝失去清醒的意识。',
  },
  // 身体边界：越过任一条即造成不可逆损伤。
  boundary: {
    metabolicLoad: 78,
    neuralClarity: 24,
    biologicalAge: 68,
  },
  adaptations: [],
  violations: [],
  lastResponse: null,
});

// 每代衰减（策划 §9：生命状态 -8、生理年龄 +0.3）。
export const GENERATION_DECAY = Object.freeze({
  vitality: -8,
  biologicalAge: 0.3,
  tissueRepair: -3,
  neuralClarity: -2,
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
      neuralClarity: -4,
      metabolicLoad: 14,
      biologicalAge: 0.6,
    },
  },
  dormancy: {
    bodyRegion: 'torso',
    bodyLabel: '心肺与代谢系统',
    sensation: '心率缓慢下降，皮肤温度降低，但意识仍保持清醒。',
    benefit: '代谢进入可控休眠，预计寿命被显著拉长。',
    cost: '醒来后的数分钟里，近期记忆会出现轻微断层。',
    delta: {
      vitality: -3,
      lifespanYears: 12,
      tissueRepair: 4,
      neuralClarity: -9,
      metabolicLoad: -6,
      biologicalAge: -0.4,
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
      lifespanYears: -2,
      tissueRepair: -5,
      neuralClarity: 21,
      metabolicLoad: 13,
      biologicalAge: 0.9,
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
      metabolicLoad: 11,
      biologicalAge: 0.5,
    },
  },
  shielding: {
    bodyRegion: 'torso',
    bodyLabel: '皮层与造血组织',
    sensation: '皮肤下出现一层持续的凉意，强光下瞳孔收缩得更慢。',
    benefit: '抗氧化储备上升，辐射造成的累积损伤被显著推迟。',
    cost: '同一套机制也压低了造血速度，伤口愈合变慢。',
    delta: {
      vitality: 7,
      lifespanYears: 5,
      tissueRepair: -7,
      neuralClarity: -2,
      metabolicLoad: 4,
      biologicalAge: -0.2,
    },
  },
  perception: {
    bodyRegion: 'neural',
    bodyLabel: '感知皮层',
    sensation: '房间里所有细微的声音同时变得清楚，且无法被忽略。',
    benefit: '感知分辨率提高，能读出环境中过去察觉不到的变化。',
    cost: '感官过载无法主动关闭，睡眠被持续切碎。',
    delta: {
      vitality: -5,
      lifespanYears: -1,
      tissueRepair: 0,
      neuralClarity: 18,
      metabolicLoad: 15,
      biologicalAge: 0.8,
    },
  },
  regulation: {
    bodyRegion: 'torso',
    bodyLabel: '内分泌轴',
    sensation: '体温和情绪在几分钟内自行回到某个固定的基准点。',
    benefit: '内分泌调节收敛，代谢负荷被主动压低。',
    cost: '情绪幅度同时被削平，愉悦与恐惧都变得遥远。',
    delta: {
      vitality: 6,
      lifespanYears: 4,
      tissueRepair: 3,
      neuralClarity: -6,
      metabolicLoad: -11,
      biologicalAge: -0.3,
    },
  },
  vigor: {
    bodyRegion: 'chest',
    bodyLabel: '心肌与骨骼肌',
    sensation: '静息心率上升，肌肉像被持续预热，无法完全放松。',
    benefit: '代谢输出提高，体力恢复速度明显加快。',
    cost: '整套系统一直在高转速运行，器官磨损随之加速。',
    delta: {
      vitality: 14,
      lifespanYears: -5,
      tissueRepair: 6,
      neuralClarity: 1,
      metabolicLoad: 18,
      biologicalAge: 1.4,
    },
  },
});

export const applyHumanFeeding = (human, harvestResult, feedCount = 1) => {
  if (!harvestResult?.dominantTrait) return human;

  const response = RESPONSE_LIBRARY[harvestResult.dominantTrait] || RESPONSE_LIBRARY.repair;
  // 食用数量放大反馈强度：收益与代价同时被放大，不能靠多吃单方面获利。
  const dose = clamp(feedCount / 2, 0.5, 2.4);
  const potency = clamp((harvestResult.expression / 100) * dose, 0.25, 1.6);
  const stability = clamp(harvestResult.stability / 100, 0.2, 1);
  // 负向增量不被 stability 削弱，因此代价永远足额生效。
  const scaleDelta = (value) => (
    value < 0
      ? value * potency
      : value * potency * stability
  );
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

  const next = {
    ...human,
    responseState: HUMAN_RESPONSE_STATES.ADAPTED,
    vitality: clamp(human.vitality + appliedDelta.vitality, 0, 100),
    biologicalAge: clamp(
      human.biologicalAge + (appliedDelta.biologicalAge || 0),
      12,
      120
    ),
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
      feedCount,
    },
  };

  return {
    ...next,
    violations: getBoundaryViolations(next),
  };
};

// 越过身体边界即记录不可逆损伤（策划 §11）。
export const getBoundaryViolations = (human) => {
  const violations = [];

  if (human.metabolicLoad >= human.boundary.metabolicLoad) {
    violations.push({
      key: 'metabolicLoad',
      label: '代谢负荷越界',
      detail: '器官在持续超载下运行，损伤不可逆。',
    });
  }

  if (human.neuralClarity <= human.boundary.neuralClarity) {
    violations.push({
      key: 'neuralClarity',
      label: '意识清晰度越界',
      detail: '受试者明确拒绝失去清醒意识，这条已被越过。',
    });
  }

  if (human.biologicalAge >= human.boundary.biologicalAge) {
    violations.push({
      key: 'biologicalAge',
      label: '生理年龄越界',
      detail: '组织老化速度已超过修复速度。',
    });
  }

  return violations;
};

// 每代衰减在返回星球前结算，因此受试者不会只因喂食而单调变好。
export const advanceHumanGeneration = (human) => {
  const next = {
    ...human,
    vitality: clamp(human.vitality + GENERATION_DECAY.vitality, 0, 100),
    biologicalAge: clamp(
      human.biologicalAge + GENERATION_DECAY.biologicalAge,
      12,
      120
    ),
    tissueRepair: clamp(
      human.tissueRepair + GENERATION_DECAY.tissueRepair,
      0,
      100
    ),
    neuralClarity: clamp(
      human.neuralClarity + GENERATION_DECAY.neuralClarity,
      0,
      100
    ),
  };

  return {
    ...next,
    violations: getBoundaryViolations(next),
  };
};

export const isHumanAlive = (human) => (
  human.vitality > 0 && human.biologicalAge < human.lifespanYears
);

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
