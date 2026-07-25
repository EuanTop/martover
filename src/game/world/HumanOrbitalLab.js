import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { HUMAN_RESPONSE_STATES } from '../human/humanEngine';

const MODEL_PATH = '/models/basic-human/scene.gltf';

const boneNames = Object.freeze({
  spine: 'mixamorig:Spine2_04',
  head: 'mixamorig:Head_06',
  leftArm: 'mixamorig:LeftArm_09',
  rightArm: 'mixamorig:RightArm_033',
  leftForeArm: 'mixamorig:LeftForeArm_010',
  rightForeArm: 'mixamorig:RightForeArm_034',
  leftLeg: 'mixamorig:LeftUpLeg_056',
  rightLeg: 'mixamorig:RightUpLeg_060',
});

const HumanFigure = ({ human }) => {
  const source = useGLTF(MODEL_PATH);
  const model = useMemo(() => clone(source.scene), [source.scene]);
  const rootRef = useRef();
  const bonesRef = useRef({});
  const baseRotationsRef = useRef({});
  const materialsRef = useRef([]);

  useLayoutEffect(() => {
    const bones = {};
    const baseRotations = {};
    const materials = [];

    model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
        object.material = new THREE.MeshStandardMaterial({
          color: '#f5f1eb',
          roughness: 0.42,
          metalness: 0.14,
          emissive: '#ffb37e',
          emissiveIntensity: 0.025,
        });
        materials.push(object.material);
      }

      if (object.isBone) {
        bones[object.name] = object;
        baseRotations[object.name] = object.rotation.clone();
      }
    });

    bonesRef.current = bones;
    baseRotationsRef.current = baseRotations;
    materialsRef.current = materials;

    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 1.9 / Math.max(size.x, size.y, size.z);

    model.scale.setScalar(scale);
    model.position.set(
      -center.x * scale,
      -center.y * scale,
      -center.z * scale
    );

    return () => {
      materials.forEach((material) => material.dispose());
    };
  }, [model]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const bones = bonesRef.current;
    const base = baseRotationsRef.current;
    const adapted = human.responseState === HUMAN_RESPONSE_STATES.ADAPTED;
    const responseAmount = adapted
      ? THREE.MathUtils.clamp((Math.sin(time * 0.72) + 1) * 0.5, 0, 1)
      : 0;

    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(time * 0.72) * 0.012;
      rootRef.current.rotation.y = Math.sin(time * 0.24) * 0.025;
    }

    const setBoneRotation = (name, x, y, z, damping = 0.06) => {
      const bone = bones[name];
      const origin = base[name];

      if (!bone || !origin) return;

      bone.rotation.x = THREE.MathUtils.lerp(
        bone.rotation.x,
        origin.x + x,
        damping
      );
      bone.rotation.y = THREE.MathUtils.lerp(
        bone.rotation.y,
        origin.y + y,
        damping
      );
      bone.rotation.z = THREE.MathUtils.lerp(
        bone.rotation.z,
        origin.z + z,
        damping
      );
    };

    setBoneRotation(boneNames.leftArm, -0.08, 0, 0.58 - responseAmount * 0.13);
    setBoneRotation(boneNames.rightArm, -0.08, 0, -0.58 + responseAmount * 0.13);
    setBoneRotation(boneNames.leftForeArm, 0, 0.05, 0.11 + responseAmount * 0.12);
    setBoneRotation(boneNames.rightForeArm, 0, -0.05, -0.11 - responseAmount * 0.12);
    setBoneRotation(boneNames.leftLeg, 0.015, 0, -0.025);
    setBoneRotation(boneNames.rightLeg, -0.015, 0, 0.025);
    setBoneRotation(
      boneNames.spine,
      Math.sin(time * 0.9) * 0.012 - responseAmount * 0.025,
      0,
      0
    );
    setBoneRotation(
      boneNames.head,
      adapted ? -0.035 : 0,
      Math.sin(time * 0.32) * 0.035,
      0
    );

    materialsRef.current.forEach((material) => {
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        adapted ? 0.085 + responseAmount * 0.05 : 0.025,
        0.05
      );
    });
  });

  return (
    <group ref={rootRef}>
      <primitive object={model} />
    </group>
  );
};

