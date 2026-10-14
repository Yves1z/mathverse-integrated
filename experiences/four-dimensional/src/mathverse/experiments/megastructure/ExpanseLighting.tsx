import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { DirectionalLight, Group, Vector3 } from 'three';
import type { MotionState } from '../../config/motion';
import { ReflectionEnvironment } from '../../shared/rendering/StudyLighting';
import { EXPANSE } from './expanseModel';

export function ExpanseLighting({ motion }: { motion: MotionState }) {
  const root = useRef<Group>(null), key = useRef<DirectionalLight>(null);
  const [first, setFirst] = useState(-1);
  const sections = useMemo(() => Array.from({ length: 4 }, (_, i) => first + i), [first]);
  const basis = useMemo(() => {
    const direction = new Vector3(-32, 44, 22).normalize();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
    return { direction, right, up: new Vector3().crossVectors(direction, right), center: new Vector3(), snapped: new Vector3() };
  }, []);
  useFrame(() => {
    const next = Math.floor(motion.distance / EXPANSE.pitch) - 1;
    if (next !== first) setFirst(next);
    const { direction, right, up, center, snapped } = basis;
    center.set(-40, 8, motion.z - 160);
    snapped.copy(right).multiplyScalar(Math.round(center.dot(right) / (440 / 2048)) * (440 / 2048))
      .addScaledVector(up, Math.round(center.dot(up) / (400 / 2048)) * (400 / 2048)).addScaledVector(direction, center.dot(direction));
    if (key.current) {
      key.current.position.copy(snapped).addScaledVector(direction, 500);
      key.current.target.position.copy(snapped); key.current.target.updateMatrixWorld();
    }
    if (root.current) root.current.userData = { shadowMaps: 1, texelSnapped: true, lightSections: sections,
      areaLights: sections.length + 1, animatedIntensity: false, coverage: [440, 400], fog: EXPANSE.fog, far: EXPANSE.far };
  }, -.5);
  return <group ref={root} name="study-lighting">
    <ReflectionEnvironment/>
    <ambientLight intensity={.025} color="#d9dadb"/>
    <hemisphereLight intensity={.10} color="#e0dfdc" groundColor="#131415"/>
    <directionalLight ref={key} color="#f3f0ea" intensity={1.9} castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-220} shadow-camera-right={220}
      shadow-camera-top={200} shadow-camera-bottom={-200} shadow-camera-near={1} shadow-camera-far={1100}
      shadow-bias={-.00006} shadow-normalBias={.09} shadow-radius={3.2} shadow-intensity={.85}/>
    <directionalLight position={[150, 90, -100]} color="#e2e3e3" intensity={.55}/>
    {sections.map(section => <rectAreaLight key={section} position={[-245, 130, -120 - section * EXPANSE.pitch]}
      rotation={[-.25, -1.05, 0]} width={110} height={90} color="#f0eee8" intensity={5.2}/>)}
    <rectAreaLight position={[-128, 75, -135]} rotation={[-.25, .15, 0]} width={50} height={60} color="#ebe8df" intensity={2.2}/>
  </group>;
}
