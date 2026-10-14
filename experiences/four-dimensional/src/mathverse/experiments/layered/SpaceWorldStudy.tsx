import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFShadowMap } from 'three';
import { createMotion, MOTION, type MotionState } from '../../config/motion';
import { CameraDirector } from '../../motion/CameraDirector';
import { addLookInput, lookForward, resumeMotion } from '../../motion/MotionKernel';
import { createMathAssets, disposeMathAssets } from '../../content/assets';
import { createContentRuntime, type ContentRuntime } from '../../content/runtime';
import { NODE_BY_ID } from '../../content/nodes';
import { closeReading, createReading, openReading, setHovered, switchReading, type ReadingPhase } from '../../reading/ReadingKernel';
import { MathCatalog, NodeLabels, ReadingPanel } from '../../reading/ReadingUI';
import { createWindowAssets, disposeWindowAssets } from '../../windows/WindowAssets';
import { readingRect } from '../../windows/windowMotion';
import { FoldController, SPACE_A } from './spaceModel';
import { spaceContentLayout } from './spaceContent';
import { Megastructure } from './Megastructure';
import { StudyLighting } from '../../shared/rendering/StudyLighting';
import { SpaceWindows } from './SpaceWindows';
import { SpaceDust } from './SpaceDust';
import { SpaceRelations } from './SpaceRelations';
import { SpaceObservation } from './SpaceObservation';
import '../../shared/styles/spaceStudy.css';
import '../../shared/styles/spaceWorlds.css';

