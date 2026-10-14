import { Component,useCallback,useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
import { createMotion, MOTION, type Phase } from './config/motion';
import { VISUAL } from './config/visual';
import { CameraDirector } from './motion/CameraDirector';
import { beginEntrance, lookForward, resumeMotion } from './motion/MotionKernel';
import { WhiteEntrance } from './scene/WhiteEntrance';
import { Door } from './scene/Door';
import { FoldedField } from './scene/FoldedField';
import { Lighting } from './scene/Lighting';
import {Atmosphere} from './scene/Atmosphere';
import { createMathAssets,disposeMathAssets } from './content/assets';
import { createContentRuntime } from './content/runtime';
import { NODE_LAYOUT,nodePosition } from './content/layout';
import { MathField } from './content/MathField';
import { closeReading,createReading,openReading,setHovered,switchReading,type ReadingPhase } from './reading/ReadingKernel';
import { ObservationLayer } from './reading/ObservationLayer';
import { MathCatalog,NodeLabels,ReadingPanel } from './reading/ReadingUI';
import { NODE_BY_ID } from './content/nodes';
import {createWindowAssets,disposeWindowAssets} from './windows/WindowAssets';
import {WindowConnections} from './windows/WindowConnections';
import {readingRect} from './windows/windowMotion';
import { OrderedController, orderedLayout } from './revision/orderedModel';
import { OrderedField } from './revision/OrderedField';
import { OrderedWindows } from './revision/OrderedWindows';
import { OrderedLighting } from './revision/OrderedLighting';
import { OrderedInstrumentation, OrderedRhythm } from './revision/OrderedRhythm';
import { SpaceObservation } from './revision/SpaceObservation';
import { FusionField } from './revision/FusionField';
import { fusionPoint, threeWorldPoint } from './revision/fusionModel';
import { CavityField } from './revision/CavityField';
import { cavityPoint } from './revision/cavityModel';
import './revision/orderedHome.css';

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="scene-fallback" role="alert">
      <h2>空间暂时未能打开</h2><p>请重新加载页面，再试一次。</p>
      <button onClick={() => location.reload()}>重新打开</button>
    </div>;
    return this.props.children;
  }
}

