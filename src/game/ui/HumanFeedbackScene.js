import React, {
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import PotatoSpecimen from '../../Components/PotatoSpecimen/PotatoSpecimen';

const MODEL_PATH = '/models/basic-human/scene.gltf';
const ARM_DROP = 1;

const boneNames = Object.freeze({
  spine: 'mixamorigSpine2_04',
  head: 'mixamorigHead_06',
  leftArm: 'mixamorigLeftArm_09',
  rightArm: 'mixamorigRightArm_033',
  leftForeArm: 'mixamorigLeftForeArm_010',
  rightForeArm: 'mixamorigRightForeArm_034',
  leftLeg: 'mixamorigLeftUpLeg_056',
  rightLeg: 'mixamorigRightUpLeg_060',
});

const regionVisuals = Object.freeze({
  chest: {
    position: [0, 0.25, 0.12],
    scale: [0.28, 0.34, 0.12],
  },
  torso: {
    position: [0, -0.02, 0.12],
    scale: [0.3, 0.48, 0.12],
  },
  neural: {
    position: [0, 0.68, 0.12],
    scale: [0.19, 0.23, 0.1],
  },
  head: {
    position: [0, 0.7, 0.12],
    scale: [0.2, 0.25, 0.1],
  },
});

const collectSkinnedBounds = (model) => {
  const bounds = new THREE.Box3().makeEmpty();

  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (!object.isMesh) return;

    if (object.isSkinnedMesh && object.computeBoundingBox) {
      object.computeBoundingBox();
    } else if (!object.geometry.boundingBox) {
      object.geometry.computeBoundingBox();
    }

    if (object.boundingBox || object.geometry.boundingBox) {
      bounds.union(
        (object.boundingBox || object.geometry.boundingBox)
          .clone()
          .applyMatrix4(object.matrixWorld)
      );
    }
  });

  return bounds;
};