function Instrumentation({ motion, fold, runtime }: { motion: MotionState; fold: FoldController; runtime: ContentRuntime }) {
  const { scene, gl } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__spaceWorldStudy = { snapshot: () => ({ motion: { ...motion }, fold: fold.snapshot(),
      structure: scene.getObjectByName('layered-megastructure')?.userData, lighting: scene.getObjectByName('study-lighting')?.userData,
      mounts: scene.getObjectByName('space-math-windows')?.userData, dust: scene.getObjectByName('space-microdust')?.userData,
      relation: scene.getObjectByName('space-euler-relation')?.userData, compositor: scene.userData.cinematic,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, drawCalls: gl.info.render.calls,
      readyWorlds: [...runtime.nodes].filter(([, n]) => n.group).length,
      poses: [...runtime.nodes].map(([id, node]) => ({ id, position: node.position.toArray(), scale: node.group?.scale.toArray(), rotation: node.group?.rotation.toArray() })),
    }) };
    return () => { delete window.__spaceWorldStudy; };
  }, [fold, gl, motion, runtime, scene]);
  return null;
}
const phaseName = { stable: '秩序', anticipation: '预兆', folding: '折叠', settling: '落定' } as const;
const ignorePhase = () => {};
export function SpaceWorldStudy() {
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const motion = useRef(createMotion()).current, reading = useRef(createReading()).current;
  const fold = useMemo(() => new FoldController(), []);
  const runtime = useMemo(() => createContentRuntime(spaceContentLayout()), []), assets = useMemo(createMathAssets, []);
  const windows = useMemo(() => createWindowAssets({ neutral: true, textureWidth: 640, textureHeight: 410 }), []);
  const [ready, setReady] = useState(false), [paused, setPaused] = useState(reduced), [frozen, setFrozen] = useState(reduced);
  const [status, setStatus] = useState(fold.snapshot());
  const [view, setView] = useState<{ phase: ReadingPhase; selectedId: string | null }>({ phase: 'closed', selectedId: null });
  const [catalog, setCatalog] = useState(false), [hovered, setHoveredId] = useState<string | null>(null);
  const indexButton = useRef<HTMLButtonElement>(null), focusOrigin = useRef<HTMLElement | null>(null);
  const active = view.phase !== 'closed';
  useEffect(() => {
    document.title = 'Mathverse · 层间的世界'; motion.phase = 'exploring'; motion.z = MOTION.entryEndZ;
    motion.pitch = motion.targetPitch = .1; motion.yaw = motion.targetYaw = -.42; motion.speed = reduced ? 0 : MOTION.explorationSpeed;
  }, [motion, reduced]);
  useEffect(() => { motion.paused = paused; }, [motion, paused]);
  useEffect(() => { motion.spaceFrozen = frozen; }, [motion, frozen]);
  useEffect(() => () => disposeMathAssets(assets), [assets]);
  useEffect(() => () => disposeWindowAssets(windows), [windows]);
  useEffect(() => { const timer = setInterval(() => setStatus(fold.snapshot()), 200); return () => clearInterval(timer); }, [fold]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (active || catalog || event.target instanceof HTMLElement && event.target.closest('button,a,input')) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      resumeMotion(motion); addLookInput(motion, event.key === 'ArrowLeft' ? -.18 : event.key === 'ArrowRight' ? .18 : 0, event.key === 'ArrowUp' ? .12 : event.key === 'ArrowDown' ? -.12 : 0); event.preventDefault();
    }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [active, catalog, motion]);
  const updatePhase = useCallback((phase: ReadingPhase) => {
    setView({ phase, selectedId: reading.selectedId });
    if (phase === 'closed') {
      setPaused(reading.pausedBefore);
      requestAnimationFrame(() => {
        const origin = focusOrigin.current;
        if (origin?.isConnected && origin.getAttribute('aria-hidden') !== 'true' && getComputedStyle(origin).visibility !== 'hidden') origin.focus({ preventScroll: true });
        else indexButton.current?.focus({ preventScroll: true });
      });
    }
  }, [reading]);
  const requestReading = useCallback((id: string, origin?: HTMLElement) => {
    const node = runtime.nodes.get(id); if (!node || document.hidden || !openReading(motion, reading, id, node.position.toArray())) return;
    // The catalog may reach a window behind the viewer; it grows from a quiet central aperture.
    runtime.readingOrigin = node.onScreen && !node.occluded ? node.bounds : null;
    reading.angle = ((runtime.connection.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    focusOrigin.current = origin ?? indexButton.current;
    setPaused(false); setCatalog(false); setHoveredId(null); setView({ phase: reading.phase, selectedId: id });
  }, [motion, reading, runtime]);
  const dismiss = useCallback(() => {
    const node = reading.selectedId ? runtime.nodes.get(reading.selectedId) : null;
    runtime.readingOrigin = node?.onScreen && node.bounds ? node.bounds : { x: innerWidth * .36, y: innerHeight * .35, width: innerWidth * .28, height: innerHeight * .3 };
    if (closeReading(motion, reading)) setView({ phase: reading.phase, selectedId: reading.selectedId });
  }, [motion, reading, runtime]);
  const change = useCallback((id: string) => { if (switchReading(reading, id)) setView({ phase: reading.phase, selectedId: id }); }, [reading]);
  const hover = useCallback((id: string | null) => { setHovered(reading, id); setHoveredId(id); }, [reading]);
  const dismissCatalog = useCallback(() => { setCatalog(false); requestAnimationFrame(() => indexButton.current?.focus()); }, []);
  const trigger = () => { resumeMotion(motion); if (!reduced) { setFrozen(false); motion.spaceFrozen = false; } fold.trigger(motion.z, reduced); setStatus(fold.snapshot()); };
  const progress = status.phase === 'stable' ? 0 : Math.min(1, status.elapsed / (SPACE_A.anticipationDuration + SPACE_A.foldDuration + SPACE_A.settleDuration));
  return <main className={`space-study space-worlds ${active ? 'is-reading' : ''}`} aria-label="Mathverse 层间的数学世界">
    <Canvas className="study-canvas" dpr={[1, 1.35]} shadows camera={{ fov: MOTION.fov, near: MOTION.near, far: MOTION.far, position: [0, MOTION.eyeHeight, -4] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }} onCreated={({ gl }) => { gl.shadowMap.type = PCFShadowMap; gl.toneMappingExposure = 1; setReady(true); }}
      fallback={<div className="study-fallback">当前浏览器无法显示三维空间。</div>}>
      <color attach="background" args={['#08090a']}/><fogExp2 attach="fog" args={['#08090a', .017]}/>
      <CameraDirector motion={motion} reading={reading} runtime={runtime} onPhase={ignorePhase} onOpen={requestReading} onHover={hover} onReadingPhase={updatePhase} priority={-2}/>
      <Megastructure motion={motion} fold={fold} reduced={reduced} content/><StudyLighting motion={motion}/>
      <SpaceWindows motion={motion} fold={fold} runtime={runtime} reading={reading} assets={assets} windows={windows}/>
      <SpaceDust motion={motion} fold={fold}/><SpaceRelations runtime={runtime} reading={reading}/>
      <SpaceObservation motion={motion} reading={reading} runtime={runtime} windows={windows}/><Instrumentation motion={motion} fold={fold} runtime={runtime}/>
    </Canvas>
    <header className="study-header" inert={active || catalog}><div className="study-wordmark">Mathverse<span>WORLD BETWEEN LAYERS</span></div>
      <nav className="worlds-navigation"><button ref={indexButton} disabled={!ready} onClick={() => { setCatalog(true); hover(null); }}>数学索引 <span aria-hidden="true">＋</span></button><a href="/space-a/">纯空间 ↗</a></nav>
    </header>
    <aside className="study-intro"><span>02 / ONE ANGLE · THREE WORLDS</span><h1>层间的世界</h1><p>一个角度，三种数学语言。</p></aside>
    <footer className="study-footer" inert={active || catalog}><div className="study-state"><div className="study-phases" aria-label={`结构状态：${phaseName[status.phase]}`}>{Object.entries(phaseName).map(([key, name]) => <span key={key} className={status.phase === key ? 'active' : ''}>{name}</span>)}</div><div className="study-progress"><i style={{ transform: `scaleX(${progress})` }}/></div><p>拖拽环顾 · 点击窗口，停留片刻</p></div>
      <div className="study-controls"><button disabled={!ready} onClick={() => { resumeMotion(motion); setPaused(p => !p); }}>{paused ? '继续前进' : '暂停前进'}</button><button disabled={!ready} onClick={() => { resumeMotion(motion); setFrozen(f => !f); }}>{frozen ? '继续结构' : '定格结构'}</button><button disabled={!ready} onClick={() => { resumeMotion(motion); lookForward(motion); }}>看向前方</button><button className="study-fold" disabled={!ready || status.phase !== 'stable'} onClick={trigger}>{reduced ? '切换结构状态' : status.phase === 'stable' ? '观看一次折叠' : '空间正在展开'} <span aria-hidden="true">↗</span></button></div>
    </footer>
    <div inert={active || catalog}><NodeLabels runtime={runtime} onOpen={requestReading} onHover={hover}/></div>
    {hovered && !active && !catalog && <div className="hover-note" role="status"><span>{NODE_BY_ID.get(hovered)?.title}</span><p>{NODE_BY_ID.get(hovered)?.summary}</p><small>点击，停留片刻 ↗</small></div>}
    {catalog && <MathCatalog onClose={dismissCatalog} onOpen={requestReading}/>}
    {active && view.selectedId && <ReadingPanel reading={reading} runtime={runtime} selectedId={view.selectedId} onClose={dismiss} onSwitch={change}/>}
  </main>;
}
declare global { interface Window { __spaceWorldStudy?: { snapshot: () => Record<string, unknown> }; } }
