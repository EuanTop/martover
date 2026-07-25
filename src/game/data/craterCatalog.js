import { GAME_CONTENT_LIMITS } from '../config/gameConfig';

export const createCraterCatalog = (allCraters) => ({
  available: allCraters.slice(0, GAME_CONTENT_LIMITS.availableCraters),
  totalCount: allCraters.length,
});
