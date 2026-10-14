import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, DirectionalLight, Euler, PCFSoftShadowMap, Raycaster, Vector2, Vector3 } from 'three';
import { createMotion, MOTION, type MotionState } from '../../config/motion';
import { addLookInput, advanceMotion, resumeMotion, suspendMotion } from '../../motion/MotionKernel';
import { ReflectionEnvironment } from '../../shared/rendering/StudyLighting';
import { ReferenceStructure } from '../../shared/rendering/ReferenceStructure';
import { ReferenceContact } from '../../shared/rendering/ReferenceContact';
import { ReferenceExchange } from '../../shared/projection/ReferenceExchange';
import { ReferenceExchangeController } from '../../shared/projection/referenceExchangeModel';
import { MegaEulerWorld } from '../../shared/math/MegaEulerWorld';
import { ReferenceObservation } from '../../shared/reading/ReferenceObservation';
import {ReferenceAir} from '../../shared/rendering/ReferenceAir';
import { referenceEulerLayout, referenceEulerPoint } from './referenceEulerModel';
import { createMathAssets, disposeMathAssets } from '../../content/assets';
import { createContentRuntime, type ContentRuntime } from '../../content/runtime';
import { NODE_BY_ID } from '../../content/nodes';
import { pickNode } from '../../content/picking';
import { advanceReading, closeReading, createReading, openReading, setHovered, switchReading, type ReadingPhase, type ReadingState } from '../../reading/ReadingKernel';
import { ReadingPanel } from '../../reading/ReadingUI';
import { createWindowAssets, disposeWindowAssets } from '../../windows/WindowAssets';
import { journeyCell, journeyCells, REFERENCE_JOURNEY, REFERENCE_VIEW } from './referenceModel';
import '../../shared/styles/spaceStudy.css';
import './referenceStudy.css';
import '../../shared/styles/spaceWorlds.css';

