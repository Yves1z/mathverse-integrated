import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { MotionState } from '../config/motion';
import type { ContentRuntime } from '../content/runtime';
import type { OrderedController } from './orderedModel';

export function OrderedInstrumentation({ fold, runtime }: { fold: OrderedController; runtime: ContentRuntime }) {
  const { scene, gl } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__orderedSpace = { snapshot: () => ({ rhythm: fold.snapshot(), field: scene.getObjectByName('ordered-inversion-field')?.userData,
      lighting: scene.getObjectByName('ordered-lighting')?.userData, mounts: scene.getObjectByName('space-math-windows')?.userData, humanTrace: scene.getObjectByName('euler-cell-trace')?.userData,
      volumes: ['unit-circle', 'complex-rotation', 'mobius-strip', 'gaussian-integral'].map(id => scene.getObjectByName(`cell-volume-${id}`)).filter(Boolean).map(object => object!.userData),
      readyWorlds: [...runtime.nodes.values()].filter(n => n.group).length, poses: [...runtime.nodes].map(([id, n]) => ({ id, position: n.position.toArray(), scale: n.group?.scale.toArray(), rotation: n.group?.rotation.toArray(), bounds: n.bounds })),
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles }) };
    return () => { delete window.__orderedSpace; };
  }, [fold, gl, runtime, scene]);
  return null;
}
const names = { stable: '秩序', anticipation: '预兆', rotation: '翻转', settling: '落定' };
export function OrderedRhythm({ fold, motion, reduced, onUnfreeze, caption = '同一节奏，依次展开' }: { fold: OrderedController; motion: MotionState; reduced: boolean; onUnfreeze: () => void; caption?: string }) {
  const [status, setStatus] = useState(fold.snapshot());
  useEffect(() => { const timer = setInterval(() => setStatus(fold.snapshot()), 200); return () => clearInterval(timer); }, [fold]);
  return <div className="ordered-rhythm"><span aria-live="off">{names[status.phase]}<i aria-hidden="true"/>{caption}</span>
    <button className="quiet-button" disabled={status.phase !== 'stable'} onClick={() => { if (!reduced) onUnfreeze(); fold.trigger(motion.z, reduced); setStatus(fold.snapshot()); }}>{reduced ? '切换一个单元' : status.phase === 'stable' ? '观看一次翻转' : '空间正在翻转'} <span aria-hidden="true">↗</span></button>
  </div>;
}
declare global { interface Window { __orderedSpace?: { snapshot: () => Record<string, unknown> }; } }
