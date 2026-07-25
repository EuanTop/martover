import React from 'react';
import styles from './ProgressBar.module.css';

const steps = [
  "农业目标地选择",
  "土豆太空育种",
  "本土自动化生产"
];

const LIGHT_ORANGE = '#FFB38E';
const DARK_ORANGE = '#DA6C36';

export const progressNodeStyle = {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#DA6C36',
    border: '1.2px solid #fff',
    color: '#FFE4D7',
    fontSize: 18,
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 32px 0 rgba(0,0,0,0.10)',
    userSelect: 'none',
};

export default function ProgressBar({ currentStep = 0, isDarkMode = false }) {
  const nodeSize = 32;
  const containerHeight = 60;
  const lineTop = containerHeight / 4;
  const leftOffset = nodeSize / 2;
  const rightOffset = nodeSize / 2;

  return (
    <div className={styles.progressBar} style={{
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      width: 'min(420px, calc(100vw - 24px))',
      height: containerHeight,
      pointerEvents: 'none',
      background: 'none',
      padding: 0,
      boxShadow: 'none',
      borderRadius: 0,
      display: 'grid',
      gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
      gridTemplateRows: `${nodeSize}px 1fr`,
      rowGap: 6,
    }}>
      {/* 贯穿线 */}
      <div style={{
        position: 'absolute',
        top: lineTop,
        left: leftOffset,
        right: rightOffset,
        height: 6,
        background: DARK_ORANGE,
        borderRadius: 3,
        transform: 'translateY(-50%)',
        zIndex: 1,
      }} />
      {/* 节点和文字 */}
      {steps.map((label, idx) => {
        // 当前进度节点白色描边，其余黑色描边
        const isCurrent = idx + 1 === currentStep;
        return (
          <div key={label} style={{
            gridColumn: idx + 1,
            gridRow: '1 / 3',
            display: 'grid',
            gridTemplateRows: `${nodeSize}px 1fr`,
            rowGap: 6,
            alignItems: 'center',
            justifyItems: 'center',
            minWidth: 0,
            zIndex: 2,
          }}>
            <div style={{
              width: nodeSize,
              height: nodeSize,
              borderRadius: '50%',
              background: isCurrent ? DARK_ORANGE : '#F57435',
              border: `1.2px solid ${isCurrent ? '#fff' : (currentStep === 3 ? '#000' : (isDarkMode ? '#fff' : '#000'))}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              boxShadow: isDarkMode && isCurrent ? '0 0 15px rgba(255, 165, 0, 0.6)' : 'none',
            }}>
              <span style={{
                color: isCurrent ? "#FFFFFF" : (currentStep === 3 ? "#000" : (isDarkMode ? "#FFFFFF" : "#000")),
                fontSize: 18,
                userSelect: 'none',
                fontWeight: isCurrent ? 'bold' : 'normal',
              }}>{idx + 1}</span>
            </div>
            <div style={{
              color: isCurrent ? '#FFFFFF' : (currentStep === 3 ? '#F57435' : (isDarkMode ? '#FFFFFF' : '#000')),
              fontSize: 14,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontWeight: isCurrent ? 'bold' : 'normal',
              textShadow: isDarkMode ? '0 0 10px rgba(0,0,0,0.8)' : 'none',
            }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}
