// 育种逻辑与匹配算法

/**
 * 辅助函数：获取陨石坑属性值（兼容原始字段名和处理后字段名）
 */
const getCraterValue = (crater, originalKey, processedKey) => {
  if (!crater) return undefined;
  // 优先使用处理后的字段名，其次使用原始字段名
  return crater[processedKey] !== undefined ? crater[processedKey] : crater[originalKey];
};

/**
 * 1. 陨石坑 -> 环境因子映射
 * 根据陨石坑的物理属性，提取出环境影响因子
 * 支持原始字段名（CRATER_ID等）和处理后字段名（id等）
 */
export const getCraterInfluences = (crater) => {
  const influences = [];
  
  // 获取各属性值（兼容两种字段名）
  const craterId = getCraterValue(crater, 'CRATER_ID', 'id');
  const diameter = getCraterValue(crater, 'DIAM_CIRC_IMG', 'diameter');
  const latitude = getCraterValue(crater, 'LAT_CIRC_IMG', 'latitude');
  const longitude = getCraterValue(crater, 'LON_CIRC_IMG', 'longitude');
  const rimDeg = getCraterValue(crater, 'DEG_RIM', 'rimDegradation');
  const floorDeg = getCraterValue(crater, 'DEG_FLR', 'floorDegradation');
  const hasRd = getCraterValue(crater, 'hasRd', 'hasRd');
  // internalMorph 可能是数组或字符串
  const internalMorph = crater?.internalMorph || crater?.INT_MORPH1;
  const morph = Array.isArray(internalMorph) ? internalMorph[0] : internalMorph;
  
  const normalInfluence = {
      type: 'NORMAL',
      label: '标准',
      description: '典型的火星地表',
      color: '#FF722C', // 火星橙
      visualParams: { distort: 0.4, speed: 1.0, metalness: 0.5 },
      attributes: [
        { label: '陨石坑ID', value: craterId || 'UNKNOWN' },
        { label: '直径', value: diameter ? `${diameter.toFixed(1)} km` : '未知' },
        { label: '纬度', value: latitude ? `${latitude.toFixed(2)}°` : '未知' },
        { label: '经度', value: longitude ? `${longitude.toFixed(2)}°` : '未知' },
        { label: '边缘退化', value: rimDeg || '未知' },
        { label: '底部退化', value: floorDeg || '未知' }
      ]
  };

  if (!crater) return [normalInfluence];

  // 1. 射线坑 (Ray Crater) -> 强辐射环境
  if (hasRd === 1 || hasRd === true) {
    influences.push({
      type: 'MUTATION',
      label: '强辐射',
      description: '来自宇宙射线的洗礼',
      color: '#A020F0', // 紫色
      visualParams: { distort: 0.8, speed: 2.0, metalness: 0.2 },
      attributes: [
        { label: '射线坑', value: '是' },
        { label: '辐射强度', value: '极高' },
        { label: '变异概率', value: '+300%' },
        { label: '直径', value: diameter ? `${diameter.toFixed(1)} km` : '未知' },
        { label: '位置', value: latitude && longitude ? `${latitude.toFixed(1)}°, ${longitude.toFixed(1)}°` : '未知' },
        { label: '边缘状态', value: rimDeg ? `退化度 ${rimDeg}` : '未知' }
      ]
    });
  }

  // 2. 高纬度 (High Latitude) -> 极寒环境
  const lat = Math.abs(latitude || 0);
  if (lat > 45) {
    influences.push({
      type: 'COLD',
      label: '极寒',
      description: '永久冻土的考验',
      color: '#00BFFF', // 冰蓝
      visualParams: { distort: 0.2, speed: 0.5, metalness: 0.9 },
      attributes: [
        { label: '纬度', value: latitude ? `${latitude.toFixed(2)}°` : '未知' },
        { label: '地表温度', value: '-125°C' },
        { label: '水冰含量', value: '丰富' },
        { label: '直径', value: diameter ? `${diameter.toFixed(1)} km` : '未知' },
        { label: '生长期', value: '极长' },
        { label: '代谢率', value: '极低' }
      ]
    });
  }

  // 3. 复杂平底结构 (Complex Flat Floor) -> 稳定环境
  if (morph === 'CpxFF') {
    influences.push({
      type: 'STABILITY',
      label: '稳态',
      description: '温和的平原环境',
      color: '#32CD32', // 绿色
      visualParams: { distort: 0.3, speed: 0.8, metalness: 0.4 },
      attributes: [
        { label: '内部形态', value: '复杂平底' },
        { label: '地形坡度', value: '< 2°' },
        { label: '直径', value: diameter ? `${diameter.toFixed(1)} km` : '未知' },
        { label: '光照稳定性', value: '高' },
        { label: '水分流失', value: '低' },
        { label: '根系发育', value: '极佳' }
      ]
    });
  }

  // 4. 中央峰 (Central Peak) -> 矿物富集
  if (morph === 'CpxCPk' || morph === 'CpxCPt' || morph === 'CPk' || morph === 'CpxCpk') {
    influences.push({
      type: 'MINERAL',
      label: '矿脉',
      description: '深层地幔物质暴露',
      color: '#FFD700', // 金色
      visualParams: { distort: 0.5, speed: 1.2, metalness: 1.0 },
      attributes: [
        { label: '内部形态', value: morph },
        { label: '稀土元素', value: '富集' },
        { label: '直径', value: diameter ? `${diameter.toFixed(1)} km` : '未知' },
        { label: '微量元素', value: '超标' },
        { label: '土壤PH值', value: '碱性' },
        { label: '结晶度', value: '高' }
      ]
    });
  }

  // 5. 默认因子 (如果没有任何特殊属性)
  if (influences.length === 0) {
    influences.push(normalInfluence);
  }

  return influences;
};