const HumanFigure = ({ human, phase }) => {
  const source = useGLTF(MODEL_PATH);
  const model = useMemo(() => clone(source.scene), [source.scene]);
  const normalizationRef = useRef();
  const figureRef = useRef();
  const bonesRef = useRef({});
  const baseRotationsRef = useRef({});
  const materialsRef = useRef([]);

  useLayoutEffect(() => {
    const bones = {};
    const baseRotations = {};
    const materials = [];

    model.traverse((object) => {
      if (object.isCamera || object.isLight) {
        object.visible = false;
      }

      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
        object.material = new THREE.MeshPhysicalMaterial({
          color: '#f8f4ee',
          roughness: 0.36,
          metalness: 0.08,
          clearcoat: 0.22,
          clearcoatRoughness: 0.4,
          emissive: '#f5a77c',
          emissiveIntensity: 0.025,
        });
        materials.push(object.material);
      }

      if (object.isBone) {
        bones[object.name] = object;
        baseRotations[object.name] = object.rotation.clone();
      }
    });

    const setInitialPose = (name, x, y, z) => {
      const bone = bones[name];
      const origin = baseRotations[name];
      if (!bone || !origin) return;
      bone.rotation.set(origin.x + x, origin.y + y, origin.z + z);
    };

    setInitialPose(boneNames.leftArm, ARM_DROP, 0, 0);
    setInitialPose(boneNames.rightArm, ARM_DROP, 0, 0);
    setInitialPose(boneNames.leftForeArm, -0.08, 0.03, 0.04);
    setInitialPose(boneNames.rightForeArm, -0.08, -0.03, -0.04);

    const bounds = collectSkinnedBounds(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fitScale = Math.min(2.12 / size.y, 1.42 / size.x);

    normalizationRef.current.scale.setScalar(fitScale);
    normalizationRef.current.position.set(
      -center.x * fitScale,
      -center.y * fitScale,
      -center.z * fitScale
    );

    bonesRef.current = bones;
    baseRotationsRef.current = baseRotations;
    materialsRef.current = materials;

    return () => {
      materials.forEach((material) => material.dispose());
    };
  }, [model]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const bones = bonesRef.current;
    const base = baseRotationsRef.current;
    const response = human.lastResponse;
    const reacting = phase === 'reacting' || phase === 'revealed';
    const responseAmount = reacting
      ? THREE.MathUtils.clamp(
        phase === 'reacting'
          ? (Math.sin(time * 2.2) + 1) * 0.5
          : 0.72,
        0,
        1
      )
      : 0;

    const setBoneRotation = (name, x, y, z, damping = 7) => {
      const bone = bones[name];
      const origin = base[name];
      if (!bone || !origin) return;

      bone.rotation.x = THREE.MathUtils.damp(
        bone.rotation.x,
        origin.x + x,
        damping,
        delta
      );
      bone.rotation.y = THREE.MathUtils.damp(
        bone.rotation.y,
        origin.y + y,
        damping,
        delta
      );
      bone.rotation.z = THREE.MathUtils.damp(
        bone.rotation.z,
        origin.z + z,
        damping,
        delta
      );
    };

    const trait = response?.trait;
    const isDormant = trait === 'dormancy' && reacting;
    const isConductive = trait === 'conductivity' && reacting;
    const isOriented = trait === 'orientation' && reacting;
    const isRepairing = trait === 'repair' && reacting;
    const twitch = isConductive ? Math.sin(time * 19) * 0.11 : 0;
    const dormantDrop = isDormant ? responseAmount * 0.075 : 0;
    const repairLift = isRepairing ? responseAmount * 0.045 : 0;

    if (figureRef.current) {
      figureRef.current.position.y = (
        Math.sin(time * 0.72) * 0.01
        - dormantDrop
        + repairLift
      );
      figureRef.current.rotation.y = (
        Math.sin(time * 0.24) * 0.022
        + (isOriented ? Math.sin(time * 1.35) * 0.055 : 0)
      );
      figureRef.current.rotation.z = THREE.MathUtils.damp(
        figureRef.current.rotation.z,
        isDormant ? responseAmount * 0.018 : 0,
        5,
        delta
      );
    }

    setBoneRotation(
      boneNames.leftArm,
      ARM_DROP
        - (isRepairing ? responseAmount * 0.42 : 0)
        + (isDormant ? responseAmount * 0.16 : 0),
      0,
      twitch
    );
    setBoneRotation(
      boneNames.rightArm,
      ARM_DROP
        - (isRepairing ? responseAmount * 0.42 : 0)
        + (isDormant ? responseAmount * 0.16 : 0),
      0,
      -twitch
    );
    setBoneRotation(
      boneNames.leftForeArm,
      -0.08 + (isRepairing ? responseAmount * 0.92 : 0),
      0.03,
      0.04 + responseAmount * 0.05
    );
    setBoneRotation(
      boneNames.rightForeArm,
      -0.08 + (isRepairing ? responseAmount * 0.92 : 0),
      -0.03,
      -0.04 - responseAmount * 0.05
    );
    setBoneRotation(
      boneNames.leftLeg,
      isDormant ? responseAmount * 0.08 : 0.015,
      0,
      -0.025 + twitch * 0.25
    );
    setBoneRotation(
      boneNames.rightLeg,
      isDormant ? responseAmount * 0.04 : -0.015,
      0,
      0.025 - twitch * 0.25
    );
    setBoneRotation(
      boneNames.spine,
      Math.sin(time * 0.9) * 0.012
        + (isDormant ? responseAmount * 0.21 : 0)
        - (isRepairing ? responseAmount * 0.09 : 0),
      0,
      isConductive ? twitch * 0.2 : 0
    );
    setBoneRotation(
      boneNames.head,
      isDormant
        ? responseAmount * 0.18
        : -responseAmount * (isRepairing ? 0.07 : 0.025),
      isOriented
        ? Math.sin(time * 1.8) * 0.2
        : Math.sin(time * 0.32) * 0.03 + twitch * 0.22,
      isOriented
        ? Math.sin(time * 1.2) * 0.065
        : twitch * 0.18
    );

    materialsRef.current.forEach((material) => {
      material.emissiveIntensity = THREE.MathUtils.damp(
        material.emissiveIntensity,
        reacting ? 0.075 + responseAmount * 0.055 : 0.025,
        5,
        delta
      );
    });
  });

  return (
    <group ref={figureRef}>
      <group ref={normalizationRef}>
        <primitive object={model} />
      </group>
    </group>
  );
};