function ReferenceCamera({ motion, reset, extended, startDistance, onCell, exchange, reading, runtime, onOpen, onHover, onReadingPhase }: {
  motion: MotionState; reset: { current: ((restart?: boolean) => void) | null }; extended: boolean; startDistance: number; onCell: (cell: number) => void;
  exchange: ReferenceExchangeController | null;
  reading:ReadingState|null;runtime:ContentRuntime|null;onOpen:(id:string)=>void;onHover:(id:string|null)=>void;onReadingPhase:(phase:ReadingPhase)=>void;
}) {
  const { camera, gl, scene } = useThree(), lastCell = useRef(journeyCell(startDistance));
  const rotation = useMemo(() => new Euler(0,0,0,'YXZ'), []);
  const refreshHover=useRef<(()=>void)|null>(null),hoverClock=useRef(0);
  useEffect(() => {
    motion.phase='exploring';motion.distance=startDistance;motion.z=-4-startDistance;
    motion.yaw=motion.targetYaw=REFERENCE_VIEW.yaw;motion.pitch=motion.targetPitch=REFERENCE_VIEW.pitch;
    motion.speed=motion.paused?0:MOTION.explorationSpeed;
    const restore = (restart=false) => {
      resumeMotion(motion);
      if(restart){exchange?.reset();motion.distance=0;motion.z=-4;motion.speed=0;motion.yaw=REFERENCE_VIEW.yaw;motion.pitch=REFERENCE_VIEW.pitch;motion.yawVelocity=motion.pitchVelocity=0;lastCell.current=0;onCell(0);}
      motion.targetYaw=Math.round((motion.yaw-REFERENCE_VIEW.yaw)/(2*Math.PI))*2*Math.PI+REFERENCE_VIEW.yaw;
      motion.targetPitch=REFERENCE_VIEW.pitch;
    };reset.current=restore;
    const canvas=gl.domElement;let pointer:number|null=null,x=0,y=0,originX=0,originY=0,maximumDistance=0;
    const ray=new Raycaster(),ndc=new Vector2(),mouse={x:NaN,y:NaN};
    const candidate=(e:{clientX:number;clientY:number})=>{if(!runtime)return null;const rect=canvas.getBoundingClientRect();ndc.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);camera.updateMatrixWorld();ray.setFromCamera(ndc,camera);return pickNode(ray,runtime);};
    const hover=(id:string|null)=>{if(!reading||reading.hoveredId===id)return;setHovered(reading,id);onHover(id);canvas.classList.toggle('over-math',!!id);};
    const end=()=>{const id=pointer;pointer=null;motion.dragging=false;canvas.classList.remove('is-dragging');if(id!==null&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);};
    const down=(e:PointerEvent)=>{if(e.button!==0||!e.isPrimary||pointer!==null||reading&&reading.phase!=='closed')return;resumeMotion(motion);pointer=e.pointerId;maximumDistance=0;originX=x=e.clientX;originY=y=e.clientY;canvas.setPointerCapture(pointer);};
    const move=(e:PointerEvent)=>{
      mouse.x=e.clientX;mouse.y=e.clientY;if(reading&&reading.phase!=='closed')return;
      if(pointer===null){hover(candidate(e));return;}if(pointer!==e.pointerId)return;if(!(e.buttons&1)){end();return;}
      maximumDistance=Math.max(maximumDistance,Math.hypot(e.clientX-originX,e.clientY-originY));
      if(!motion.dragging&&maximumDistance<MOTION.dragThreshold)return;hover(null);
      const s=Math.PI/canvas.clientWidth, clamp=(n:number)=>Math.max(-MOTION.maxPointerAngle,Math.min(MOTION.maxPointerAngle,n));
      addLookInput(motion,clamp((e.clientX-x)*s),clamp((y-e.clientY)*s));x=e.clientX;y=e.clientY;motion.dragging=true;canvas.classList.add('is-dragging');
    };
    const up=(e:PointerEvent)=>{if(pointer!==e.pointerId)return;maximumDistance=Math.max(maximumDistance,Math.hypot(e.clientX-originX,e.clientY-originY));const id=!motion.dragging&&maximumDistance<MOTION.dragThreshold?candidate(e):null;end();if(id&&runtime){mouse.x=mouse.y=NaN;hover(null);runtime.openCount++;onOpen(id);}};
    const leave=()=>{mouse.x=mouse.y=NaN;if(pointer===null)hover(null);};
    refreshHover.current=()=>{if(reading?.phase!=='closed'||motion.dragging||!Number.isFinite(mouse.x)||document.elementFromPoint(mouse.x,mouse.y)!==canvas)return;hover(candidate({clientX:mouse.x,clientY:mouse.y}));};
    const blur=()=>{mouse.x=mouse.y=NaN;end();hover(null);suspendMotion(motion);},focus=()=>{if(!document.hidden)resumeMotion(motion);};
    const visibility=()=>document.hidden?blur():focus();
    const key=(e:KeyboardEvent)=>{if(reading&&reading.phase!=='closed'||e.target instanceof HTMLElement&&e.target.closest('button,a,input'))return;
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;resumeMotion(motion);
      addLookInput(motion,e.key==='ArrowLeft'?-.18:e.key==='ArrowRight'?.18:0,e.key==='ArrowUp'?.12:e.key==='ArrowDown'?-.12:0);e.preventDefault();};
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
    window.addEventListener('blur',blur);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);window.addEventListener('keydown',key);
    if(import.meta.env.DEV)window.__referenceStudy={snapshot:()=>({motion:{...motion},position:camera.position.toArray(),structure:scene.getObjectByName('reference-structure')?.userData,lighting:scene.getObjectByName('reference-lighting')?.userData,air:scene.getObjectByName('reference-air')?.userData,contact:scene.userData.contactShadows,fold:scene.getObjectByName('reference-exchange')?.userData,world:scene.getObjectByName('mega-euler-world')?.userData,figures:['unit-circle','complex-rotation'].map(id=>scene.getObjectByName(`cell-volume-${id}`)?.userData),trace:scene.getObjectByName('euler-cell-trace')?.userData,reading:reading?{...reading}:null,observation:runtime?.observation,euler:runtime?.euler,nodes:runtime?[...runtime.nodes].map(([id,n])=>({id,position:n.position.toArray(),screen:n.visualScreen.toArray(),bounds:n.bounds,onScreen:n.onScreen,occluded:n.occluded})):[],picking:runtime?{opened:runtime.openCount,blocked:runtime.blockedCount}:null,extended,drawCalls:gl.info.render.calls,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures})};
    return()=>{end();refreshHover.current=null;reset.current=null;delete window.__referenceStudy;canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointercancel',end);canvas.removeEventListener('lostpointercapture',end);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('keydown',key);};
  },[motion,camera,gl,scene,reset,extended,startDistance,onCell,exchange,reading,runtime,onOpen,onHover,onReadingPhase]);
  useFrame((_,dt)=>{
    advanceMotion(motion,dt);
    if(reading){const phase=reading.phase;advanceReading(motion,reading,motion.frameDt);if(reading.phase!==phase)onReadingPhase(reading.phase);}
    camera.position.set(REFERENCE_VIEW.eye[0],REFERENCE_VIEW.eye[1],REFERENCE_VIEW.eye[2]-motion.distance);
    camera.quaternion.setFromEuler(rotation.set(motion.pitch,-motion.yaw,0,'YXZ'));
    const cell=journeyCell(motion.distance);if(extended&&cell!==lastCell.current){lastCell.current=cell;onCell(cell);}
    hoverClock.current+=motion.frameDt;if(hoverClock.current>.12){hoverClock.current=0;refreshHover.current?.();}
  },-2);
  return null;
}

