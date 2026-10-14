import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Euler, PCFSoftShadowMap } from 'three';
import { createMotion } from '../config/motion';
import { addLookInput, advanceMotion, resumeMotion, suspendMotion } from '../motion/MotionKernel';
import { ReflectionEnvironment } from './StudyLighting';
import { ReferenceStructure } from './ReferenceStructure';
import { ReferenceContact } from './ReferenceContact';
import { REFERENCE_VIEW } from './referenceModel';
import './spaceStudy.css';
import './referenceStudy.css';

function ReferenceCamera({ reset }: { reset: { current: (() => void) | null } }) {
  const { camera, gl, scene } = useThree();
  const motion = useRef(createMotion()).current, rotation = useMemo(() => new Euler(0,0,0,'YXZ'), []);
  useEffect(() => {
    const restore = () => { motion.phase='exploring';motion.paused=true;motion.z=-4;motion.yaw=motion.targetYaw=REFERENCE_VIEW.yaw;motion.pitch=motion.targetPitch=REFERENCE_VIEW.pitch;motion.yawVelocity=motion.pitchVelocity=0; };
    restore();reset.current=restore;
    const canvas=gl.domElement;let pointer:number|null=null,x=0,y=0;
    const end=()=>{const id=pointer;pointer=null;motion.dragging=false;if(id!==null&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);};
    const down=(e:PointerEvent)=>{if(e.button!==0||!e.isPrimary||pointer!==null)return;resumeMotion(motion);pointer=e.pointerId;x=e.clientX;y=e.clientY;canvas.setPointerCapture(pointer);};
    const move=(e:PointerEvent)=>{if(pointer!==e.pointerId)return;if(!(e.buttons&1)){end();return;}const s=Math.PI/canvas.clientWidth;addLookInput(motion,(e.clientX-x)*s,(y-e.clientY)*s);x=e.clientX;y=e.clientY;motion.dragging=true;};
    const blur=()=>{end();suspendMotion(motion);},focus=()=>{if(!document.hidden)resumeMotion(motion);};
    const visibility=()=>document.hidden?blur():focus();
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
    window.addEventListener('blur',blur);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);
    if(import.meta.env.DEV) window.__referenceStudy={snapshot:()=>({motion:{...motion},position:camera.position.toArray(),structure:scene.getObjectByName('reference-structure')?.userData,drawCalls:gl.info.render.calls,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures})};
    return()=>{end();reset.current=null;delete window.__referenceStudy;canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',end);canvas.removeEventListener('lostpointercapture',end);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);};
  },[motion,camera,gl,scene,reset]);
  useFrame((_,dt)=>{advanceMotion(motion,dt);camera.position.set(...REFERENCE_VIEW.eye);camera.quaternion.setFromEuler(rotation.set(motion.pitch,-motion.yaw,0,'YXZ'));},-2);
  return null;
}

function ReferenceLighting() {
  return <group>
    <ReflectionEnvironment/>
    <ambientLight intensity={.025} color="#d9d6cf"/>
    <hemisphereLight intensity={.12} color="#e4dfd2" groundColor="#161714"/>
    <directionalLight position={[-90,130,15]} intensity={2.0} color="#f4eee0" castShadow
      shadow-mapSize={[4096,4096]} shadow-camera-left={-210} shadow-camera-right={210} shadow-camera-top={210} shadow-camera-bottom={-210}
      shadow-camera-near={1} shadow-camera-far={600} shadow-normalBias={.1} shadow-bias={-.00005} shadow-radius={3}/>
    <directionalLight position={[60,30,100]} intensity={.18} color="#c9cbd0"/>
    <rectAreaLight position={[18,90,-100]} width={65} height={70} color="#f1e7d4" intensity={1.8}/>
    <rectAreaLight position={[-63,40,-155]} width={38} height={70} color="#efe6d6" intensity={1.8}/>
    <rectAreaLight position={[105,35,-65]} rotation={[0,-Math.PI/2,0]} width={38} height={55} color="#f0e6d2" intensity={1.8}/>
    <pointLight position={[-33,22,-109]} color="#f4e7cf" intensity={1800} distance={115} decay={2}/>
    <mesh position={[65,72,-310]}>
      <planeGeometry args={[105,155]}/>
      <shaderMaterial depthWrite={false} vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
        fragmentShader="varying vec2 vUv;void main(){float glow=exp(-pow((vUv.x-.55)*1.6,2.0)-pow((vUv.y-.7)*1.4,2.0));gl_FragColor=vec4(vec3(.38,.35,.29)+vec3(.55,.53,.47)*glow,1.0);}"/>
    </mesh>
    <mesh position={[-24,12,-326]}>
      <planeGeometry args={[54,68]}/><meshBasicMaterial color="#c8beaa" toneMapped={false}/>
    </mesh>
  </group>;
}

export function ReferenceStudy() {
  const reset=useRef<(()=>void)|null>(null);
  useEffect(()=>{document.title='Mathverse · 层叠巨构重建';},[]);
  return <main className="space-study reference-study" aria-label="层叠巨构参考图首帧重建">
    <Canvas className="study-canvas" dpr={[1,1.5]} shadows camera={{position:REFERENCE_VIEW.eye,fov:REFERENCE_VIEW.fov,near:.2,far:REFERENCE_VIEW.far}}
      gl={{antialias:true,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping}} onCreated={({gl})=>{gl.shadowMap.type=PCFSoftShadowMap;gl.toneMappingExposure=1.1;}}>
      <color attach="background" args={['#101211']}/><fogExp2 attach="fog" args={['#91897a',.0028]}/>
      <ReferenceCamera reset={reset}/><ReferenceStructure/><ReferenceLighting/><ReferenceContact/>
    </Canvas>
    <header className="study-header"><div className="study-wordmark">Mathverse<span>LAYERED MEGASTRUCTURE / 01</span></div><nav className="reference-nav"><a href="/artifacts/spaces/megastructure/megastructure-reference/index.html">参考图对照 ↗</a><a href="/space-a/euler/">上一版 ↗</a></nav></header>
    <footer className="reference-footer"><div><span>结构研究 · 第一帧</span><p>厚重实体、层叠进深、暗处透光。</p></div><button onClick={()=>reset.current?.()}>回到初始视角 ↗</button><small>按住拖拽，缓慢环顾</small></footer>
  </main>;
}
declare global { interface Window { __referenceStudy?: {snapshot:()=>Record<string,unknown>}; } }
