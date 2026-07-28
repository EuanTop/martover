import React, { useEffect } from 'react';
import { SPEED_STEPS } from '../economy/colonyState';
import styles from './ClockControls.module.css';

const ClockControls = ({ clock, onSetSpeed, disabled }) => {
  useEffect(() => {
    if (disabled) return undefined;

    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (event.key >= '1' && event.key <= String(SPEED_STEPS.length)) {
        onSetSpeed(SPEED_STEPS[Number(event.key) - 1]);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, onSetSpeed]);

  if (!clock) return null;

  return (
    <div className={styles.controls} role="group" aria-label="研发调试倍速">
      <span className={styles.debugLabel}>DEBUG</span>
      <div className={styles.speeds}>
        {SPEED_STEPS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={`${styles.speedButton} ${
              clock.speed === speed ? styles.speedActive : ''
            }`}
            aria-pressed={clock.speed === speed}
            disabled={disabled}
            onClick={() => onSetSpeed(speed)}
          >
            {speed}×
          </button>
        ))}
      </div>
    </div>
  );
};

export default ClockControls;
