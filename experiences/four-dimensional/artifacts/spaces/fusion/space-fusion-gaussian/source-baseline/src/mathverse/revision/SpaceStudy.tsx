import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Euler, PCFShadowMap, Vector3 } from 'three';
import { createMotion, MOTION, type MotionState } from '../config/motion';
import { addLookInput, advanceMotion, lookForward, resumeMotion, suspendMotion } from '../motion/MotionKernel';
import { FoldController, SPACE_A } from './spaceModel';
import { Megastructure } from './Megastructure';
import { StudyLighting } from './StudyLighting';
import './spaceStudy.css';

function StudyCamera({ motion, fold }: { motion: MotionState; fold: FoldController }) {
  const { camera, gl, scene } = useThree();
  const rotation = useMemo(() => new Euler(0, 0, 0, 'YXZ'), []);
  useEffect(() => {
    const canvas = gl.domElement;
    let pointer: number | null = null, x = 0, y = 0, originX = 0, originY = 0;
    const end = () => {
      const id = pointer; pointer = null; motion.dragging = false;
      canvas.classList.remove('is-dragging');
      if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0 || pointer !== null) return;
      resumeMotion(motion); pointer = e.pointerId; originX = x = e.clientX; originY = y = e.clientY;
      canvas.setPointerCapture(pointer);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      if (!(e.buttons & 1)) { end(); return; }
      if (!motion.dragging && Math.hypot(e.clientX - originX, e.clientY - originY) < MOTION.dragThreshold) return;
      motion.dragging = true; canvas.classList.add('is-dragging');
      const sensitivity = Math.PI / Math.max(1, canvas.clientWidth);
      const dx = Math.max(-MOTION.maxPointerAngle, Math.min(MOTION.maxPointerAngle, (e.clientX - x) * sensitivity));
      const dy = Math.max(-MOTION.maxPointerAngle, Math.min(MOTION.maxPointerAngle, (y - e.clientY) * sensitivity));
      addLookInput(motion, dx, dy); x = e.clientX; y = e.clientY; e.preventDefault();
    };
    const blur = () => { end(); suspendMotion(motion); };
    const focus = () => { if (!document.hidden) resumeMotion(motion); };
    const visibility = () => document.hidden ? blur() : focus();
    const keyboard = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button,a,input')) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        resumeMotion(motion); addLookInput(motion, e.key === 'ArrowLeft' ? -.18 : e.key === 'ArrowRight' ? .18 : 0,
          e.key === 'ArrowUp' ? .12 : e.key === 'ArrowDown' ? -.12 : 0); e.preventDefault();
      }
    };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end); window.addEventListener('blur', blur);
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', visibility);
    window.addEventListener('keydown', keyboard);
    return () => {
      end(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('lostpointercapture', end); window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('keydown', keyboard);
    };
  }, [gl, motion]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const direction = new Vector3();
    window.__spaceStudy = { snapshot: () => {
      camera.getWorldDirection(direction);
      return { motion: { ...motion }, position: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
        direction: direction.toArray(), structure: scene.getObjectByName('layered-megastructure')?.userData,
        fold: fold.snapshot(), lighting: scene.getObjectByName('study-lighting')?.userData,
        drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries, textures: gl.info.memory.textures };
    } };
    return () => { delete window.__spaceStudy; };
  }, [camera, fold, gl, motion, scene]);
  useFrame((_, dt) => {
    advanceMotion(motion, dt);
    camera.position.set(0, MOTION.eyeHeight, motion.z);
    camera.quaternion.setFromEuler(rotation.set(motion.pitch, -motion.yaw, 0, 'YXZ'));
  }, -2);
  return null;
}

const phaseName = { stable: '秩序', anticipation: '预兆', folding: '折叠', settling: '落定' } as const;

