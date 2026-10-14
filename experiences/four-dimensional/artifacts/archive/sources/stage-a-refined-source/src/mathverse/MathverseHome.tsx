import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
import { createMotion, MOTION, type Phase } from './config/motion';
import { VISUAL } from './config/visual';
import { CameraDirector } from './motion/CameraDirector';
import { WhiteEntrance } from './scene/WhiteEntrance';
import { Door } from './scene/Door';
import { FoldedField } from './scene/FoldedField';
import { Lighting } from './scene/Lighting';

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

export function MathverseHome() {
  const motionRef = useRef(createMotion());
  const motion = motionRef.current;
  const [phase, setPhase] = useState<Phase>('idle');
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [showHint, setShowHint] = useState(true);
  const [spaceFrozen, setSpaceFrozen] = useState(false);
  useEffect(() => { motion.paused = paused; }, [motion, paused]);
  useEffect(() => { motion.spaceFrozen = spaceFrozen; }, [motion, spaceFrozen]);
  useEffect(() => {
    if (phase !== 'exploring') return;
    const timer = setTimeout(() => setShowHint(false), 4500);
    return () => clearTimeout(timer);
  }, [phase]);
  const enter = useCallback(() => {
    if (!ready || motion.phase !== 'idle') return;
    motion.suspended = document.hidden;
    motion.phase = 'entering';
    motion.elapsed = 0;
    setPhase('entering');
  }, [motion, ready]);
  const lookForward = () => {
    const turns = Math.round(motion.targetYaw / (Math.PI * 2));
    motion.targetYaw = turns * Math.PI * 2;
    motion.targetPitch = 0;
  };

  return <main className={`mathverse mode-${phase}`} aria-label="Mathverse 数学空间">
    <SceneBoundary>
      <Canvas className="world-canvas" shadows dpr={[1, 1.5]}
        camera={{ fov: MOTION.fov, near: MOTION.near, far: MOTION.far, position: [0, MOTION.eyeHeight, MOTION.initialZ] }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
        onCreated={({ gl }) => { gl.shadowMap.type = PCFSoftShadowMap; setReady(true); }}
        onPointerDown={() => { if (phase === 'exploring') setShowHint(false); }}
        fallback={<div className="scene-fallback"><h2>这个浏览器暂时无法显示三维空间</h2><p>请换一个支持三维显示的浏览器，再打开 Mathverse。</p></div>}
      >
        <color attach="background" args={[VISUAL.dark]} />
        <fogExp2 attach="fog" args={[VISUAL.dark, VISUAL.fogDensity]} />
        <Lighting />
        <WhiteEntrance />
        <Door motion={motion} onEnter={enter} />
        <FoldedField motion={motion} />
        <CameraDirector motion={motion} onPhase={setPhase} />
      </Canvas>
    </SceneBoundary>

    <header className="chrome header">
      <div className="wordmark"><span className="mark" aria-hidden="true">∞</span><span>Mathverse</span></div>
      {phase === 'idle' ? <span className="header-note">在无限之前。</span> :
        <button className="quiet-button pause-button" disabled={phase !== 'exploring'} onClick={() => setPaused(!paused)}>
          <span className={paused ? 'play-symbol' : 'pause-symbol'} aria-hidden="true" />
          {paused ? '继续旅程' : '暂停旅程'}
        </button>}
    </header>

    {phase !== 'exploring' && <section className={`entrance-caption ${phase === 'entering' ? 'is-leaving' : ''}`} aria-label="空间入口">
      <p>一扇门。另一种维度。</p>
      <button className="enter-button" onClick={enter} disabled={!ready || phase !== 'idle'}>
        <span>{ready ? '推门进入' : '正在准备空间'}</span><span aria-hidden="true">↗</span>
      </button>
    </section>}

    <footer className="chrome footer">
      {phase === 'exploring' ? <>
        <button className="quiet-button dimension-button" onClick={() => setSpaceFrozen(!spaceFrozen)}><span className="journey-line" aria-hidden="true" />{spaceFrozen ? '让空间继续流动' : '定格空间'}</button>
        <p className={`drag-hint ${showHint ? 'is-visible' : ''}`}>按住鼠标，环顾四周</p>
        <button className="quiet-button forward-button" onClick={lookForward}>看向前方<span aria-hidden="true">↗</span></button>
      </> : <><span className="entry-footnote">改变视角，发现新的世界。</span><span className="edition">MATHEMATICS · INFINITY</span></>}
    </footer>
    <div className="sr-only" aria-live="polite">{phase === 'exploring' ? '已进入数学空间。摄像头缓慢前进，拖拽可以环顾四周，也可以暂停旅程。' : phase === 'entering' ? '门正在打开。' : '纯白空间中央有一扇门，点击推门进入。'}</div>
  </main>;
}

