import { describe, expect, it } from 'vitest';
import {
  applyTraitChoice,
  createBaseGenome,
  deriveGenomeReadout,
  getExpressedTrait,
  isSterile,
  mutateGenome,
  resolveTraitSlots,
  STERILITY_THRESHOLD,
  TRAIT_SLOT_COUNT,
} from './genome';
import { deriveCraterEnvironment } from '../planting/plantingEngine';

const crater = {
  id: '16-1-008565',
  latitude: -61.11,
  longitude: 100,
  diameter: 19.37,
  layerNumber: 3,
  internalMorph: ['CpxCPt'],
  rimDegradation: 4,
  ejectaDegradation: 3,
  floorDegradation: 4,
  hasRd: false,
};

const environment = deriveCraterEnvironment(crater);

const breed = (zone, generations, options = {}) => {
  let genome = createBaseGenome();
  const history = [];

  for (let generation = 1; generation <= generations; generation += 1) {
    genome = mutateGenome(genome, {
      environment,
      zone,
      harvestSol: options.harvestSol ?? 18,
      generationLength: 30,
      interventions: options.interventions ?? [],
      seed: `${crater.id}|${generation}|${zone}`,
    });
    history.push(deriveGenomeReadout(genome));
  }

  return { genome, history };
};

describe('genome', () => {
  it('keeps drifting instead of settling on a fixed point', () => {
    // The previous implementation inherited via `58 + parent * 0.22`, a
    // contraction that froze every lineage by the third generation.
    const { history } = breed('shadow', 8);
    const third = history[2];
    const eighth = history[7];

    expect(eighth.expression).not.toBe(third.expression);
    expect(Math.abs(eighth.expression - third.expression)).toBeGreaterThan(8);

    const laterExpressions = history.slice(3).map((row) => row.expression);
    expect(new Set(laterExpressions).size).toBeGreaterThan(3);
  });

  it('sends each planting zone somewhere different', () => {
    const rim = breed('rim', 8).history.at(-1);
    const floor = breed('floor', 8).history.at(-1);

    // The rim trades reproduction away for expression; the floor does the
    // opposite. Both must stay distinguishable after eight generations.
    expect(rim.expression).toBeGreaterThan(floor.expression);
    expect(floor.reproduction).toBeGreaterThan(rim.reproduction);
  });

  it('drives the rim route into sterility', () => {
    const { genome } = breed('rim', 8);

    expect(isSterile(genome)).toBe(true);
  });

  it('keeps the sheltered floor route fertile', () => {
    const { genome } = breed('floor', 8);

    expect(isSterile(genome)).toBe(false);
    expect(genome.mutationLoad).toBeLessThan(STERILITY_THRESHOLD);
  });

  it('separates outcomes by harvest time in the same crater', () => {
    const early = breed('shadow', 3, { harvestSol: 18 }).history.at(-1);
    const late = breed('shadow', 3, { harvestSol: 30 }).history.at(-1);

    expect(late.expression).toBeGreaterThan(early.expression);
    expect(late.reproduction).toBeLessThan(early.reproduction);
  });

  it('lets interventions redirect the lineage', () => {
    const plain = breed('shadow', 4).genome;
    const shielded = breed('shadow', 4, {
      interventions: [{ type: 'shield', sol: 6 }, { type: 'shield', sol: 12 }],
    }).genome;

    expect(shielded.mutationStability).toBeGreaterThan(plain.mutationStability);
    expect(shielded.mutationLoad).toBeLessThan(plain.mutationLoad);
  });

  it('is deterministic for identical inputs', () => {
    expect(breed('shadow', 5).genome).toEqual(breed('shadow', 5).genome);
  });

  it('reports a conflict instead of silently dropping a fourth trait', () => {
    const full = ['repair', 'dormancy', 'conductivity'];
    const resolved = resolveTraitSlots(full, 'orientation');

    expect(resolved.traits).toEqual(full);
    expect(resolved.conflict).toEqual({
      incomingTrait: 'orientation',
      candidates: full,
    });

    const chosen = applyTraitChoice(full, 'orientation', 'dormancy');
    expect(chosen).toEqual(['repair', 'orientation', 'conductivity']);
    expect(chosen).toHaveLength(TRAIT_SLOT_COUNT);
  });

  it('fills empty slots without raising a conflict', () => {
    const resolved = resolveTraitSlots(['repair'], 'dormancy');

    expect(resolved.traits).toEqual(['repair', 'dormancy']);
    expect(resolved.conflict).toBeNull();
  });

  it('expresses the trait of whichever dimension leads the lineage', () => {
    expect(getExpressedTrait(breed('rim', 6).genome)).toBeTruthy();
    expect(getExpressedTrait(createBaseGenome())).toBeTruthy();
  });
});
