import React, { useEffect } from 'react';
import {
  FastForwardOutlined,
  PauseOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import { SPEED_STEPS } from '../economy/colonyState';
import styles from './ClockControls.module.css';

// 时间控制。经营游戏的节奏必须由玩家的决策密度决定，而不是由
// 时钟强制的等待决定 —— 所以「跳到下一节点」和暂停是必需品，
// 不是便利功能。跳转停在决策点，因此等待可跳过、决策不会被跳过。
const ClockControls = ({ clock, onToggle, onSetSpeed, onSkip, disabled }) => {
  useEffect(() => {
    if (disabled) return undefined;

    const onKey = (event) => {
      // 输入框里不抢键。
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (event.code === 'Space') {
        event.preventDefault();
        onToggle();
      } else if (event.key >= '1' && event.key <= String(SPEED_STEPS.length)) {
        onSetSpeed(SPEED_STEPS[Number(event.key) - 1]);
      } else if (event.key === 'f' || event.key === 'F') {
        onSkip();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, onSetSpeed, onSkip, onToggle]);

  if (!clock) return null;

  return (
    <div className={styles.controls} role="group" aria-label="时间控制">
      <button
        type="button"
        className={styles.playButton}
        aria-label={clock.paused ? '继续' : '暂停'}
        aria-pressed={clock.paused}
        disabled={disabled}
        onClick={onToggle}
      >
        {clock.paused ? <CaretRightOutlined /> : <PauseOutlined />}
      </button>

      <div className={styles.speeds}>
        {SPEED_STEPS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={`${styles.speedButton} ${
              !clock.paused && clock.speed === speed ? styles.speedActive : ''
            }`}
            aria-pressed={!clock.paused && clock.speed === speed}
            disabled={disabled}
            onClick={() => onSetSpeed(speed)}
          >
            {speed}×
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.skipButton}
        disabled={disabled}
        onClick={onSkip}
        title="快进到下一个需要决策的时刻（F）"
      >
        <FastForwardOutlined /> 跳过
      </button>
    </div>
  );
};

export default ClockControls;
