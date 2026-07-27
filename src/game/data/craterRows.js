// CSV 行 → 陨石坑对象的唯一归一化实现。
//
// 此前 useDataLoader.js 与 Data/CraterDataProvider.js 各有一份逐字节
// 相同的映射，其中一份改了列名另一份不会有任何报错。环境向量
// （deriveCraterEnvironment）直接吃这些字段，两份漂移会让同一个坑在
// 不同入口下算出不同的环境。

export const normalizeCraterRow = (row) => ({
  id: row.CRATER_ID,
  latitude: parseFloat(row.LAT_CIRC_IMG),
  longitude: parseFloat(row.LON_CIRC_IMG),
  diameter: parseFloat(row.DIAM_CIRC_IMG),
  diameterSD: parseFloat(row.DIAM_CIRC_SD_IMG),
  arc: parseFloat(row.ARC_IMG),
  layerNumber: parseInt(row.LAY_NUMBER),
  layerMorph: [row.LAY_MORPH1, row.LAY_MORPH2, row.LAY_MORPH3].filter(Boolean),
  layerNotes: row.LAY_NOTES,
  internalMorph: [row.INT_MORPH1].filter(Boolean),
  // 坑底形态（梯坎/冲沟/滑塌），供风暴遮蔽度 shelter 使用。
  floorMorph: [row.INT_MORPH2, row.INT_MORPH3].filter(Boolean),
  rimDegradation: row.DEG_RIM,
  ejectaDegradation: row.DEG_EJC,
  floorDegradation: row.DEG_FLR,
  // 以下几列此前未被读取。环境向量里 radiation / instability /
  // geologicalComplexity / layerDiversity 全部派生自 1-4 的小整数列，
  // 实测 101 个坑只散出 4-11 个不同值，坑与坑玩起来明显雷同。
  // 这几列在同样 101 个坑上分别有 101/101/60/30 个不同值。
  eccentricity: parseFloat(row.DIAM_ELLI_ECCEN_IMG),
  rimPoints: parseInt(row.PTS_RIM_IMG),
  lobeCount: parseInt(row.numLE_1),
  isRampart: row.isRampart_1 === '1' || row.isRampart_1 === 1,
  isCircle: row.isCircle_1 === '1' || row.isCircle_1 === 1,
  ejectaShape: row.ejc_shape_1,
  ejcSvg: [row.ejc_svg_1, row.ejc_svg_2, row.ejc_svg_3].filter(Boolean),
  hasRd: row.hasRd === '1' || row.hasRd === 1
    || row.hasRd === 'true' || row.hasRd === true,
});

// 缺经纬度的行无法投影到球面，直接丢弃。
export const hasUsableCoordinates = (crater) => (
  !Number.isNaN(crater.latitude) && !Number.isNaN(crater.longitude)
);

export const normalizeCraterRows = (rows) => rows
  .map(normalizeCraterRow)
  .filter(hasUsableCoordinates);
