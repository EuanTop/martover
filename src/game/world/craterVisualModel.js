import * as THREE from 'three';

const MIN_CRATER_DIAMETER_KM = 1.8;
const MAX_CRATER_DIAMETER_KM = 45;
const MARS_WORLD_SCALE = 2;
const CRATER_TERRAIN_RADIUS = 0.92;

export const getCraterDisplayScale = (crater) => {
  const diameter = THREE.MathUtils.clamp(
    Number(crater?.diameter) || 6,
    MIN_CRATER_DIAMETER_KM,
    MAX_CRATER_DIAMETER_KM
  );
  const normalized = (
    Math.log(diameter) - Math.log(MIN_CRATER_DIAMETER_KM)
  ) / (
    Math.log(MAX_CRATER_DIAMETER_KM) - Math.log(MIN_CRATER_DIAMETER_KM)
  );

  return THREE.MathUtils.lerp(0.032, 0.056, normalized);
};

export const getCraterWorldRadius = (crater) => (
  getCraterDisplayScale(crater)
    * MARS_WORLD_SCALE
    * CRATER_TERRAIN_RADIUS
);
