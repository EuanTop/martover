import { describe, expect, it } from 'vitest';
import { applyHumanFeeding, createHumanState } from './humanEngine';

describe('humanEngine', () => {
  it('turns a harvested trait into a benefit, cost, and persistent body change', () => {
    const baseline = createHumanState();
    const adapted = applyHumanFeeding(baseline, {
      generation: 1,
      dominantTrait: 'dormancy',
      expression: 84,
      stability: 76,
      originCraterId: '01-000001',
    });

    expect(adapted.lifespanYears).toBeGreaterThan(baseline.lifespanYears);
    expect(adapted.lastResponse.sensation).toBeTruthy();
    expect(adapted.lastResponse.cost).toBeTruthy();
    expect(adapted.lastResponse.bodyRegion).toBe('torso');
    expect(adapted.lastResponse.appliedDelta.lifespanYears).toBeGreaterThan(0);
    expect(adapted.adaptations).toHaveLength(1);
  });
});
