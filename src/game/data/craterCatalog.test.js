import { describe, expect, it } from 'vitest';
import { GAME_CONTENT_LIMITS } from '../config/gameConfig';
import { createCraterCatalog } from './craterCatalog';

describe('createCraterCatalog', () => {
  it('exposes the same 101 craters to every crater view', () => {
    const allCraters = Array.from({ length: 710 }, (_, index) => ({ id: index + 1 }));
    const catalog = createCraterCatalog(allCraters);

    expect(catalog.available).toHaveLength(GAME_CONTENT_LIMITS.availableCraters);
    expect(catalog.available[0]).toBe(allCraters[0]);
    expect(catalog.available[100]).toBe(allCraters[100]);
    expect(catalog.totalCount).toBe(710);
  });
});
