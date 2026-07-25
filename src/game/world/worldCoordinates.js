import * as THREE from 'three';

export const MARS_RADIUS = 2;

export const calculateCraterPosition = (latitude, longitude, radius = 1) => {
  const latitudeAngle = (90 - longitude) * (Math.PI / 180);
  const longitudeAngle = -latitude * (Math.PI / 180);

  return [
    radius * Math.sin(latitudeAngle) * Math.cos(longitudeAngle),
    radius * Math.cos(latitudeAngle),
    radius * Math.sin(latitudeAngle) * Math.sin(longitudeAngle),
  ];
};

export const getCraterWorldVector = (crater, radius = MARS_RADIUS) => (
  new THREE.Vector3(...calculateCraterPosition(
    crater?.latitude || 0,
    crater?.longitude || 0,
    radius
  ))
);
