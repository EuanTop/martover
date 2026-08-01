import * as THREE from 'three';

export const MARS_RADIUS = 2;

// three.js SphereGeometry maps texture u=0 onto -X and u=0.25 onto +Z. The Mars
// albedo map is a standard equirectangular plate with 0 degrees east on its left
// edge, so longitude has to start from -X and sweep toward +Z for a crater to
// land on the terrain it actually belongs to.
export const calculateCraterPosition = (latitude, longitude, radius = 1) => {
  const latitudeAngle = latitude * (Math.PI / 180);
  const longitudeAngle = longitude * (Math.PI / 180);
  const equatorialRadius = radius * Math.cos(latitudeAngle);

  return [
    -equatorialRadius * Math.cos(longitudeAngle),
    radius * Math.sin(latitudeAngle),
    equatorialRadius * Math.sin(longitudeAngle),
  ];
};

export const getCraterWorldVector = (crater, radius = MARS_RADIUS) => (
  new THREE.Vector3(...calculateCraterPosition(
    crater?.latitude || 0,
    crater?.longitude || 0,
    radius
  ))
);

// Inverse of calculateCraterPosition, used by tests and by graticule generation
// so there is exactly one definition of the projection in the codebase.
export const getLatLonFromPosition = ([x, y, z], radius = 1) => {
  const clampedY = THREE.MathUtils.clamp(y / radius, -1, 1);

  return {
    latitude: THREE.MathUtils.radToDeg(Math.asin(clampedY)),
    longitude: (THREE.MathUtils.radToDeg(Math.atan2(z, -x)) + 360) % 360,
  };
};
