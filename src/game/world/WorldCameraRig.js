import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VIEW_MODES } from '../simulation/breedingSimulation';
import { getCraterWorldVector } from './worldCoordinates';

const HUMAN_TARGET = new THREE.Vector3(3.55, 0.88, 0);
const HUMAN_CAMERA = new THREE.Vector3(5.05, 1.3, 2.25);

const smoothStep = (value) => value * value * (3 - 2 * value);

const getCraterCamera = (crater) => {
  const target = getCraterWorldVector(crater, 2.03);
  const normal = target.clone().normalize();
  const tangent = new THREE.Vector3(0, 1, 0).cross(normal);

  if (tangent.lengthSq() < 0.01) {
    tangent.set(1, 0, 0);
  }

  tangent.normalize();

  return {
    target,
    position: target
      .clone()
      .add(normal.multiplyScalar(1.55))
      .add(tangent.multiplyScalar(0.42)),
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

    if (viewMode === VIEW_MODES.CRATER && selectedCrater) {
      destination = getCraterCamera(selectedCrater);
    } else if (viewMode === VIEW_MODES.HUMAN) {
      destination = {
        target: HUMAN_TARGET.clone(),
        position: HUMAN_CAMERA.clone(),
      };
    } else if (viewMode === VIEW_MODES.PLANET) {
      destination = {
        target: new THREE.Vector3(0, 0, 0),
        position: camera.position.clone().normalize().multiplyScalar(5.2),
      };
    }

    previousModeRef.current = viewMode;
    if (!destination) return;

    transitionRef.current = {
      elapsed: 0,
      duration: viewMode === VIEW_MODES.HUMAN ? 1.8 : 1.35,
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: destination.position,
      toTarget: destination.target,
    };
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
    camera.lookAt(controls.target);
    controls.update();

    if (progress >= 1) {
      controls.enabled = true;
      transitionRef.current = null;
    }
  });

  return null;
};

export default WorldCameraRig;
