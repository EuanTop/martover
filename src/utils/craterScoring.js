// 陨石坑评分计算函数

// 结构复杂度 (0-100)
const calculateStructureScore = (crater) => {
  let score = 0;
  const layerNum = crater.layerNumber || 0;
  score += Math.min(layerNum * 15, 50);
  
  const morphScores = {
    'CpxFF': 50, 'CpxCMa': 45, 'CpxCpk': 40, 'CpxCpt': 35,
    'CpxPkRg': 35, 'CpxSuPt': 30, 'CpxUnc': 25, 'Bsn': 20, 'Smp': 10,
  };
  const morph = crater.internalMorph?.[0] || '';
  score += morphScores[morph] || 20;
  return Math.min(score, 100);
};

// 保存完好度 (0-100)
const calculatePreservationScore = (crater) => {
  const rimDeg = parseInt(crater.rimDegradation) || 2;
  const ejcDeg = parseInt(crater.ejectaDegradation) || 2;
  const flrDeg = parseInt(crater.floorDegradation) || 2;
  const avgDeg = (rimDeg + ejcDeg + flrDeg) / 3;
  return Math.round((4 - avgDeg) / 3 * 100);
};

// 水资源潜力 (0-100)
const calculateWaterScore = (crater) => {
  let score = 0;
  const absLat = Math.abs(crater.latitude || 0);
  if (absLat > 60) score += 50;
  else if (absLat > 45) score += 40;
  else if (absLat > 30) score += 25;
  else if (absLat > 15) score += 15;
  else score += 5;
  
  const morph = crater.internalMorph?.[0] || '';
  if (morph === 'CpxFF') score += 50;
  else if (morph === 'CpxCMa') score += 35;
  else if (morph?.startsWith('Cpx')) score += 25;
  else if (morph === 'Bsn') score += 20;
  else score += 10;
  return Math.min(score, 100);
};

// 矿物质丰富度 (0-100)
const calculateMineralScore = (crater) => {
  let score = 0;
  if (crater.hasRd) score += 60;
  const ejcDeg = parseInt(crater.ejectaDegradation) || 2;
  score += (4 - ejcDeg) * 13;
  return Math.min(score, 100);
};

// 建设空间 (0-100)
const calculateSpaceScore = (crater) => {
  let score = 0;
  const diameter = crater.diameter || 10;
  score += Math.min(Math.round(diameter * 0.8), 60);
  
  const morph = crater.internalMorph?.[0] || '';
  if (morph === 'CpxCMa') score += 40;
  else if (morph === 'CpxFF') score += 35;
  else if (morph === 'Bsn') score += 30;
  else if (morph?.startsWith('Cpx')) score += 20;
  else score += 10;
  return Math.min(score, 100);
};

// 计算所有维度分数
export const calculateCraterScores = (crater) => ({
  structure: calculateStructureScore(crater),
  preservation: calculatePreservationScore(crater),
  water: calculateWaterScore(crater),
  mineral: calculateMineralScore(crater),
  space: calculateSpaceScore(crater),
});

// 维度中文名
const dimensionNames = {
  structure: '结构', preservation: '保存', water: '水资源',
  mineral: '矿物', space: '空间',
};

// 生成文字评价
export const generateEvaluation = (scores, crater) => {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [highKey, highVal] = sorted[0];
  const [lowKey, lowVal] = sorted[sorted.length - 1];
  
  const advantages = {
    structure: '多层结构便于建造立体温室',
    preservation: '地质保存完好，土壤稳定',
    water: '高纬度位置增加水冰概率',
    mineral: '射线坑富含稀有元素',
    space: '宽阔空间适合大规模农业',
  };
  
  const cautions = {
    structure: '结构简单，温室选择有限',
    preservation: '退化较高，需加固处理',
    water: '低纬度水资源获取困难',
    mineral: '矿物质含量一般',
    space: '空间有限，适合小规模试验',
  };
  
  let text = '';
  if (highVal >= 70) text += `✦ ${advantages[highKey]}`;
  else if (highVal >= 50) text += `◆ ${dimensionNames[highKey]}表现良好`;
  
  if (lowVal < 40) text += `${text ? ' | ' : ''}⚠ ${cautions[lowKey]}`;
  
  // 特殊标记
  if (crater.hasRd) text += ' | ★射线坑：地质年轻，富含未风化矿物';
  if (crater.internalMorph?.[0] === 'CpxFF') text += ' | ★平底结构：地形平坦，利于设施建设';
  if (crater.internalMorph?.[0] === 'CpxCMa') text += ' | ★中央高原：温度较为稳定，适宜居住';
  
  return text || '综合条件适中';
};
