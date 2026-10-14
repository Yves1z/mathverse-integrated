import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFShadowMap } from 'three';
import { createMotion, MOTION, type MotionState } from '../../config/motion';
import { CameraDirector } from '../../motion/CameraDirector';
import { addLookInput, resumeMotion } from '../../motion/MotionKernel';
import { createMathAssets, disposeMathAssets } from '../../content/assets';
import { createContentRuntime, type ContentRuntime } from '../../content/runtime';
import { NODE_BY_ID } from '../../content/nodes';
import { closeReading, createReading, openReading, setHovered, switchReading, type ReadingPhase } from '../../reading/ReadingKernel';
import { ReadingPanel } from '../../reading/ReadingUI';
import { createWindowAssets, disposeWindowAssets } from '../../windows/WindowAssets';
import { orderedLayout } from '../inversion/orderedModel';
import { Megastructure } from '../layered/Megastructure';
import { StudyLighting } from '../../shared/rendering/StudyLighting';
import { SpaceObservation } from '../layered/SpaceObservation';
import { MegaEulerWorld } from '../../shared/math/MegaEulerWorld';
import { MegaEulerController, createMegaEulerField, megaEulerPoint, projectMegaAssembly } from './megaEulerModel';
import { EXPANSE, createExpanseField, expanseEulerPoint, projectExpanseAssembly } from './expanseModel';
import { ExpanseLighting } from './ExpanseLighting';
import '../../shared/styles/spaceStudy.css';
import '../../shared/styles/spaceWorlds.css';
import './megaEuler.css';

function Instrumentation({ motion, fold, runtime }: { motion: MotionState; fold: MegaEulerController; runtime: ContentRuntime }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__megaEuler = { snapshot: () => ({ motion: { ...motion }, fold: fold.snapshot(), position: camera.position.toArray(),
      structure: scene.getObjectByName('layered-megastructure')?.userData, world: scene.getObjectByName('mega-euler-world')?.userData,
      figures: ['unit-circle', 'complex-rotation'].map(id => scene.getObjectByName(`cell-volume-${id}`)?.userData),
      lighting: scene.getObjectByName('study-lighting')?.userData, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
      drawCalls: gl.info.render.calls, observation: runtime.observation,
      nodes: [...runtime.nodes].map(([id, n]) => ({ id, position: n.position.toArray(), bounds: n.bounds, screen: n.visualScreen.toArray(), occluded: n.occluded })),
    }) }; return () => { delete window.__megaEuler; };
  }, [camera, gl, scene, motion, fold, runtime]);
  return null;
}
const names = { stable: '秩序', anticipation: '预兆', folding: '内外交换', settling: '落定' } as const;
const ignorePhase = () => {};

