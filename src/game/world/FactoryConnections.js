import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getNeighbourIds } from '../economy/baseLayout';
import {
  FACILITY_STATUS,
  FACILITY_TYPES,
  PLANTING_BED_ID,
} from '../economy/colonyState';

const CULTIVATION_LINKS = new Set([
  FACILITY_TYPES.ROOT_FEEDER,
  FACILITY_TYPES.HEATER,
  FACILITY_TYPES.SHIELD,
]);

const FLOW_COLORS = Object.freeze({
  [FACILITY_TYPES.EXTRACTOR]: '#91d6dd',
  [FACILITY_TYPES.SIFTER]: '#d7aa62',
  [FACILITY_TYPES.NUTRIENT]: '#a9ce72',
  [FACILITY_TYPES.ROOT_FEEDER]: '#b9de85',
  [FACILITY_TYPES.HEATER]: '#ff8a43',
  [FACILITY_TYPES.SHIELD]: '#b8dbe6',
  default: '#e4b18a',
});

const FACTORY_STAGES = Object.freeze([
  {
    sources: [FACILITY_TYPES.EXTRACTOR],
    targets: [FACILITY_TYPES.NUTRIENT],
  },
  {
    sources: [FACILITY_TYPES.SIFTER],
    targets: [FACILITY_TYPES.NUTRIENT],
  },
  {
    sources: [FACILITY_TYPES.NUTRIENT],
    targets: [FACILITY_TYPES.ROOT_FEEDER],
  },
]);

const isRunning = (base, cell) => (
  !base.facilitiesIdle
  && cell?.facility
  && cell.facility.status === FACILITY_STATUS.RUNNING
);

const FlowPulse = ({ curve, color, active, phase }) => {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    if (!active) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const t = (state.clock.elapsedTime * 0.28 + phase) % 1;
    ref.current.position.copy(curve.getPointAt(t));
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.017, 10, 8]} />
      <meshBasicMaterial
        color={color}
        toneMapped={false}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
};

const Pipe = ({
  start, end, color, active, phase, remote = false,
}) => {
  const curve = useMemo(() => {
    const midpoint = start.clone().lerp(end, 0.5);
    midpoint.y += remote ? 0.052 : 0.035;
    return new THREE.QuadraticBezierCurve3(start, midpoint, end);
  }, [end, remote, start]);

  return (
    <group>
      <mesh>
        <tubeGeometry
          args={[curve, 18, remote ? 0.0065 : 0.0105, 8, false]}
        />
        <meshStandardMaterial
          color={active ? color : '#5a3528'}
          emissive={active ? color : '#000000'}
          emissiveIntensity={active ? (remote ? 0.28 : 0.55) : 0}
          roughness={0.46}
          metalness={0.58}
          transparent={remote}
          opacity={remote ? 0.72 : 1}
        />
      </mesh>
      {[phase, (phase + 0.5) % 1].map((pulsePhase) => (
        <FlowPulse
          key={pulsePhase}
          curve={curve}
          color={color}
          active={active}
          phase={pulsePhase}
        />
      ))}
    </group>
  );
};

const getLayoutPosition = (layouts, cellId) => {
  const layout = layouts.get(cellId);
  if (!layout) return null;
  return new THREE.Vector3(layout.x, layout.height + 0.028, layout.z);
};

const getDistanceSquared = (layouts, source, target) => {
  const start = getLayoutPosition(layouts, source.id);
  const end = getLayoutPosition(layouts, target.id);
  return start && end ? start.distanceToSquared(end) : Number.POSITIVE_INFINITY;
};

const FactoryConnections = ({ base, layouts }) => {
  const links = useMemo(() => {
    const output = [];
    const seen = new Set();
    const center = layouts.get(PLANTING_BED_ID);
    const facilityCells = base.cells.filter((cell) => cell.facility);
    const pushLink = ({
      source, target, end = null, keySuffix = '', remote = false,
    }) => {
      const key = `${source.id}|${target?.id || keySuffix}`;
      if (seen.has(key)) return;

      const start = getLayoutPosition(layouts, source.id);
      const targetPosition = end || getLayoutPosition(layouts, target?.id);
      if (!start || !targetPosition) return;

      seen.add(key);
      output.push({
        key,
        start,
        end: targetPosition,
        color: FLOW_COLORS[source.facility.type] || FLOW_COLORS.default,
        active: isRunning(base, source)
          && (target ? isRunning(base, target) : Boolean(base.potato)),
        remote,
      });
    };

    FACTORY_STAGES.forEach(({ sources, targets }) => {
      facilityCells
        .filter((cell) => sources.includes(cell.facility.type))
        .forEach((source) => {
          const downstream = facilityCells.filter(
            (cell) => targets.includes(cell.facility.type)
          );
          if (downstream.length === 0) return;

          const neighbours = new Set(getNeighbourIds(source.id));
          const adjacent = downstream.filter((cell) => neighbours.has(cell.id));
          const connected = adjacent.length > 0
            ? adjacent
            : [downstream.reduce((closest, candidate) => (
              !closest
              || getDistanceSquared(layouts, source, candidate)
                < getDistanceSquared(layouts, source, closest)
                ? candidate
                : closest
            ), null)];

          connected.filter(Boolean).forEach((target) => {
            pushLink({
              source,
              target,
              remote: !neighbours.has(target.id),
            });
          });
        });
    });

    facilityCells.forEach((cell) => {
      if (
        center
        && CULTIVATION_LINKS.has(cell.facility.type)
        && cell.corePort
      ) {
        pushLink({
          source: cell,
          end: new THREE.Vector3(0, center.height + 0.03, 0),
          keySuffix: 'core',
        });
      }
    });

    return output;
  }, [base, layouts]);

  return (
    <group>
      {links.map((link, index) => (
        <Pipe
          key={link.key}
          {...link}
          phase={(index * 0.19) % 1}
        />
      ))}
    </group>
  );
};

export default React.memo(FactoryConnections);