export function MathverseHome({ inversion=false, skipEntrance=false, fusion=false, fusionContent=false, gaussianContent=false, eulerTrace=false, cavity=false }: { inversion?: boolean; skipEntrance?: boolean; fusion?: boolean; fusionContent?: boolean; gaussianContent?: boolean; eulerTrace?: boolean; cavity?: boolean }) {
  const motionRef = useRef(createMotion());
  const motion = motionRef.current;
  const reading=useRef(createReading()).current;
  const layout=useMemo(()=>inversion?orderedLayout(cavity ? cavityPoint : gaussianContent ? threeWorldPoint : fusion ? fusionPoint : undefined).map(p=>gaussianContent&&p.id==='gaussian-integral'?{...p,anchor:{...p.anchor,localPosition:threeWorldPoint(2,[0,0,0,-1],0)}}:p):NODE_LAYOUT,[inversion,fusion,gaussianContent,cavity]);
  const runtime=useMemo(()=>createContentRuntime(layout),[layout]),assets=useMemo(createMathAssets,[]);
  const windows=useMemo(()=>createWindowAssets(inversion?{neutral:true,textureWidth:640,textureHeight:410}:undefined),[inversion]);
  const fold=useMemo(()=>new OrderedController(gaussianContent ? (_z, events) => events % 3 : fusionContent ? (_z, events) => events % 2 : fusion ? () => 0 : undefined, gaussianContent ? 'euler-mobius-gaussian-out-then-return' : fusionContent ? 'euler-mobius-euler-return-mobius-return' : fusion ? 'inhabited-cell-out-in' : undefined),[fusion,fusionContent,gaussianContent]);
  const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  const [readingView,setReadingView]=useState<{phase:ReadingPhase;selectedId:string|null}>({phase:'closed',selectedId:null});
  const [catalogOpen,setCatalogOpen]=useState(false),[hoveredId,setHoveredId]=useState<string|null>(null);
  const indexButton=useRef<HTMLButtonElement>(null),focusOrigin=useRef<HTMLElement|null>(null);
  const readingActive=readingView.phase!=='closed';
  useEffect(()=>()=>disposeMathAssets(assets),[assets]);
  useEffect(()=>()=>disposeWindowAssets(windows),[windows]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [showHint, setShowHint] = useState(true);
  const [spaceFrozen, setSpaceFrozen] = useState(inversion&&reduced);
  useEffect(()=>{
    if(!inversion)return;document.title=cavity?'Mathverse · 思想的内腔':fusion?'Mathverse · 世界在结构中展开':'Mathverse · 有序的第四维';
    if(skipEntrance){motion.phase='exploring';motion.z=MOTION.entryEndZ;motion.pitch=motion.targetPitch=cavity?.06:fusion?.10:.08;motion.yaw=motion.targetYaw=cavity?-.18:fusion?-.46:-.32;motion.speed=reduced?0:MOTION.explorationSpeed;setPhase('exploring');}
  },[inversion,skipEntrance,motion,reduced,fusion,cavity]);
  useEffect(() => { motion.paused = paused; }, [motion, paused]);
  useEffect(() => { motion.spaceFrozen = spaceFrozen; }, [motion, spaceFrozen]);
  useEffect(() => {
    if (phase !== 'exploring') return;
    const timer = setTimeout(() => setShowHint(false), 4500);
    return () => clearTimeout(timer);
  }, [phase]);
  const enter = useCallback(() => {
    if (!ready || document.hidden || !beginEntrance(motion)) return;
    setPhase('entering');
  }, [motion, ready]);
  const returnForward = () => { resumeMotion(motion); lookForward(motion); };
  const toggleTravel = () => { resumeMotion(motion); setPaused(value => !value); };
  const toggleSpace = () => {
    resumeMotion(motion);
    setSpaceFrozen(value => !value);
  };
  const updateReadingPhase=useCallback((next:ReadingPhase)=>{
    setReadingView({phase:next,selectedId:reading.selectedId});
    if(next==='closed'){
      setPaused(reading.pausedBefore);
      requestAnimationFrame(()=>{
        const origin=focusOrigin.current;
        if(origin?.isConnected&&origin.getAttribute('aria-hidden')!=='true'&&getComputedStyle(origin).visibility!=='hidden')origin.focus({preventScroll:true});
        else indexButton.current?.focus({preventScroll:true});
      });
    }
  },[reading]);
  const requestReading=useCallback((id:string,origin?:HTMLElement)=>{
    const placement=layout.find(node=>node.id===id);if(!placement||document.hidden)return;
    if(!openReading(motion,reading,id,runtime.nodes.get(id)?.position.toArray()??nodePosition(placement)))return;
    const visibleNode=runtime.nodes.get(id);runtime.readingOrigin=inversion?(visibleNode?.onScreen&&!visibleNode.occluded?visibleNode.bounds:null):visibleNode?.bounds??null;
    reading.angle=((runtime.connection.angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    focusOrigin.current=origin??indexButton.current;
    setPaused(false);setCatalogOpen(false);setHoveredId(null);setShowHint(false);
    setReadingView({phase:reading.phase,selectedId:id});
  },[motion,reading,runtime,layout,inversion]);
  const dismissReading=useCallback(()=>{if(closeReading(motion,reading)){
    runtime.readingOrigin=runtime.nodes.get(reading.selectedId!)?.bounds??readingRect(innerWidth,innerHeight);
    setReadingView({phase:reading.phase,selectedId:reading.selectedId});
  }},[motion,reading,runtime]);
  const changeReading=useCallback((id:string)=>{if(NODE_BY_ID.has(id)&&switchReading(reading,id))setReadingView({phase:reading.phase,selectedId:id});},[reading]);
  const hoverNode=useCallback((id:string|null)=>{setHovered(reading,id);setHoveredId(id);},[reading]);
  const dismissCatalog=useCallback(()=>{setCatalogOpen(false);requestAnimationFrame(()=>indexButton.current?.focus({preventScroll:true}));},[]);

  return <main className={`mathverse mode-${phase} ${inversion?'ordered-home':''} ${fusion?'fusion-home':''} ${readingActive?'is-reading':''}`} aria-label="Mathverse 数学空间">
    <SceneBoundary>
      <Canvas className="world-canvas" shadows dpr={[1, 1.5]}
        camera={{ fov: MOTION.fov, near: MOTION.near, far: inversion?620:MOTION.far, position: [0, MOTION.eyeHeight, MOTION.initialZ] }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
        onCreated={({ gl }) => { gl.shadowMap.type = PCFSoftShadowMap; setReady(true); }}
        onPointerDown={() => { if (phase === 'exploring') setShowHint(false); }}
        fallback={<div className="scene-fallback"><h2>这个浏览器暂时无法显示三维空间</h2><p>请换一个支持三维显示的浏览器，再打开 Mathverse。</p></div>}
      >
        <color attach="background" args={[inversion?'#08090a':VISUAL.dark]} />
        <fogExp2 attach="fog" args={[inversion?'#08090a':VISUAL.dark, cavity ? .0065 : fusion ? .0038 : inversion ? .006 : VISUAL.fogDensity]} />
        <CameraDirector motion={motion} onPhase={setPhase} reading={reading} runtime={runtime} onOpen={requestReading} onHover={setHoveredId} onReadingPhase={updateReadingPhase} priority={inversion?-2:0}/>
        {inversion?<OrderedLighting motion={motion}/>:<Lighting motion={motion}/>}
        {!skipEntrance&&<group visible={!inversion||phase!=='exploring'}><WhiteEntrance/><Door motion={motion} onEnter={enter}/></group>}
        {inversion?<>{cavity?<CavityField motion={motion} fold={fold} reduced={reduced}/>:fusion?<FusionField motion={motion} fold={fold} reduced={reduced} fusionContent={fusionContent} gaussianContent={gaussianContent}/>:<OrderedField motion={motion} fold={fold} reduced={reduced}/>}
          <OrderedWindows motion={motion} fold={fold} reading={reading} runtime={runtime} assets={assets} windows={windows} fusion={fusion} fusionContent={fusionContent} gaussianContent={gaussianContent} eulerTrace={eulerTrace} quietLabels={cavity} project={cavity?cavityPoint:gaussianContent?threeWorldPoint:fusion?fusionPoint:undefined}/>
          <SpaceObservation motion={motion} reading={reading} runtime={runtime} windows={windows}/>
          <OrderedInstrumentation fold={fold} runtime={runtime}/></>:<><FoldedField motion={motion}/><Atmosphere motion={motion}/>
          <WindowConnections motion={motion} reading={reading} runtime={runtime}/><MathField motion={motion} reading={reading} runtime={runtime} assets={assets} windows={windows}/>
          <ObservationLayer motion={motion} reading={reading} selectedId={readingView.selectedId} runtime={runtime} windows={windows}/></>}
      </Canvas>
    </SceneBoundary>

    <header className="chrome header" inert={readingActive||catalogOpen}>
      <div className="wordmark"><span className="mark" aria-hidden="true">∞</span><span>Mathverse</span></div>
      {phase === 'idle' ? <span className="header-note">在无限之前。</span> :
        <div className="header-actions"><button ref={indexButton} className="quiet-button catalog-button" onClick={()=>{setCatalogOpen(true);hoverNode(null);}} disabled={phase!=='exploring'}>数学索引<span aria-hidden="true">＋</span></button><button className="quiet-button pause-button" disabled={phase !== 'exploring'} onClick={toggleTravel}>
          <span className={paused ? 'play-symbol' : 'pause-symbol'} aria-hidden="true" />
          {paused ? '继续旅程' : '暂停旅程'}
        </button></div>}
    </header>

    {phase !== 'exploring' && <section className={`entrance-caption ${phase === 'entering' ? 'is-leaving' : ''}`} aria-label="空间入口">
      <p>一扇门。另一种维度。</p>
      <button className="enter-button" onClick={enter} disabled={!ready || phase !== 'idle'}>
        <span>{ready ? '推门进入' : '正在准备空间'}</span><span aria-hidden="true">↗</span>
      </button>
    </section>}

    <footer className="chrome footer" inert={readingActive||catalogOpen}>
      {phase === 'exploring' ? <>
        <button className="quiet-button dimension-button" onClick={toggleSpace}><span className="journey-line" aria-hidden="true" />{spaceFrozen ? '让空间继续流动' : '定格空间'}</button>
        <p className={`drag-hint ${showHint ? 'is-visible' : ''}`}>按住鼠标，环顾四周</p>
        <button className="quiet-button forward-button" onClick={returnForward}>看向前方<span aria-hidden="true">↗</span></button>
      </> : <><span className="entry-footnote">改变视角，发现新的世界。</span><span className="edition">MATHEMATICS · INFINITY</span></>}
    </footer>
    {phase==='exploring'&&<div inert={readingActive||catalogOpen}><NodeLabels runtime={runtime} onOpen={requestReading} onHover={hoverNode}/></div>}
    {phase==='exploring'&&!catalogOpen&&!inversion&&<div className="relation-caption" ref={element=>{runtime.relationLabel=element;}} aria-hidden="true"><span>ONE CIRCLE · THREE DEPTHS</span><p>抬头，让三个世界接成同一个圆</p><small>e<sup>iθ</sup> = cos θ + i sin θ</small></div>}
    {inversion&&phase==='exploring'&&<div inert={readingActive||catalogOpen}><OrderedRhythm fold={fold} motion={motion} reduced={reduced} caption={cavity?'巨构深处，内外交换':gaussianContent?'三个世界，依次展开':fusionContent?'两个世界，依次展开':fusion?'同一世界，内外交换':undefined} onUnfreeze={()=>{resumeMotion(motion);motion.spaceFrozen=false;setSpaceFrozen(false);}}/></div>}
    {hoveredId&&!readingActive&&!catalogOpen&&<div className="hover-note" role="status"><span>{NODE_BY_ID.get(hoveredId)?.title}</span><p>{NODE_BY_ID.get(hoveredId)?.summary}</p><small>点击，停留片刻 ↗</small></div>}
    {catalogOpen&&<MathCatalog onClose={dismissCatalog} onOpen={requestReading}/>}
    {readingActive&&readingView.selectedId&&<ReadingPanel reading={reading} runtime={runtime} selectedId={readingView.selectedId} onClose={dismissReading} onSwitch={changeReading}/>}
    <div className="sr-only" aria-live="polite">{phase === 'exploring' ? '已进入数学空间。摄像头缓慢前进，拖拽可以环顾四周，也可以暂停旅程。' : phase === 'entering' ? '门正在打开。' : '纯白空间中央有一扇门，点击推门进入。'}</div>
  </main>;
}