export function MegaEulerStudy() {
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const review = useMemo(() => new URLSearchParams(location.search).get('review'), []), baseline = review === 'baseline';
  const expansive = useMemo(() => new URLSearchParams(location.search).get('space') !== 'previous' && !baseline, [baseline]);
  const worldProject = expansive ? expanseEulerPoint : megaEulerPoint;
  const motion = useRef(createMotion()).current, reading = useRef(createReading()).current;
  const fold = useMemo(() => new MegaEulerController(expansive ? -300 : -90), [expansive]);
  const runtime = useMemo(() => createContentRuntime(orderedLayout(worldProject)), [worldProject]), assets = useMemo(createMathAssets, []);
  const windows = useMemo(() => createWindowAssets({ neutral: true, textureWidth: 640, textureHeight: 410 }), []);
  const [ready, setReady] = useState(false), [paused, setPaused] = useState(reduced || !!review), [frozen, setFrozen] = useState(reduced || !!review);
  const [status, setStatus] = useState(fold.snapshot());
  const [view, setView] = useState<{ phase: ReadingPhase; selectedId: string | null }>({ phase: 'closed', selectedId: null });
  const [hovered, setHoveredId] = useState<string | null>(null), storyButton = useRef<HTMLButtonElement>(null);
  const active = view.phase !== 'closed';
  useEffect(() => {
    document.title = expansive ? 'Mathverse · 无尽巨构' : 'Mathverse · 巨构中的欧拉'; motion.phase = 'exploring'; motion.z = MOTION.entryEndZ;
    motion.yaw = motion.targetYaw = -.50; motion.pitch = motion.targetPitch = .09;
    motion.speed = reduced || review ? 0 : MOTION.explorationSpeed;
    if (review) fold.review(review === 'outer' ? Math.PI : review === 'middle' ? Math.PI / 2 : 0);
  }, [motion, fold, reduced, review, expansive]);
  useEffect(() => { motion.paused = paused; }, [motion, paused]);
  useEffect(() => { motion.spaceFrozen = frozen; }, [motion, frozen]);
  useEffect(() => () => disposeMathAssets(assets), [assets]);
  useEffect(() => () => disposeWindowAssets(windows), [windows]);
  useEffect(() => { const id = setInterval(() => setStatus(fold.snapshot()), 200); return () => clearInterval(id); }, [fold]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (active || e.target instanceof HTMLElement && e.target.closest('button,a,input')) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      resumeMotion(motion); addLookInput(motion, e.key === 'ArrowLeft' ? -.18 : e.key === 'ArrowRight' ? .18 : 0, e.key === 'ArrowUp' ? .12 : e.key === 'ArrowDown' ? -.12 : 0); e.preventDefault();
    }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [active, motion]);
  const updatePhase = useCallback((phase: ReadingPhase) => {
    setView({ phase, selectedId: reading.selectedId });
    if (phase === 'closed') { setPaused(reading.pausedBefore); requestAnimationFrame(() => storyButton.current?.focus({ preventScroll: true })); }
  }, [reading]);
  const requestReading = useCallback((id: string) => {
    const node = runtime.nodes.get(id); if (!node || document.hidden || !openReading(motion, reading, id, node.position.toArray())) return;
    runtime.readingOrigin = node.onScreen && !node.occluded ? node.bounds : null;
    reading.angle = runtime.connection.angle % (Math.PI * 2); setPaused(false); setHoveredId(null); setView({ phase: reading.phase, selectedId: id });
  }, [motion, reading, runtime]);
  const dismiss = useCallback(() => {
    const node = reading.selectedId ? runtime.nodes.get(reading.selectedId) : null;
    runtime.readingOrigin = node?.onScreen && node.bounds ? node.bounds : null;
    if (closeReading(motion, reading)) setView({ phase: reading.phase, selectedId: reading.selectedId });
  }, [motion, reading, runtime]);
  const change = useCallback((id: string) => { if (switchReading(reading, id)) setView({ phase: reading.phase, selectedId: id }); }, [reading]);
  const hover = useCallback((id: string | null) => { setHovered(reading, id); setHoveredId(id); }, [reading]);
  const trigger = () => { resumeMotion(motion); if (!reduced) { setFrozen(false); motion.spaceFrozen = false; } fold.trigger(motion.z, reduced); setStatus(fold.snapshot()); };
  return <main className={`space-study space-worlds mega-euler ${active ? 'is-reading' : ''}`} aria-label="层叠巨构与欧拉体积世界融合样片">
    <Canvas className="study-canvas" dpr={[1, 1.35]} shadows camera={{ fov: MOTION.fov, near: MOTION.near, far: expansive ? EXPANSE.far : MOTION.far, position: [0, MOTION.eyeHeight, -4] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }} onCreated={({ gl }) => { gl.shadowMap.type = PCFShadowMap; gl.toneMappingExposure = 1; setReady(true); }}>
      <color attach="background" args={['#08090a']}/><fogExp2 attach="fog" args={['#08090a', expansive ? EXPANSE.fog : .017]}/>
      <CameraDirector motion={motion} reading={reading} runtime={runtime} onPhase={ignorePhase} onOpen={requestReading} onHover={hover} onReadingPhase={updatePhase} priority={-2}/>
      <Megastructure motion={motion} fold={fold} reduced={reduced} content bayLength={expansive ? EXPANSE.pitch : undefined} createAssemblies={baseline ? undefined : expansive ? createExpanseField : createMegaEulerField} project={baseline ? undefined : expansive ? projectExpanseAssembly : projectMegaAssembly}/>
      {expansive ? <ExpanseLighting motion={motion}/> : <StudyLighting motion={motion}/>}
      {!baseline && <><MegaEulerWorld motion={motion} fold={fold} runtime={runtime} reading={reading} assets={assets} windows={windows} project={worldProject}/>
        {!expansive && <rectAreaLight position={[-30, 17, -19]} rotation={[-.25, .15, 0]} width={20} height={14} color="#ebe8df" intensity={1.1}/>}</>}
      <SpaceObservation motion={motion} reading={reading} runtime={runtime} windows={windows}/><Instrumentation motion={motion} fold={fold} runtime={runtime}/>
    </Canvas>
    <header className="study-header" inert={active}><div className="study-wordmark">Mathverse<span>MEGASTRUCTURE · EULER</span></div>
      <nav className="mega-navigation"><button ref={storyButton} disabled={!ready || baseline} onClick={() => requestReading('leonhard-euler')}>欧拉的故事 ↗</button><a href="/space-a/euler/?space=previous">上一版 ↗</a><a href="/artifacts/spaces/megastructure/megastructure-expanse/index.html">画面对照 ↗</a></nav>
    </header>
    <aside className="study-intro"><span>{baseline ? '00 / ORIGINAL STRUCTURE' : expansive ? '01 / THE INFINITE EXPANSE' : '01 / INSIDE BECOMES OUTSIDE'}</span><h1>{baseline ? '原来的巨构' : expansive ? '没有尽头的秩序。' : '秩序深处，一个世界。'}</h1><p>{baseline ? '层叠结构 · 同一视角对照' : expansive ? '在巨构之间，缓慢深入。' : '沿着连接，观察内部如何成为外围。'}</p></aside>
    <footer className="study-footer" inert={active}><div className="study-state"><div className="study-phases">{Object.entries(names).map(([key, name]) => <span key={key} className={status.phase === key ? 'active' : ''}>{name}</span>)}</div>
      <div className="study-progress"><i style={{ transform: `scaleX(${status.phase === 'stable' ? 0 : Math.min(1, status.elapsed / 44)})` }}/></div><p>按住拖拽，环顾四周 · 点击数学图形</p></div>
      <div className="study-controls"><button disabled={!ready} onClick={() => { resumeMotion(motion); setPaused(p => !p); }}>{paused ? '继续前进' : '暂停前进'}</button>
        <button disabled={!ready} onClick={() => { resumeMotion(motion); setFrozen(f => !f); }}>{frozen ? '继续结构' : '定格结构'}</button>
        <button className="study-fold" disabled={!ready || status.phase !== 'stable' || !!review} onClick={trigger}>{status.phase !== 'stable' ? '空间正在展开' : status.angle > Math.PI / 2 ? '让世界回到内部' : reduced ? '切换结构状态' : '展开这一片空间'} <span aria-hidden="true">↗</span></button>
      </div>
    </footer>
    {hovered && !active && <div className="hover-note" role="status"><span>{NODE_BY_ID.get(hovered)?.title}</span><p>{NODE_BY_ID.get(hovered)?.summary}</p><small>点击，停留片刻 ↗</small></div>}
    {active && view.selectedId && <ReadingPanel reading={reading} runtime={runtime} selectedId={view.selectedId} onClose={dismiss} onSwitch={change}/>}
  </main>;
}
declare global { interface Window { __megaEuler?: { snapshot: () => Record<string, unknown> }; } }