/**
 * 2. 土豆 -> 属性分析
 * 分析土豆描述文本，推断其属性标签
 */
const analyzePotatoAffinity = (potato) => {
  const tags = new Set();
  const text = (potato.englishDescription + " " + potato.specialParamEn + " " + potato.specialParamDetailsEn).toLowerCase();

  // 突变类关键词 - 基于辐射、变异相关
  if (text.match(/mutation|radiation|variant|toxic|alien|strange|weird|glow|quantum|enhanced|boost|increase/)) {
    tags.add('MUTATION');
  }
  
  // 耐寒类关键词 - 基于低温、寒冷相关
  if (text.match(/cold|ice|frost|freeze|low temp|winter|hardy|snow|frozen|arctic/)) {
    tags.add('COLD');
  }
  
  // 巨大/稳态类关键词 - 基于生长、稳定相关
  if (text.match(/giant|large|huge|stable|yield|heavy|massive|growth|endurance|muscle|strength|recovery|metabolism/)) {
    tags.add('STABILITY');
  }
  
  // 矿物/硬度类关键词 - 基于矿物、金属相关
  if (text.match(/stone|rock|hard|mineral|crystal|metal|gold|iron|solid|bone|calcium|magnesium/)) {
    tags.add('MINERAL');
  }

  return tags;
};

/**
 * 3. 匹配排序算法
 * 根据环境因子对土豆列表进行排序，匹配度高的排前面
 */
export const sortPotatoesByInfluence = (potatoes, influences) => {
  if (!influences || influences.length === 0) return potatoes;

  // 获取主要影响因子类型
  const activeTypes = new Set(influences.map(inf => inf.type));

  // 为每个土豆打分
  const scoredPotatoes = potatoes.map(potato => {
    const affinityTags = analyzePotatoAffinity(potato);
    let score = 0;

    // 匹配积分
    activeTypes.forEach(type => {
      if (affinityTags.has(type)) {
        score += 10; // 强匹配
      }
    });

    // 加入少量随机性，避免每次完全一样，但保持高分在前
    score += Math.random() * 5;

    return { potato, score };
  });

  // 降序排列
  scoredPotatoes.sort((a, b) => b.score - a.score);

  return scoredPotatoes.map(item => item.potato);
};