const ScanAssembly = ({ phase }) => {
  const ringsRef = useRef();
  const scanRef = useRef();
  const active = phase === 'scanning';

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (ringsRef.current) {
      ringsRef.current.rotation.y = time * 0.16;
    }
    if (scanRef.current) {
      const travel = (Math.sin(time * 1.15 - Math.PI / 2) + 1) * 0.5;
      scanRef.current.position.y = THREE.MathUtils.lerp(-1.02, 1.02, travel);
      scanRef.current.material.opacity = active ? 0.42 : 0.08;
    }
  });

  return (
    <group>
      <group ref={ringsRef}>
        {[-0.72, -0.12, 0.52].map((height, index) => (
          <mesh
            key={height}
            position={[0, height, 0]}
            rotation={[Math.PI / 2, 0, index * 0.34]}
          >
            <torusGeometry args={[0.52 + index * 0.035, 0.006, 8, 72]} />
            <meshBasicMaterial
              color={active ? '#fff9ef' : '#8e3f24'}
              transparent
              opacity={active ? 0.7 - index * 0.1 : 0.22}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <mesh ref={scanRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.58, 64]} />
        <meshBasicMaterial
          color="#fff7e8"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

const BodySignals = ({ human, phase }) => {
  const activeRegion = human.lastResponse?.bodyRegion;
  const reacting = phase === 'reacting' || phase === 'revealed';
  const signals = human.adaptations.map((adaptation, index) => ({
    key: `${adaptation.generation}-${adaptation.trait}-${index}`,
    region: index === human.adaptations.length - 1
      ? activeRegion
      : ({
        repair: 'chest',
        dormancy: 'torso',
        conductivity: 'neural',
        orientation: 'head',
      })[adaptation.trait],
    active: index === human.adaptations.length - 1 && reacting,
  }));

  return signals.map((signal, index) => {
    const visual = regionVisuals[signal.region] || regionVisuals.chest;

    return (
      <mesh
        key={signal.key}
        position={[
          visual.position[0],
          visual.position[1],
          visual.position[2] + index * 0.006,
        ]}
        scale={visual.scale}
      >
        <sphereGeometry args={[1, 28, 20]} />
        <meshBasicMaterial
          color={signal.active ? '#fff7dc' : '#f28a5e'}
          transparent
          opacity={signal.active ? 0.3 : 0.075}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    );
  });
};

const SampleTransfer = ({ phase }) => {
  const sampleRef = useRef();

  useFrame((_, delta) => {
    if (!sampleRef.current) return;

    const destination = phase === 'receiving'
      ? -0.72
      : phase === 'scanning'
        ? -0.54
        : -0.3;
    sampleRef.current.position.x = THREE.MathUtils.damp(
      sampleRef.current.position.x,
      destination,
      5,
      delta
    );
    sampleRef.current.rotation.y += delta * 0.7;
    sampleRef.current.visible = phase !== 'revealed';
  });

  return (
    <group ref={sampleRef} position={[-1.18, -0.92, 0.2]}>
      <PotatoSpecimen
        scale={[0.13, 0.095, 0.11]}
        outlineScale={[0.145, 0.11, 0.125]}
        color="#f7e6cf"
        outlineColor="#6f2f1b"
        opacity={0.96}
        distort={0.28}
        speed={0.5}
        metalness={0.12}
        roughness={0.52}
        geometryDetail={24}
      />
    </group>
  );
};

const HumanStage = ({ human, phase }) => (
  <>
    <color attach="background" args={['#d86432']} />
    <ambientLight intensity={1.25} />
    <directionalLight
      position={[2.4, 3.4, 3.8]}
      intensity={3.2}
      color="#fff5e7"
    />
    <pointLight
      position={[-1.6, 0.2, 2.2]}
      intensity={phase === 'reacting' ? 3.4 : 1.8}
      distance={5}
      color="#f5844e"
    />

    <group position={[0, -0.02, 0]}>
      <HumanFigure human={human} phase={phase} />
      <BodySignals human={human} phase={phase} />
      <ScanAssembly phase={phase} />
      <SampleTransfer phase={phase} />
    </group>

    <mesh position={[0, -1.12, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.68, 64]} />
      <meshBasicMaterial
        color="#6e2c1a"
        transparent
        opacity={0.22}
        depthWrite={false}
      />
    </mesh>
  </>
);

const HumanFeedbackScene = ({ human, phase }) => (
  <Canvas
    dpr={[1, 1.5]}
    camera={{ position: [0, 0.02, 4.35], fov: 31, near: 0.1, far: 20 }}
    gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
  >
    <Suspense fallback={null}>
      <HumanStage human={human} phase={phase} />
    </Suspense>
  </Canvas>
);

useGLTF.preload(MODEL_PATH);

export default HumanFeedbackScene;