const ScanRings = ({ active }) => {
  const groupRef = useRef();

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.16;
  });

  return (
    <group ref={groupRef}>
      {[-0.64, -0.08, 0.5].map((height, index) => (
        <mesh
          key={height}
          position={[0, height, 0]}
          rotation={[Math.PI / 2, 0, index * 0.35]}
        >
          <torusGeometry args={[0.48 + index * 0.045, 0.007, 8, 72]} />
          <meshBasicMaterial
            color={active ? '#fff7e9' : '#a94928'}
            transparent
            opacity={active ? 0.72 - index * 0.12 : 0.28}
          />
        </mesh>
      ))}
    </group>
  );
};

const ScanningPlane = ({ active }) => {
  const scanRef = useRef();

  useFrame((state) => {
    if (!scanRef.current) return;
    const travel = (Math.sin(state.clock.elapsedTime * 0.85) + 1) * 0.5;
    scanRef.current.position.y = THREE.MathUtils.lerp(-0.92, 0.94, travel);
    scanRef.current.material.opacity = active ? 0.22 : 0.09;
  });

  return (
    <mesh ref={scanRef} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.08, 0.55, 64]} />
      <meshBasicMaterial
        color="#fff5e7"
        transparent
        opacity={0.12}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

const OrbitalCradle = ({ active }) => (
  <group>
    <mesh position={[0, -1.03, 0]}>
      <cylinderGeometry args={[0.56, 0.64, 0.12, 48]} />
      <meshStandardMaterial
        color="#71311f"
        roughness={0.62}
        metalness={0.38}
      />
    </mesh>
    <mesh position={[0, -0.955, 0]}>
      <cylinderGeometry args={[0.46, 0.46, 0.025, 48]} />
      <meshStandardMaterial
        color="#f4e9de"
        emissive="#f2a888"
        emissiveIntensity={active ? 0.28 : 0.08}
        roughness={0.38}
        metalness={0.28}
      />
    </mesh>

    {[-0.62, 0.62].map((x) => (
      <group key={x} position={[x, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.025, 1.92, 0.025]} />
          <meshStandardMaterial
            color="#6d2d1b"
            roughness={0.45}
            metalness={0.55}
          />
        </mesh>
        {[-0.72, 0, 0.72].map((height) => (
          <mesh key={height} position={[0, height, 0]}>
            <sphereGeometry args={[0.035, 16, 12]} />
            <meshBasicMaterial
              color={active ? '#fff8ed' : '#d36a3c'}
            />
          </mesh>
        ))}
      </group>
    ))}

    <mesh position={[0, 0, -0.18]}>
      <planeGeometry args={[1.28, 2.06]} />
      <meshPhysicalMaterial
        color="#f4c7aa"
        transparent
        opacity={0.075}
        transmission={0.2}
        roughness={0.5}
        metalness={0.18}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  </group>
);

const HumanOrbitalLab = ({ human, visible }) => {
  const active = human.responseState === HUMAN_RESPONSE_STATES.ADAPTED;

  return (
    <group position={[3.55, 0.88, 0]} visible={visible}>
      <Float speed={0.48} rotationIntensity={0.018} floatIntensity={0.035}>
        <group rotation={[0, -0.12, 0]}>
          <HumanFigure human={human} />
          <ScanRings active={active} />
          <ScanningPlane active={active} />
          <OrbitalCradle active={active} />
        </group>
      </Float>

      <pointLight
        position={[0.65, 1.65, 1.3]}
        intensity={5}
        distance={4}
        color="#fff2df"
      />
      <pointLight
        position={[-0.55, 0.2, 0.8]}
        intensity={active ? 2.6 : 1.4}
        distance={3}
        color="#f57435"
      />
    </group>
  );
};

useGLTF.preload(MODEL_PATH);

export default HumanOrbitalLab;
