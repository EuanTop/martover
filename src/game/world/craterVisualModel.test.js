import { describe, expect, it } from 'vitest';
import {
  FLOOR_DEPTH,
  getCraterDisplayScale,
  getCraterHoleAngle,
  getCraterMountRadius,
  getCraterWorldRadius,
  PLAIN_OUTER,
  TERRAIN_BANDS,
  ZONE_BANDS,
} from './craterVisualModel';

const SIZES = [1.8, 3.14, 6, 19.37, 45];

describe('craterVisualModel', () => {
  it('keeps relative size differences visible', () => {
    // 旧标定 lerp(0.032, 0.056) 只有 1.75 倍差，101 个坑看起来一样大。
    const smallest = getCraterDisplayScale({ diameter: 1.8 });
    const largest = getCraterDisplayScale({ diameter: 45 });

    expect(largest / smallest).toBeGreaterThan(3.5);
  });

  it('grows monotonically with diameter', () => {
    const scales = SIZES.map((diameter) => getCraterDisplayScale({ diameter }));

    scales.forEach((scale, index) => {
      if (index === 0) return;
      expect(scale).toBeGreaterThan(scales[index - 1]);
    });
  });

  it('clamps unknown or absurd diameters', () => {
    expect(getCraterDisplayScale({})).toBeGreaterThan(0);
    expect(getCraterDisplayScale({ diameter: 0 }))
      .toBe(getCraterDisplayScale({ diameter: 1.8 }));
    expect(getCraterDisplayScale({ diameter: 9000 }))
      .toBe(getCraterDisplayScale({ diameter: 45 }));
  });

  it('rests every crater floor on the sphere and pierces a smaller hole', () => {
    // 球体是闭合不透明的：任何低于球面 1.0 的几何都会被遮挡（穿模）。
    // 坑底必须恰好落在球面上，凹陷感由球面开洞（discard）提供。
    // 洞要盖住坑体但严格小于延伸平原的外沿，否则平原边缘露缝。
    SIZES.forEach((diameter) => {
      const crater = { diameter };
      const scale = getCraterDisplayScale(crater);
      const mount = getCraterMountRadius(crater);
      const floor = mount - FLOOR_DEPTH * scale;
      const craterAngle = Math.asin(scale * 0.92);
      const plainAngle = Math.asin(scale * 0.92 * PLAIN_OUTER);

      expect(floor).toBeCloseTo(1, 10);
      expect(mount).toBeGreaterThan(1);
      expect(getCraterHoleAngle(crater)).toBeGreaterThan(craterAngle);
      expect(getCraterHoleAngle(crater)).toBeLessThan(plainAngle);
    });
  });

  it('keeps the crater footprint a plausible arc length', () => {
    // 世界半径换算到火星表面弧长，应当远小于半个半球。
    SIZES.forEach((diameter) => {
      const worldRadius = getCraterWorldRadius({ diameter });

      expect(worldRadius).toBeGreaterThan(0);
      expect(worldRadius).toBeLessThan(0.1);
    });
  });

  it('aligns each planting zone with its own terrain band', () => {
    // 旧实现 floor 区半径落在 0.519-0.663，按地形分带全在坑壁上，
    // 玩家选「坑底」时没有一株真的种在坑底。
    expect(ZONE_BANDS.floor.outer).toBeLessThan(TERRAIN_BANDS.floor);
    expect(ZONE_BANDS.shadow.inner).toBeGreaterThanOrEqual(TERRAIN_BANDS.floor);
    expect(ZONE_BANDS.shadow.outer).toBeLessThan(TERRAIN_BANDS.slope);
    expect(ZONE_BANDS.rim.inner).toBeGreaterThanOrEqual(TERRAIN_BANDS.slope);
    expect(ZONE_BANDS.rim.outer).toBeLessThan(TERRAIN_BANDS.rim);
  });

  it('keeps the three zone bands disjoint', () => {
    expect(ZONE_BANDS.floor.outer).toBeLessThan(ZONE_BANDS.shadow.inner);
    expect(ZONE_BANDS.shadow.outer).toBeLessThan(ZONE_BANDS.rim.inner);
  });
});
