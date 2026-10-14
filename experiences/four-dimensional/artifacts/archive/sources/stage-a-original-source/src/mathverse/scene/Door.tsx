import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { MOTION, smoothstep, type MotionState } from '../config/motion';

export function Door({ motion, onEnter }: { motion: MotionState; onEnter: () => void }) {
  const hinge = useRef<Group>(null);
  useFrame(() => {
    if (!hinge.current) return;
    hinge.current.rotation.y = motion.phase === 'idle' ? 0 : MOTION.doorAngle * smoothstep(motion.elapsed / MOTION.doorDuration);
  });
  return <group>
    <mesh position={[-0.71, 1.23, 0.02]} castShadow>
      <boxGeometry args={[0.085, 2.46, 0.17]} />
      <meshStandardMaterial color="#e1dfd8" roughness={0.88} fog={false} />
    </mesh>
    <mesh position={[0.71, 1.23, 0.02]} castShadow>
      <boxGeometry args={[0.085, 2.46, 0.17]} />
      <meshStandardMaterial color="#e1dfd8" roughness={0.88} fog={false} />
    </mesh>
    <mesh position={[0, 2.49, 0.02]} castShadow>
      <boxGeometry args={[1.505, 0.08, 0.17]} />
      <meshStandardMaterial color="#e1dfd8" roughness={0.88} fog={false} />
    </mesh>
    <group ref={hinge} position={[-0.63, 1.2, 0]}>
      <mesh position={[0.63, 0, 0]} castShadow onClick={(e) => { e.stopPropagation(); if (motion.phase === 'idle') onEnter(); }}>
        <boxGeometry args={[1.25, 2.4, 0.08]} />
        <meshStandardMaterial color="#ecebe6" roughness={0.72} fog={false} />
      </mesh>
      <mesh position={[0.63, 0.04, 0.045]}>
        <boxGeometry args={[1.08, 2.15, 0.008]} />
        <meshStandardMaterial color="#eeede8" roughness={0.8} fog={false} />
      </mesh>
      <mesh position={[1.095, -0.15, 0.073]}>
        <boxGeometry args={[0.045, 0.17, 0.02]} />
        <meshStandardMaterial color="#8b8b86" metalness={0.6} roughness={0.4} fog={false} />
      </mesh>
      <mesh position={[1.04, -0.11, 0.11]}>
        <boxGeometry args={[0.17, 0.022, 0.025]} />
        <meshStandardMaterial color="#9c9b95" metalness={0.68} roughness={0.32} fog={false} />
      </mesh>
    </group>
  </group>;
}
