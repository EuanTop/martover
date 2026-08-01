import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  calculateCraterPosition,
  getCraterWorldVector,
  getLatLonFromPosition,
  MARS_RADIUS,
} from './worldCoordinates';

const SAMPLES = [
  { latitude: 0, longitude: 0 },
  { latitude: 11.44, longitude: 59.2 },
  { latitude: -66.9, longitude: 10 },
  { latitude: -74, longitude: 200 },
  { latitude: -28.58, longitude: 333.8 },
  { latitude: 45, longitude: 90 },
  { latitude: 74, longitude: 359.4 },
];

describe('worldCoordinates', () => {
  it('round-trips latitude and longitude without swapping the axes', () => {
    SAMPLES.forEach(({ latitude, longitude }) => {
      const decoded = getLatLonFromPosition(
        calculateCraterPosition(latitude, longitude)
      );

      expect(decoded.latitude).toBeCloseTo(latitude, 6);
      expect(decoded.longitude).toBeCloseTo((longitude + 360) % 360, 6);
    });
  });

  it('drives height from latitude only, so the poles sit on the spin axis', () => {
    SAMPLES.forEach(({ latitude, longitude }) => {
      const [, y] = calculateCraterPosition(latitude, longitude);

      expect(y).toBeCloseTo(Math.sin(THREE.MathUtils.degToRad(latitude)), 12);
    });

    [0, 90, 180, 270].forEach((longitude) => {
      const [x, y, z] = calculateCraterPosition(90, longitude);

      expect(y).toBeCloseTo(1, 12);
      expect(Math.hypot(x, z)).toBeCloseTo(0, 12);
    });
  });

  it('aligns longitude with the equirectangular texture seam at -X', () => {
    // three.js SphereGeometry places texture u=0 on -X and u=0.25 on +Z.
    expect(calculateCraterPosition(0, 0)).toEqual([-1, 0, 0]);

    const [x, , z] = calculateCraterPosition(0, 90);
    expect(x).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(1, 12);
  });

  it('keeps every position on the requested sphere radius', () => {
    SAMPLES.forEach(({ latitude, longitude }) => {
      const [x, y, z] = calculateCraterPosition(latitude, longitude, MARS_RADIUS);

      expect(Math.hypot(x, y, z)).toBeCloseTo(MARS_RADIUS, 12);
    });
  });

  it('never collapses the camera tangent basis for real crater latitudes', () => {
    // WorldCameraRig derives its oblique offset from (0,1,0) x normal, so the
    // basis may only degenerate at the poles, never at ordinary longitudes.
    SAMPLES.forEach(({ latitude, longitude }) => {
      const normal = getCraterWorldVector({ latitude, longitude }).normalize();
      const tangent = new THREE.Vector3(0, 1, 0).cross(normal);

      expect(tangent.lengthSq()).toBeGreaterThan(0.05);
    });
  });

  it('exposes crater vectors at the Mars radius by default', () => {
    const vector = getCraterWorldVector({ latitude: -28.58, longitude: 333.8 });

    expect(vector.length()).toBeCloseTo(MARS_RADIUS, 12);
  });
});
