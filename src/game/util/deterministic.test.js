import { describe, expect, it } from 'vitest';
import { clamp, seededUnit, signedNoise, stableHash } from './deterministic';

describe('deterministic', () => {
  // 这些数值锁定哈希契约。stableHash 决定全部模拟种子，
  // 一旦实现改动，同一个坑会在整局游戏中散出不同结果，
  // 而且不会有任何编译期或运行期报错。
  it('pins the hash contract so seeds stay reproducible', () => {
    expect(stableHash('16-1-000000')).toBe(stableHash('16-1-000000'));
    expect(stableHash('16-1-000000')).not.toBe(stableHash('16-1-000001'));
    expect(stableHash('')).toBe(2166136261);
    expect(Number.isInteger(stableHash('martover'))).toBe(true);
    expect(stableHash('martover')).toBeGreaterThanOrEqual(0);
    expect(stableHash('martover')).toBeLessThanOrEqual(4294967295);
  });

  it('keeps signedNoise on the "|" separator', () => {
    // genome.js 原实现用 "|"。换成 ":" 会静默改变每一个基因组数值。
    expect(signedNoise('seed', 'coldTolerance')).toBe(
      (stableHash('seed|coldTolerance') / 4294967295) * 2 - 1
    );
  });

  it('keeps seededUnit on the ":" separator', () => {
    expect(seededUnit('seed', 3)).toBe(stableHash('seed:3') / 4294967295);
  });

  it('spreads seededUnit across the unit interval', () => {
    const samples = Array.from(
      { length: 400 },
      (_, index) => seededUnit('crater', index)
    );

    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    // 均值应接近 0.5，偏离说明哈希分布有偏。
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.42);
    expect(mean).toBeLessThan(0.58);
  });

  it('clamps to the inclusive range', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(42, 0, 100)).toBe(42);
  });
});
