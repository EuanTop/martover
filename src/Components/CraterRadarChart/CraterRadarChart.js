import React from 'react';

const CraterRadarChart = ({ scores, size = 120, isDarkMode }) => {
  const dimensions = [
    { key: 'structure', label: '结构', angle: -90 },
    { key: 'water', label: '水资源', angle: -18 },
    { key: 'space', label: '空间', angle: 54 },
    { key: 'preservation', label: '保存', angle: 126 },
    { key: 'mineral', label: '矿物', angle: 198 },
  ];
  
  const center = size / 2;
  const maxRadius = size / 2 - 30; // 增加边距防止文字被截断
  
  const getPoint = (angle, value) => {
    const radius = (value / 100) * maxRadius;
    const rad = (angle * Math.PI) / 180;
    return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
  };
  
  const dataPoints = dimensions.map(d => getPoint(d.angle, scores[d.key] || 0));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  
  const gridLevels = [25, 50, 75, 100];
  const strokeColor = isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(86,41,19,0.15)';
  const textColor = isDarkMode ? 'white' : '#562913';
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 背景网格 */}
      {gridLevels.map(level => {
        const pts = dimensions.map(d => getPoint(d.angle, level));
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
        return <path key={level} d={path} fill="none" stroke={strokeColor} strokeWidth="1" />;
      })}
      
      {/* 轴线 */}
      {dimensions.map(d => {
        const end = getPoint(d.angle, 100);
        return <line key={d.key} x1={center} y1={center} x2={end.x} y2={end.y} stroke={strokeColor} strokeWidth="1" />;
      })}
      
      {/* 数据区域 */}
      <path d={dataPath} fill={isDarkMode ? 'rgba(255,114,44,0.35)' : 'rgba(255,114,44,0.45)'} stroke="#FFFFFF" strokeWidth="1.5" />
      
      {/* 数据点 */}
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#FFFFFF" />)}
      
      {/* 标签 */}
      {dimensions.map(d => {
        const lp = getPoint(d.angle, 125);
        return (
          <text key={d.key} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={textColor}>
            {d.label}
          </text>
        );
      })}
    </svg>
  );
};

export default CraterRadarChart;
