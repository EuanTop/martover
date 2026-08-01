export const GAME_PHASES = Object.freeze({
  CRATER_SELECTION: 'crater-selection',
  POTATO_BREEDING: 'potato-breeding',
  PRODUCTION: 'production',
});

const PHASE_PROGRESS_STEPS = Object.freeze({
  [GAME_PHASES.CRATER_SELECTION]: 1,
  [GAME_PHASES.POTATO_BREEDING]: 2,
  [GAME_PHASES.PRODUCTION]: 3,
});

export const getGameProgressStep = (phase) => (
  PHASE_PROGRESS_STEPS[phase] ?? PHASE_PROGRESS_STEPS[GAME_PHASES.CRATER_SELECTION]
);
