import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {AmbientLight,DirectionalLight,Group,HemisphereLight} from 'three';
import type {MotionState} from '../config/motion';
import {lightPassage} from '../config/atmosphere';

export function Lighting({motion}:{motion:MotionState}) {
  const ambient=useRef<AmbientLight>(null),sky=useRef<HemisphereLight>(null),key=useRef<DirectionalLight>(null),warm=useRef<DirectionalLight>(null),root=useRef<Group>(null);
  useFrame(()=>{
    const inside=lightPassage(motion.z),t=motion.spaceTime;
    if(ambient.current)ambient.current.intensity=.70-inside*.49;
    if(sky.current)sky.current.intensity=.14+inside*.19;
    if(key.current)key.current.intensity=1.05+inside*.70*(.97+.03*Math.sin(t*.032));
    if(warm.current)warm.current.intensity=.24+inside*.54*(.96+.04*Math.sin(t*.024+1.2));
    if(root.current)root.current.userData={interior:inside,time:t,exposure:.96,key:key.current?.intensity,warm:warm.current?.intensity};
  },0.3);
  return <group ref={root} name="cinematic-lighting">
    <ambientLight ref={ambient} intensity={.7} color="#e9eeeb"/>
    <hemisphereLight ref={sky} intensity={.14} color="#bfc9c7" groundColor="#161916"/>
    <directionalLight position={[-4,8,9]} intensity={2.8} color="#fffdf7" castShadow
      shadow-mapSize={[1024,1024]} shadow-camera-left={-3} shadow-camera-right={3}
      shadow-camera-top={5} shadow-camera-bottom={-2} shadow-camera-near={0.1}
      shadow-camera-far={22} shadow-bias={-0.0002} shadow-normalBias={0.012} shadow-radius={5} />
    <directionalLight ref={key} position={[-14,15,-16]} intensity={1.05} color="#d2dddc"/>
    <directionalLight ref={warm} position={[11,5,-29]} intensity={.24} color="#dccca8"/>
    <directionalLight position={[2,-8,-54]} intensity={.34} color="#b2c1be"/>
  </group>;
}
