import { FrontSide, BackSide } from 'three';

const patches: Array<{ at: [number, number, number]; size: [number, number] }> = [
  { at: [-50.67, 0, -0.12], size: [100, 100] },
  { at: [50.67, 0, -0.12], size: [100, 100] },
  { at: [0, 26.225, -0.12], size: [1.34, 47.55] },
  { at: [0, -25, -0.12], size: [1.34, 50] },
];

export function WhiteEntrance() {
  return <group>
    {patches.map((patch, i) => <group key={i}>
      <mesh position={patch.at}>
        <planeGeometry args={patch.size} />
        <meshBasicMaterial color="#ffffff" side={FrontSide} fog={false} toneMapped={false} />
      </mesh>
      <mesh position={patch.at}>
        <planeGeometry args={patch.size} />
        <meshBasicMaterial color="#24221d" side={BackSide} />
      </mesh>
    </group>)}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 15]}>
      <planeGeometry args={[100, 30]} />
      <meshBasicMaterial color="#ffffff" fog={false} toneMapped={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.009, 0.7]} receiveShadow>
      <planeGeometry args={[6, 5]} />
      <shadowMaterial transparent opacity={0.14} />
    </mesh>
    <mesh position={[0, 15, 22]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial color="#ffffff" fog={false} toneMapped={false} />
    </mesh>
  </group>;
}
