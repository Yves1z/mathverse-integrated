import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ExtrudeGeometry, Group, ShapeGeometry } from 'three';
import { MOTION, minimumJerk, type MotionState } from '../config/motion';
import { archFrameShape, archRing, archShape } from './archGeometry';

export function Door({ motion, onEnter }: { motion: MotionState; onEnter: () => void }) {
  const hinge = useRef<Group>(null);
  const pieces = useMemo(() => {
    const settings = { depth: 0.14, bevelEnabled: true, bevelSize: 0.007, bevelThickness: 0.007, bevelSegments: 3, curveSegments: 64, steps: 1 };
    return {
      frame: new ExtrudeGeometry(archFrameShape(), settings),
      panel: new ExtrudeGeometry(archShape(0.643, 2.749, 0.012), { ...settings, depth: 0.07, bevelSize: 0.003, bevelThickness: 0.003 }),
      outline: new ShapeGeometry(archRing(0.562, 2.663, 0.0055, 0.092), 64),
      molding: new ShapeGeometry(archRing(0.724, 2.83, 0.0045, 0.008), 64),
    };
  }, []);
  useFrame(() => {
    if (hinge.current) hinge.current.rotation.y = motion.phase === 'idle' ? 0 : MOTION.doorAngle * minimumJerk(motion.elapsed / MOTION.doorDuration);
  });
  return <group name="sculptural-arch">
    <mesh geometry={pieces.frame} position={[0, 0, -0.07]} castShadow userData={{mathOccluder:true}}>
      <meshStandardMaterial color="#f4f3ed" roughness={0.64} metalness={0.02} fog={false} toneMapped={false} />
    </mesh>
    <mesh geometry={pieces.molding} position={[0, 0, 0.078]}>
      <meshBasicMaterial color="#c8cbc4" fog={false} toneMapped={false} />
    </mesh>
    <group name="door-hinge" ref={hinge} position={[-0.645, 0, 0.012]}>
      <mesh name="door-panel" geometry={pieces.panel} position={[0.645, 0, 0]} castShadow userData={{mathOccluder:true}} onClick={event => { event.stopPropagation(); if (motion.phase === 'idle') onEnter(); }}>
        <meshStandardMaterial color="#f9f8f3" roughness={0.55} metalness={0.015} fog={false} toneMapped={false} />
      </mesh>
      <mesh geometry={pieces.outline} position={[0.645, 0, 0.075]}>
        <meshBasicMaterial color="#c4c8c0" fog={false} toneMapped={false} />
      </mesh>
      <mesh position={[1.105, 1.05, 0.124]} castShadow>
        <cylinderGeometry args={[0.0085, 0.0085, 0.175, 16]} />
        <meshStandardMaterial color="#b7b8ad" roughness={0.26} metalness={0.8} fog={false} toneMapped={false} />
      </mesh>
      {[0.983, 1.117].map(y => <mesh key={y} position={[1.105, y, 0.099]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.038, 16]} />
        <meshStandardMaterial color="#bbbcb1" roughness={0.26} metalness={0.8} fog={false} toneMapped={false} />
      </mesh>)}
    </group>
  </group>;
}
