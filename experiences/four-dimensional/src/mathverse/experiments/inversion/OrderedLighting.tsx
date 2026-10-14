import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AmbientLight, DirectionalLight, Group, HemisphereLight, Vector3 } from 'three';
import type { MotionState } from '../../config/motion';
import { lightPassage } from '../../config/atmosphere';
import { ReflectionEnvironment } from '../../shared/rendering/StudyLighting';

export function OrderedLighting({ motion }: { motion: MotionState }) {
  const root = useRef<Group>(null), key = useRef<DirectionalLight>(null), ambient = useRef<AmbientLight>(null), sky = useRef<HemisphereLight>(null);
  const basis = useMemo(() => { const direction = new Vector3(-80, 110, 65).normalize(), right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize(), up = new Vector3().crossVectors(direction, right);
    return { direction, right, up, center: new Vector3(), snapped: new Vector3() }; }, []);
  useFrame(() => {
    const inside = lightPassage(motion.z);
    if (ambient.current) ambient.current.intensity = .7 * (1 - inside) + .08 * inside;
    if (sky.current) sky.current.intensity = .14 * (1 - inside) + .3 * inside;
    const { center, snapped, right, up, direction } = basis; center.set(0, 1.55, motion.z - 80);
    snapped.copy(right).multiplyScalar(Math.round(center.dot(right) / (340 / 2048)) * (340 / 2048))
      .addScaledVector(up, Math.round(center.dot(up) / (280 / 2048)) * (280 / 2048)).addScaledVector(direction, center.dot(direction));
    if (key.current) { key.current.position.copy(snapped).addScaledVector(direction, 300); key.current.target.position.copy(snapped); key.current.target.updateMatrixWorld(); }
    if (root.current) root.current.userData = { animatedIntensity: false, worldDirection: direction.toArray(), coverageTexelSnapped: true, bloom: false, exposure: 1 };
  }, -.5);
  return <group ref={root} name="ordered-lighting"><ReflectionEnvironment/>
    <ambientLight ref={ambient} intensity={.7} color="#e9e7e1"/><hemisphereLight ref={sky} intensity={.14} color="#e0ded7" groundColor="#121315"/>
    <directionalLight position={[-4, 8, 9]} intensity={2.8} color="#fffdf7" castShadow shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={5} shadow-camera-bottom={-2} shadow-camera-near={.1} shadow-camera-far={22} shadow-bias={-.0002} shadow-normalBias={.012} shadow-radius={5}/>
    <directionalLight ref={key} intensity={2} color="#efede7" castShadow shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-170} shadow-camera-right={170} shadow-camera-top={140} shadow-camera-bottom={-140} shadow-camera-near={1} shadow-camera-far={620}
      shadow-bias={-.00008} shadow-normalBias={.035} shadow-radius={3} shadow-intensity={.65}/>
    <directionalLight position={[80, -10, -180]} intensity={.8} color="#c3c7cb"/>
  </group>;
}
