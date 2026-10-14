import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { DynamicDrawUsage, InstancedMesh, Object3D, Group } from 'three';
import { VISUAL } from '../config/visual';
import { MOTION, type MotionState } from '../config/motion';

type Beam = { position: [number, number, number]; size: [number, number, number] };
export type StructureLayout = { primary: Beam[]; fine: Beam[]; accents: Beam[]; minimumClearance: number };

function rand(seed: number) {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function generateStructure(firstSection: number): StructureLayout {
  const primary: Beam[] = [], fine: Beam[] = [], accents: Beam[] = [];
  const eye = MOTION.eyeHeight, cell = VISUAL.cellSize;
  const allXs = [-15, -9, -3, 3, 9, 15], allYs = [-9, -3, 3, 9];
  const put = (array: Beam[], position: Beam['position'], size: Beam['size']) => array.push({ position, size });
  for (let section = firstSection; section < firstSection + VISUAL.sectionCount; section++) {
    const z = -3 - section * cell;
    const openVolume = section % 9 < 5;
    const xs = openVolume ? [-15, -9, 9, 15] : allXs;
    const ys = openVolume ? [-9, 9] : allYs;
    const innerX = openVolume ? 6 : 3;
    const ceilingY = openVolume ? 9.06 : 3.06;
    for (const y of ys) put(primary, [0, eye + y, z], [30.15, 0.12, 0.13]);
    for (const x of xs) put(primary, [x, eye, z], [0.13, 18, 0.13]);
    for (const x of xs) for (const y of ys) put(primary, [x, eye + y, z - cell / 2], [0.10, 0.10, cell]);

    for (const sign of [-1, 1]) {
      // Shelf slabs have depth: their edges and backs separate as the viewer turns.
      for (let row = 0; row < 6; row++) {
        if (openVolume && row % 2 === 1) continue;
        const y = eye - 2.35 + row * 0.91;
        put(fine, [sign * (innerX + 1.5), y, z - 3], [3, 0.045, 6]);
        for (let page = 0; page < 10; page++) {
          const seed = section * 211 + row * 29 + page * 7 + sign * 17;
          if (rand(seed) < (openVolume ? 0.68 : 0.48)) continue;
          const depth = 0.38 + rand(seed + 3) * 1.25;
          const height = 0.3 + rand(seed + 4) * 0.45;
          put(fine, [sign * (innerX + 0.32 + depth / 2), y + height / 2 + 0.04, z - 0.3 - page * 0.57], [depth, height, 0.028]);
        }
      }
      for (let j = 0; j <= 12; j++) {
        // Occasional openings reveal the next structure, rather than a closed corridor.
        if ((section + (sign > 0 ? 0 : 2)) % 4 === 1 && j > 3 && j < 9) continue;
        put(fine, [sign * (innerX + 0.08), eye - 0.05, z - j * 0.5], [0.048, 4.7, 0.04]);
      }
      for (const x of [9, 15]) {
        for (let j = 0; j <= 6; j++) {
          put(fine, [sign * x, eye, z - j], [0.052, 18, 0.035]);
        }
        for (let row = -8; row <= 8; row += 1.5) {
          put(fine, [sign * x, eye + row, z - 3], [0.06, 0.05, 6]);
        }
      }
      if ((section + (sign > 0 ? 1 : 0)) % 3 === 0) {
        const y = eye + (rand(section + sign * 37) - 0.5) * 7;
        put(accents, [sign * 8.97, y, z - 2.5], [0.028, 1.5, 2.4]);
        put(primary, [sign * 8.85, y + 0.82, z - 2.5], [0.18, 0.08, 2.65]);
        put(primary, [sign * 8.85, y - 0.82, z - 2.5], [0.18, 0.08, 2.65]);
      }
    }

    // The overhead lattice continues sideways across adjoining volumes.
    for (let j = 0; j < 12; j++) {
      put(fine, [0, eye + ceilingY, z - j * 0.5], [30, 0.025, 0.032]);
      if (!openVolume && j % 3 === 0) put(fine, [0, eye - 3.06, z - j * 0.5], [30, 0.025, 0.04]);
    }
    for (let x = -14; x <= 14; x += 1) {
      put(fine, [x, eye + ceilingY, z - 3], [0.03, 0.024, 6]);
    }
  }
  let minimumClearance = Infinity;
  for (const beam of [...primary, ...fine, ...accents]) {
    const dx = Math.max(0, Math.abs(beam.position[0]) - beam.size[0] / 2);
    const dy = Math.max(0, Math.abs(beam.position[1] - eye) - beam.size[1] / 2);
    minimumClearance = Math.min(minimumClearance, Math.hypot(dx, dy));
  }
  return { primary, fine, accents, minimumClearance };
}

function BeamBatch({ beams, color, lit = true }: { beams: Beam[]; color: string; lit?: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const temporary = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    instance.instanceMatrix.setUsage(DynamicDrawUsage);
    beams.forEach((beam, index) => {
      temporary.position.set(...beam.position);
      temporary.scale.set(...beam.size);
      temporary.updateMatrix();
      instance.setMatrixAt(index, temporary.matrix);
    });
    instance.instanceMatrix.needsUpdate = true;
    instance.computeBoundingSphere();
  }, [beams, temporary]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, beams.length]}>
    <boxGeometry args={[1, 1, 1]} />
    {lit ? <meshStandardMaterial color={color} roughness={0.86} metalness={0.08} />
      : <meshBasicMaterial color={color} />}
  </instancedMesh>;
}

function GeometryPlaceholders({ motion }: { motion: MotionState }) {
  const specimen = useRef<Group>(null);
  useFrame((_, dt) => {
    if (specimen.current && !document.hidden && !motion.suspended && !motion.paused) specimen.current.rotation.y += Math.min(dt, MOTION.maxDt) * 0.025;
  });
  return <group>
    <group ref={specimen} position={[3.68, 2.05, -12]} rotation={[0.25, 0.2, 0.4]}>
      <mesh><torusGeometry args={[0.57, 0.018, 6, 72]} /><meshStandardMaterial color={VISUAL.content} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.57, 0.014, 6, 72]} /><meshStandardMaterial color={VISUAL.content} /></mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.57, 0.014, 6, 72]} /><meshStandardMaterial color={VISUAL.content} /></mesh>
    </group>
    <mesh position={[-3.8, 2.25, -23]} rotation={[0.45, 0.2, 0.1]}>
      <icosahedronGeometry args={[0.65, 0]} />
      <meshStandardMaterial color={VISUAL.content} wireframe />
    </mesh>
  </group>;
}

export function StructureField({ motion }: { motion: MotionState }) {
  const [firstSection, setFirstSection] = useState(0);
  const layout = useMemo(() => generateStructure(firstSection), [firstSection]);
  useFrame(() => {
    const next = Math.max(0, Math.floor(motion.distance / VISUAL.cellSize) - VISUAL.sectionsBehind);
    if (next !== firstSection) setFirstSection(next);
  });
  return <group name="structure-field" userData={{ minimumClearance: layout.minimumClearance, firstSection, primaryCount: layout.primary.length, fineCount: layout.fine.length }}>
    <BeamBatch beams={layout.primary} color={VISUAL.primaryStructure} />
    <BeamBatch beams={layout.fine} color={VISUAL.secondaryStructure} />
    <BeamBatch beams={layout.accents} color={VISUAL.light} lit={false} />
    <GeometryPlaceholders motion={motion} />
  </group>;
}


