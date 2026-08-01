import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VIEW_MODES } from '../simulation/breedingSimulation';
import {
  getCraterMountRadius,
  getCraterWorldRadius,
} from './craterVisualModel';
import { MARS_RADIUS, getCraterWorldVector } from './worldCoordinates';

const smoothStep = (value) => value * value * (3 - 2 * value);
const PLANET_FOV = 75;
const CRATER_FOV = 56;

const getCraterCamera = (crater) => {
  // 相机目标跟随坑体挂载半径（坑底贴着球面、坑缘凸出），
  // 与 CraterCultivationScene 的实际挂载位置保持一致。
  const rawTarget = getCraterWorldVector(crater, MARS_RADIUS * getCraterMountRadius(crater));
  const normal = rawTarget.clone().normalize();
  const tangent = new THREE.Vector3(0, 1, 0).cross(normal);

  if (tangent.lengthSq() < 0.01) {
    tangent.set(1, 0, 0);
  }

  tangent.normalize();
  const bitangent = normal.clone().cross(tangent).normalize();
  const craterRadius = getCraterWorldRadius(crater);

  // 相机 up 用地表切平面里指向行星北的方向：把世界 Y 投影到
  // 切平面。若沿用世界 (0,1,0)，高纬度坑的地平线会整个歪掉
  // （地表法线与世界 Y 夹角越大画面翻滚越重）。极点附近投影
  // 退化时回退到经线方向。
  const up = new THREE.Vector3(0, 1, 0)
    .addScaledVector(normal, -normal.y);

  if (up.lengthSq() < 0.01) {
    up.copy(bitangent);
  }

  up.normalize();

  // 2.5D 经营视角：相机从坑的「南侧」（-up 方向）以约 42 度俯角
  // 望向坑体。切向偏移严格沿屏幕下方，坑体水平居中、地面铺满
  // 画面、地平线收在画面顶端 —— 不是正上方俯视的圆盘，也不是
  // 贴着球侧、星球轮廓斜占半边的掠视。
  const cameraHeight = craterRadius * 2.2;
  const obliqueOffset = craterRadius * 2.4;

  // 瞄准点沿 up 略微下移：底部 HUD 占掉约四分之一画面，
  // 下移后坑体落在可视区域的视觉中心而不是被 HUD 压住。
  const target = rawTarget.clone().addScaledVector(up, -craterRadius * 0.25);

  return {
    fov: CRATER_FOV,
    target,
    up,
    position: rawTarget
      .clone()
      .add(normal.clone().multiplyScalar(cameraHeight))
      .addScaledVector(up, -obliqueOffset),
  };
};

// 相机装置只关心 viewMode 与 selectedCrater，不关心逐 tick 的模拟状态。
const WorldCameraRig = React.memo(function WorldCameraRig({
  controlsRef,
  viewMode,
  selectedCrater,
}) {
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
        up: new THREE.Vector3(0, 1, 0),
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
      fromUp: camera.up.clone(),
      fromFov: camera.fov,
      toPosition: destination.position,
      toTarget: destination.target,
      toUp: destination.up,
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
    camera.up.lerpVectors(
      transition.fromUp,
      transition.toUp,
      progress
    ).normalize();
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    // 过渡期间不能调用 controls.update()：OrbitControls 的距离夹取
    // 不受 controls.enabled 保护，会把相机瞬移到 maxDistance，
    // 实测吞掉转场前 65% 的轨迹。转场结束后再交回控制权。

    if (progress >= 1) {
      controls.update();
      controls.enabled = viewMode === VIEW_MODES.PLANET;
      transitionRef.current = null;
    }
  });

  return null;
});

export default WorldCameraRig;
