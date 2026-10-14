import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Euler, PCFShadowMap, Vector3 } from 'three';
import { createMotion, minimumJerk, MOTION, type MotionState } from '../../config/motion';
import { addLookInput, advanceMotion, lookForward, resumeMotion, suspendMotion } from '../../motion/MotionKernel';
import { HYPER_VERTICES, INVERSION, InversionController, projectHyper } from './inversionModel';
import { InversionLighting, InversionStructure } from './InversionStructure';
import '../../shared/styles/spaceStudy.css';
import './inversionStudy.css';

type ViewState = { overview: boolean; blend: number; fade: number; fromFade: number; elapsed: number };
function InversionCamera({ motion, model, view, veil }: { motion: MotionState; model: InversionController; view: ViewState; veil: React.RefObject<HTMLDivElement | null> }) {
  const { camera, gl, scene } = useThree();
  const rotation = useMemo(() => new Euler(0, 0, 0, 'YXZ'), []);
  const target = useMemo(() => new Vector3(...INVERSION.center), []);
  const overview = useMemo(() => new Vector3(), []);
  useEffect(() => {
    const canvas = gl.domElement;
    let pointer: number | null = null, x = 0, y = 0, originX = 0, originY = 0;
    const end = () => {
      const id = pointer; pointer = null; motion.dragging = false; canvas.classList.remove('is-dragging');
      if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0 || pointer !== null) return;
      resumeMotion(motion); pointer = e.pointerId; originX = x = e.clientX; originY = y = e.clientY; canvas.setPointerCapture(pointer);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      if (!(e.buttons & 1)) { end(); return; }
      if (!motion.dragging && Math.hypot(e.clientX - originX, e.clientY - originY) < MOTION.dragThreshold) return;
      motion.dragging = true; canvas.classList.add('is-dragging');
      const sensitivity = Math.PI / Math.max(1, canvas.clientWidth);
      const clamp = (v: number) => Math.max(-MOTION.maxPointerAngle, Math.min(MOTION.maxPointerAngle, v));
      addLookInput(motion, clamp((e.clientX - x) * sensitivity), clamp((y - e.clientY) * sensitivity));
      x = e.clientX; y = e.clientY; e.preventDefault();
    };
    const blur = () => { end(); suspendMotion(motion); };
    const focus = () => { if (!document.hidden) resumeMotion(motion); };
    const visibility = () => document.hidden ? blur() : focus();
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button,a,input')) return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      resumeMotion(motion); addLookInput(motion, e.key === 'ArrowLeft' ? -.18 : e.key === 'ArrowRight' ? .18 : 0, e.key === 'ArrowUp' ? .12 : e.key === 'ArrowDown' ? -.12 : 0); e.preventDefault();
    };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('lostpointercapture', end);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus); window.addEventListener('keydown', key); document.addEventListener('visibilitychange', visibility);
    return () => {
      end(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end); canvas.removeEventListener('lostpointercapture', end);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', visibility);
    };
  }, [gl, motion]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const point = new Vector3(), direction = new Vector3();
    window.__inversionStudy = { snapshot: () => {
      camera.getWorldDirection(direction);
      return { motion: { ...motion }, model: model.snapshot(), view: { ...view }, position: camera.position.toArray(),
        direction: direction.toArray(), quaternion: camera.quaternion.toArray(), structure: scene.getObjectByName('inversion-structure')?.userData,
        projected: HYPER_VERTICES.map(p => { point.set(...projectHyper(p, model.angle)).project(camera); return point.toArray(); }),
        geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles };
    } };
    return () => { delete window.__inversionStudy; };
  }, [camera, gl, model, motion, scene, view]);
  useFrame((_, dt) => {
    // A finite model uses an asymptotically slowing dolly; the object stays fixed in world space.
    motion.speedScale = INVERSION.baseSpeedScale * Math.max(0, (motion.z - INVERSION.cameraLimit) / (INVERSION.cameraStart - INVERSION.cameraLimit));
    advanceMotion(motion, dt);
    view.elapsed += motion.frameDt;
    // Inspection is an editorial dissolve, never a flight through the projected beams.
    if (view.elapsed < .6) view.fade = view.fromFade + (1 - view.fromFade) * minimumJerk(view.elapsed / .6);
    else { view.blend = view.overview ? 1 : 0; view.fade = 1 - minimumJerk((view.elapsed - .6) / .6); }
    if (veil.current) veil.current.style.opacity = String(view.fade);
    overview.set(80, 55, 325 + (motion.z - INVERSION.cameraStart) * .25);
    camera.position.set(0, MOTION.eyeHeight, motion.z).lerp(overview, view.blend);
    const dx = target.x - overview.x, dy = target.y - overview.y, dz = target.z - overview.z;
    const baseYaw = Math.atan2(-dx, -dz), basePitch = Math.atan2(dy, Math.hypot(dx, dz));
    camera.quaternion.setFromEuler(rotation.set(basePitch * view.blend + motion.pitch, baseYaw * view.blend - motion.yaw, 0, 'YXZ'));
  }, -2);
  return null;
}
const phaseName = { stable: '秩序', anticipation: '预兆', rotation: '翻转', settling: '落定' } as const;
export function InversionStudy() {
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const motion = useRef(createMotion()).current, model = useMemo(() => new InversionController(), []);
  const view = useRef<ViewState>({ overview: false, blend: 0, fade: 0, fromFade: 0, elapsed: 1.2 }).current;
  const veil = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false), [paused, setPaused] = useState(reduced), [frozen, setFrozen] = useState(reduced);
  const [whole, setWhole] = useState(false), [status, setStatus] = useState(model.snapshot());
  useEffect(() => {
    document.title = 'Mathverse · 里面，成为外面';
    motion.phase = 'exploring'; motion.z = INVERSION.cameraStart; motion.distance = 0;
    motion.pitch = motion.targetPitch = .06; motion.yaw = motion.targetYaw = -.13;
    motion.speed = reduced ? 0 : MOTION.explorationSpeed * INVERSION.baseSpeedScale;
  }, [motion, reduced]);
  useEffect(() => { motion.paused = paused; }, [motion, paused]);
  useEffect(() => { motion.spaceFrozen = frozen; }, [motion, frozen]);
  useEffect(() => { const timer = setInterval(() => setStatus(model.snapshot()), 200); return () => clearInterval(timer); }, [model]);
  const seek = (angle: number) => {
    resumeMotion(motion); model.seek(angle, frozen || reduced); setStatus(model.snapshot());
  };
  const play = () => {
    resumeMotion(motion);
    if (!reduced) { motion.spaceFrozen = false; setFrozen(false); }
    model.automatic = true; model.begin(reduced); setStatus(model.snapshot());
  };
  const switchView = () => {
    resumeMotion(motion); lookForward(motion); view.fromFade = view.fade; view.elapsed = 0; view.overview = !view.overview; setWhole(view.overview);
    if (reduced) { view.blend = view.overview ? 1 : 0; view.elapsed = 1.2; view.fade = 0; }
  };
  return <main className="space-study inversion-study" aria-label="内外翻转四维模型样片">
    <Canvas className="study-canvas" dpr={[1, 1.35]} shadows camera={{ fov: 55, near: .08, far: 800, position: [0, MOTION.eyeHeight, -4] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
      onCreated={({ gl }) => { gl.shadowMap.type = PCFShadowMap; gl.toneMappingExposure = 1; setReady(true); }}
      fallback={<div className="study-fallback">当前浏览器无法显示空间。</div>}>
      <color attach="background" args={['#08090a']}/><fogExp2 attach="fog" args={['#08090a', .0009]}/>
      <InversionCamera motion={motion} model={model} view={view} veil={veil}/><InversionStructure motion={motion} model={model} reduced={reduced}/><InversionLighting/>
    </Canvas>
    <div className="inversion-veil" ref={veil} aria-hidden="true"/>
    <header className="study-header"><div className="study-wordmark">Mathverse<span>SPACE STUDY · INVERSION</span></div><a className="study-link" href="/space-a/worlds/">上一版空间 <span aria-hidden="true">↗</span></a></header>
    <aside className="study-intro"><span>02 / INSIDE BECOMES OUTSIDE</span><h1>里面，成为外面。</h1><p>沿着暖白连接，追踪同一个空间。</p>
      <div className="inversion-poses" role="group" aria-label="对照空间形态">
        {[[0, '初始'], [Math.PI * .28, '展开'], [Math.PI, '外侧']].map(([angle, name]) => <button key={name} aria-pressed={Math.abs(status.angle - Number(angle)) < .001} onClick={() => seek(Number(angle))} disabled={!ready}>{name}</button>)}
        <button className="inversion-view" onClick={switchView} disabled={!ready} aria-pressed={whole}>{whole ? '回到空间' : '看全貌'} <span aria-hidden="true">↗</span></button>
      </div>
    </aside>
    <footer className="study-footer"><div className="study-state"><div className="study-phases" aria-label={`结构状态：${phaseName[status.phase]}`}>
      {Object.entries(phaseName).map(([key, name]) => <span key={key} className={status.phase === key ? 'active' : ''}>{name}</span>)}
      </div><div className="study-progress"><i style={{ transform: `scaleX(${status.progress})` }}/></div><p>{ready ? '按住拖拽，环顾四周' : '正在准备空间'}</p></div>
      <div className="study-controls">
        <button onClick={() => { resumeMotion(motion); setPaused(v => !v); }} disabled={!ready}>{paused ? '继续前进' : '暂停前进'}</button>
        <button onClick={() => { resumeMotion(motion); setFrozen(v => !v); }} disabled={!ready}>{frozen ? '继续结构' : '定格结构'}</button>
        <button onClick={() => { resumeMotion(motion); lookForward(motion); }} disabled={!ready}>看向前方</button>
        <button className="study-fold" onClick={play} disabled={!ready || status.phase !== 'stable'}>{reduced ? '切换内外' : status.phase === 'stable' ? '观看完整翻转' : '空间正在翻转'}<span aria-hidden="true">↗</span></button>
      </div>
    </footer>
  </main>;
}
declare global { interface Window { __inversionStudy?: { snapshot: () => Record<string, unknown> }; } }