function ReferenceLighting({ motion, first, extended,polished }: { motion: MotionState; first: number; extended: boolean;polished:boolean }) {
  const key=useRef<DirectionalLight>(null),cells=useMemo(()=>extended?journeyCells(first):[0],[first,extended]);
  const basis=useMemo(()=>{const direction=new Vector3(-90,130,15).normalize(),right=new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize();return{direction,right,up:new Vector3().crossVectors(direction,right),center:new Vector3(),snapped:new Vector3()};},[]);
  useFrame(()=>{
    if(!extended||!key.current)return;
    const{direction,right,up,center,snapped}=basis;center.set(0,20,REFERENCE_VIEW.eye[2]-motion.distance-90);
    const texel=800/4096;snapped.copy(right).multiplyScalar(Math.round(center.dot(right)/texel)*texel).addScaledVector(up,Math.round(center.dot(up)/texel)*texel).addScaledVector(direction,center.dot(direction));
    key.current.position.copy(snapped).addScaledVector(direction,650);key.current.target.position.copy(snapped);key.current.target.updateMatrixWorld();
  },-.5);
  return <group name="reference-lighting" userData={{cells,constantDirection:true,animatedIntensity:false,texelSnapped:extended,profile:polished?'graphite-warm-aperture':'previous'}}>
    <ReflectionEnvironment/>
    <ambientLight intensity={polished?.015:.025} color="#d9d6cf"/>
    <hemisphereLight intensity={polished?.09:.12} color={polished?'#d7dfdf':'#e4dfd2'} groundColor="#161714"/>
    <directionalLight ref={key} position={[-90,130,15]} intensity={polished?1.85:2.0} color={polished?'#ebece7':'#f4eee0'} castShadow
      shadow-mapSize={[4096,4096]} shadow-camera-left={extended?-400:-210} shadow-camera-right={extended?400:210} shadow-camera-top={extended?400:210} shadow-camera-bottom={extended?-400:-210}
      shadow-camera-near={1} shadow-camera-far={extended?1600:600} shadow-normalBias={.1} shadow-bias={-.00005} shadow-radius={3}/>
    <directionalLight position={[60,30,100]} intensity={polished?.14:.18} color="#c9cbd0"/>
    {cells.map(cell=><group key={cell} position={[0,0,-cell*REFERENCE_JOURNEY.pitch]}>
      <rectAreaLight position={[18,90,-100]} width={65} height={70} color="#f1e7d4" intensity={1.8}/>
      <rectAreaLight position={[-63,40,-155]} width={38} height={70} color="#efe6d6" intensity={1.8}/>
      <rectAreaLight position={[105,35,-65]} rotation={[0,-Math.PI/2,0]} width={38} height={55} color="#f0e6d2" intensity={1.8}/>
      <pointLight position={[-33,22,-109]} color="#f4e7cf" intensity={polished?1350:1800} distance={115} decay={2}/>
      {extended&&<rectAreaLight position={[-20,90,250]} rotation={[0,Math.PI,0]} width={60} height={80} color="#e9e2d1" intensity={1.8}/>}
      <mesh position={[65,72,-310]}><planeGeometry args={[105,155]}/>
        <shaderMaterial depthWrite={false} vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
          fragmentShader={polished?'varying vec2 vUv;void main(){float glow=exp(-pow((vUv.x-.55)*2.4,2.0)-pow((vUv.y-.7)*2.0,2.0));gl_FragColor=vec4(vec3(.12,.13,.12)+vec3(.27,.25,.21)*glow,1.0);}':'varying vec2 vUv;void main(){float glow=exp(-pow((vUv.x-.55)*1.6,2.0)-pow((vUv.y-.7)*1.4,2.0));gl_FragColor=vec4(vec3(.38,.35,.29)+vec3(.55,.53,.47)*glow,1.0);}'}/>
      </mesh>
      <mesh position={[-24,12,-326]}><planeGeometry args={[54,68]}/>{polished?<shaderMaterial vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
        fragmentShader="varying vec2 vUv;void main(){float glow=exp(-pow((vUv.x-.45)*1.8,2.0)-pow((vUv.y-.65)*1.7,2.0));gl_FragColor=vec4(vec3(.22,.205,.16)+vec3(.24,.21,.16)*glow,1.0);}"/>:<meshBasicMaterial color="#c8beaa" toneMapped={false}/>}</mesh>
    </group>)}
  </group>;
}

