import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VIEW_MODES } from '../simulation/breedingSimulation';
import { getCraterWorldRadius } from './craterVisualModel';
import { MARS_RADIUS, getCraterWorldVector } from './worldCoordinates';

const smoothStep = (value) => value * value * (3 - 2 * value);
const PLANET_FOV = 75;
const CRATER_FOV = 56;

const getCraterCamera = (crater) => {
  // The crater scene is attached just above the unit Mars sphere. Aim at that
  // same surface point so the local terrain fills the frame without breaking
  // its connection to the globe.
  const target = getCraterWorldVector(crater, MARS_RADIUS * 1.006);
  const normal = target.clone().normalize();
  const tangent = new THREE.Vector3(0, 1, 0).cross(normal);

  if (tangent.lengthSq() < 0.01) {
    tangent.set(1, 0, 0);
  }

  tangent.normalize();
  const bitangent = normal.clone().cross(tangent).normalize();
  const craterRadius = getCraterWorldRadius(crater);
  const cameraHeight = craterRadius * 2.35;
  const obliqueOffset = craterRadius * 1.95;

  return {
    fov: CRATER_FOV,
    target,
    position: target
      .clone()
      .add(normal.clone().multiplyScalar(cameraHeight))
      .add(tangent.clone().multiplyScalar(obliqueOffset))
      .add(bitangent.clone().multiplyScalar(obliqueOffset * 0.18)),
  };
};

const WorldCameraRig = ({ controlsRef, viewMode, selectedCrater }) => {
  const { camera } = useThree();
  const transitionRef = useRef(null);
  const previousModeRef = useRef(viewMode);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || previousModeRef.current === viewMode) return;

    let destination = null;

    if (
      (viewMode === VIEW_MODES.CRATER || viewMode === VIEW_MODES.HUMAN)
      && selectedCrater
    ) {
      destination = getCraterCamera(selectedCrater);
    } else if (viewMode === VIEW_MODES.PLANET) {
      destination = {
        fov: PLANET_FOV,
        target: new THREE.Vector3(0, 0, 0),
        position: camera.position.clone().normalize().multiplyScalar(5.2),
      };
    }

    previousModeRef.current = viewMode;
    if (!destination) return;

    transitionRef.current = {
      elapsed: 0,
      duration: viewMode === VIEW_MODES.HUMAN ? 0.55 : 1.35,
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      fromFov: camera.fov,
      toPosition: destination.position,
      toTarget: destination.target,
      toFov: destination.fov,
    };
    camera.near = 0.01;
    camera.updateProjectionMatrix();
    controls.enabled = false;
  }, [camera, controlsRef, selectedCrater, viewMode]);

  useFrame((_, delta) => {
    const transition = transitionRef.current;
    const controls = controlsRef.current;

    if (!transition || !controls) return;

    transition.elapsed += delta;
    const progress = smoothStep(Math.min(
      transition.elapsed / transition.duration,
      1
    ));

    camera.position.lerpVectors(
      transition.fromPosition,
      transition.toPosition,
      progress
    );
    controls.target.lerpVectors(
      transition.fromTarget,
      transition.toTarget,
      progress
    );
    camera.fov = THREE.MathUtils.lerp(
      transition.fromFov,
      transition.toFov,
      progress
    );
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    controls.update();

    if (progress >= 1) {
      controls.enabled = viewMode === VIEW_MODES.PLANET;
      transitionRef.current = null;
    }
  });

  return null;
};

export default WorldCameraRig;