export function SpaceStudy() {
  const reduced = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const motion = useRef(createMotion()).current;
  const fold = useMemo(() => new FoldController(), []);
  const [ready, setReady] = useState(false), [paused, setPaused] = useState(reduced), [frozen, setFrozen] = useState(reduced);
  const [status, setStatus] = useState(fold.snapshot());
  useEffect(() => {
    document.title = 'Mathverse · A 层叠巨构';
    motion.phase = 'exploring'; motion.z = MOTION.entryEndZ;
    motion.pitch = motion.targetPitch = .14; motion.yaw = motion.targetYaw = -.18;
    motion.speed = reduced ? 0 : MOTION.explorationSpeed;
  }, [motion, reduced]);
  useEffect(() => { motion.paused = paused; }, [motion, paused]);
  useEffect(() => { motion.spaceFrozen = frozen; }, [motion, frozen]);
  useEffect(() => { const timer = setInterval(() => setStatus(fold.snapshot()), 200); return () => clearInterval(timer); }, [fold]);
  const trigger = useCallback(() => {
    resumeMotion(motion);
    if (!reduced) { setFrozen(false); motion.spaceFrozen = false; }
    fold.trigger(motion.z, reduced); setStatus(fold.snapshot());
  }, [fold, motion, reduced]);
  const forward = () => { resumeMotion(motion); lookForward(motion); };
  const progress = status.phase === 'stable' ? 0 : Math.min(1, status.elapsed / (SPACE_A.anticipationDuration + SPACE_A.foldDuration + SPACE_A.settleDuration));
  return <main className="space-study" aria-label="A 层叠巨构空间样片">
    <Canvas className="study-canvas" dpr={[1, 1.35]} shadows
      camera={{ fov: MOTION.fov, near: MOTION.near, far: MOTION.far, position: [0, MOTION.eyeHeight, -4] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
      onCreated={({ gl }) => { gl.shadowMap.type = PCFShadowMap; gl.toneMappingExposure = 1; setReady(true); }}
      fallback={<div className="study-fallback">当前浏览器无法显示三维空间。</div>}>
      <color attach="background" args={['#08090a']}/>
      <fogExp2 attach="fog" args={['#08090a', .017]}/>
      <StudyCamera motion={motion} fold={fold}/>
      <Megastructure motion={motion} fold={fold} reduced={reduced}/>
      <StudyLighting motion={motion}/>
    </Canvas>
    <header className="study-header">
      <div className="study-wordmark">Mathverse<span>SPACE STUDY · A</span></div>
      <a href="/" className="study-link">返回主页 <span aria-hidden="true">↗</span></a>
    </header>
    <aside className="study-intro"><span>01 / LAYERED MEGASTRUCTURE</span><h1>层叠巨构</h1><p>秩序深处，空间缓慢展开。</p></aside>
    <footer className="study-footer">
      <div className="study-state"><div className="study-phases" aria-label={`结构状态：${phaseName[status.phase]}`}>
        {Object.entries(phaseName).map(([key, name]) => <span key={key} className={status.phase === key ? 'active' : ''}>{name}</span>)}
      </div><div className="study-progress"><i style={{ transform: `scaleX(${progress})` }}/></div><p>{ready ? '按住拖拽，环顾四周' : '正在准备空间'}</p></div>
      <div className="study-controls">
        <button onClick={() => { resumeMotion(motion); setPaused(v => !v); }} disabled={!ready}>{paused ? '继续前进' : '暂停前进'}</button>
        <button onClick={() => { resumeMotion(motion); setFrozen(v => !v); }} disabled={!ready}>{frozen ? '继续结构' : '定格结构'}</button>
        <button onClick={forward} disabled={!ready}>看向前方</button>
        <button className="study-fold" onClick={trigger} disabled={!ready || status.phase !== 'stable'}>{reduced ? '切换结构状态' : status.phase === 'stable' ? '观看一次折叠' : '空间正在展开'}<span aria-hidden="true">↗</span></button>
      </div>
    </footer>
  </main>;
}

declare global { interface Window { __spaceStudy?: { snapshot: () => Record<string, unknown> }; } }