export function ReferenceStudy() {
  const extended=useMemo(()=>new URLSearchParams(location.search).get('study')!=='first',[]);
  const exchanging=useMemo(()=>extended&&new URLSearchParams(location.search).get('study')!=='journey',[extended]);
  const euler=useMemo(()=>exchanging&&new URLSearchParams(location.search).get('study')!=='exchange',[exchanging]);
  const polished=useMemo(()=>euler&&new URLSearchParams(location.search).get('finish')!=='previous',[euler]);
  const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  const review=useMemo(()=>new URLSearchParams(location.search).get('review'),[]);
  const startDistance=review==='cell-end'?599.95:review==='advanced'?90:0;
  const motion=useRef(createMotion()).current,reset=useRef<((restart?:boolean)=>void)|null>(null);
  const exchange=useMemo(()=>{if(!exchanging)return null;const c=new ReferenceExchangeController();if(review?.startsWith('fold-')){const p=Number(review.slice(5));if(Number.isFinite(p))c.review(p*Math.PI);}return c;},[exchanging,review]);
  const content=useMemo(()=>euler?{runtime:createContentRuntime(referenceEulerLayout()),reading:createReading(),assets:createMathAssets(),windows:createWindowAssets({neutral:true,textureWidth:640,textureHeight:410})}:null,[euler]);
  const worldFold=useMemo(()=>exchange?{angle:(_section:number)=>exchange.angle,get clock(){return exchange.clock;}}:null,[exchange]);
  const [first,setFirst]=useState(journeyCell(startDistance)),[paused,setPaused]=useState(!extended||reduced||!!review),[frozen,setFrozen]=useState(reduced||!!review),[ready,setReady]=useState(false);
  const [view,setView]=useState<{phase:ReadingPhase;selectedId:string|null}>({phase:'closed',selectedId:null}),[hovered,setHoveredId]=useState<string|null>(null),storyButton=useRef<HTMLButtonElement>(null);
  const active=view.phase!=='closed';
  useEffect(()=>()=>{if(content){disposeMathAssets(content.assets);disposeWindowAssets(content.windows);}},[content]);
  const updatePhase=useCallback((phase:ReadingPhase)=>{if(!content)return;setView({phase,selectedId:content.reading.selectedId});if(phase==='closed'){setPaused(content.reading.pausedBefore);requestAnimationFrame(()=>storyButton.current?.focus({preventScroll:true}));}},[content]);
  const requestReading=useCallback((id:string)=>{if(!content||document.hidden)return;const{runtime,reading}=content,node=runtime.nodes.get(id);if(!node||!openReading(motion,reading,id,node.position.toArray(),[5,8,110-motion.distance]))return;runtime.readingOrigin=node.onScreen&&!node.occluded?node.bounds:null;reading.angle=runtime.connection.angle%(Math.PI*2);setPaused(false);setHoveredId(null);setView({phase:reading.phase,selectedId:id});},[content,motion]);
  const dismiss=useCallback(()=>{if(content&&closeReading(motion,content.reading))setView({phase:content.reading.phase,selectedId:content.reading.selectedId});},[content,motion]);
  const change=useCallback((id:string)=>{if(content&&content.runtime.nodes.has(id)&&switchReading(content.reading,id))setView({phase:content.reading.phase,selectedId:id});},[content]);
  const hover=useCallback((id:string|null)=>setHoveredId(id),[]);
  motion.paused=paused;
  motion.spaceFrozen=frozen;
  useEffect(()=>{document.title=euler?'Mathverse · 巨构中的欧拉':exchanging?'Mathverse · 巨构深度交换':extended?'Mathverse · 巨构中的旅程':'Mathverse · 层叠巨构重建';},[extended,exchanging,euler]);
  return <main className={`space-study reference-study space-worlds ${active?'is-reading':''}`} aria-label={euler?'层叠巨构与欧拉世界':extended?'可行进的层叠巨构空间':'层叠巨构参考图首帧重建'}>
    <Canvas className="study-canvas" dpr={[1,1.5]} shadows camera={{position:REFERENCE_VIEW.eye,fov:REFERENCE_VIEW.fov,near:.2,far:REFERENCE_VIEW.far}}
      gl={{antialias:true,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping}} onCreated={({gl})=>{gl.shadowMap.type=PCFSoftShadowMap;gl.toneMappingExposure=1.1;setReady(true);}}>
      <color attach="background" args={['#101211']}/><fogExp2 attach="fog" args={[polished?'#596060':'#91897a',polished?.0018:.0028]}/>
      <ReferenceCamera motion={motion} reset={reset} extended={extended} startDistance={startDistance} onCell={setFirst} exchange={exchange} reading={content?.reading??null} runtime={content?.runtime??null} onOpen={requestReading} onHover={hover} onReadingPhase={updatePhase}/>
      <ReferenceStructure first={first} extended={extended} exchanging={exchanging} content={euler} polished={polished}/>{exchange&&<ReferenceExchange motion={motion} controller={exchange} reduced={reduced} polished={polished}/>}<ReferenceLighting motion={motion} first={first} extended={extended} polished={polished}/>{polished&&exchange&&<ReferenceAir clock={exchange} first={first}/>}<ReferenceContact polished={polished} first={first}/>
      {content&&worldFold&&<><MegaEulerWorld motion={motion} fold={worldFold} runtime={content.runtime} reading={content.reading} assets={content.assets} windows={content.windows} project={referenceEulerPoint} readingDuringFreeze/><ReferenceObservation reading={content.reading} runtime={content.runtime} windows={content.windows}/></>}
    </Canvas>
    <header className="study-header" inert={active}><div className="study-wordmark">Mathverse<span>LAYERED MEGASTRUCTURE / {polished?'05':euler?'04':exchanging?'03':extended?'02':'01'}</span></div><nav className="reference-nav">{euler&&<button ref={storyButton} disabled={!ready} onClick={()=>requestReading('leonhard-euler')}>欧拉的故事 ↗</button>}<a href={polished?'/artifacts/spaces/megastructure/megastructure-reference-light/index.html':euler?'/artifacts/spaces/megastructure/megastructure-reference-euler/index.html':exchanging?'/artifacts/spaces/megastructure/megastructure-exchange/index.html':extended?'/artifacts/spaces/megastructure/megastructure-journey/index.html':'/artifacts/spaces/megastructure/megastructure-reference/index.html'}>{polished?'光影对照 ↗':euler?'人物与空间 ↗':exchanging?'深度交换 ↗':extended?'环顾与行进 ↗':'参考图对照 ↗'}</a><a href={polished?'/space-a/reference/?finish=previous':euler?'/space-a/reference/?study=exchange':exchanging?'/space-a/reference/?study=journey':extended?'/space-a/reference/?study=first':'/space-a/euler/'}>{polished?'上一轮样片 ↗':euler?'纯空间样片 ↗':exchanging?'行进样片 ↗':extended?'首帧样片 ↗':'上一版 ↗'}</a></nav></header>
    <footer className="reference-footer" inert={active}><div><span>{extended?'在巨构之间，缓慢深入。':'结构研究 · 第一帧'}</span><p>{euler?'点击圆、曲面或纸页，停留片刻。':'厚重实体、层叠进深、暗处透光。'}</p></div>
      {extended&&<button disabled={!ready} onClick={()=>{resumeMotion(motion);setPaused(p=>!p);}}>{paused?'继续前进':'暂停前进'}</button>}
      {exchanging&&<button disabled={!ready} onClick={()=>{resumeMotion(motion);setFrozen(f=>!f);}}>{frozen?'继续空间变化':'定格空间'}</button>}
      <button disabled={!ready} onClick={()=>reset.current?.()}>回到初始视角 ↗</button>
      {extended&&<button disabled={!ready} onClick={()=>reset.current?.(true)}>重新进入</button>}
      <small>按住拖拽，缓慢环顾</small>
    </footer>
    {hovered&&!active&&<div className="hover-note" role="status"><span>{NODE_BY_ID.get(hovered)?.title}</span><p>{NODE_BY_ID.get(hovered)?.summary}</p><small>点击，停留片刻 ↗</small></div>}
    {content&&active&&view.selectedId&&<ReadingPanel reading={content.reading} runtime={content.runtime} selectedId={view.selectedId} onClose={dismiss} onSwitch={change}/>}
  </main>;
}
declare global { interface Window { __referenceStudy?: {snapshot:()=>Record<string,unknown>}; } }

