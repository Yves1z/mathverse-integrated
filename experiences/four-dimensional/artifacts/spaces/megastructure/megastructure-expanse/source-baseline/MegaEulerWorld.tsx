import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import type { MotionState } from '../config/motion';
import type { ContentRuntime, NodeRuntime } from '../content/runtime';
import type { MathAssets } from '../content/assets';
import { NODE_BY_ID } from '../content/nodes';
import { blockingDistance } from '../content/picking';
import type { ReadingState } from '../reading/ReadingKernel';
import type { WindowAssets } from '../windows/WindowAssets';
import { advanceConnection } from '../windows/windowMotion';
import { WindowWorld } from '../windows/WindowWorld';
import { CellFigure } from './CellFigure';
import { EulerTrace } from './EulerTrace';
import { EULER_TRACE, traceBounds } from './eulerTraceModel';
import { CELL_FIGURE, cellBounds, figureMarkerSource } from './cellFigureModel';
import { MEGA_EULER_IDS, megaEulerPoint, type MegaEulerController } from './megaEulerModel';

const owner = () => 0;
const equationCenter: [number, number, number] = [.18, .82, -.45];
function Equation({ node, assets, fold }: { node: NodeRuntime; assets: MathAssets; fold: MegaEulerController }) {
  const previous = useRef(-1);
  const data = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(12), 3));
    geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const material = new MeshBasicMaterial({ map: assets.textures.get('identity'), transparent: true, depthWrite: false, side: DoubleSide, color: '#c9c3b4' });
    return { geometry, material };
  }, [assets]);
  useEffect(() => () => { data.geometry.dispose(); data.material.dispose(); }, [data]);
  useFrame(() => {
    const angle = fold.angle(0);
    if (angle !== previous.current) {
      const center = megaEulerPoint(0, [...equationCenter, -1], angle);
      [[-.45, -.13], [.45, -.13], [.45, .13], [-.45, .13]].forEach(([x, y], i) => {
        const p = megaEulerPoint(0, [equationCenter[0] + x, equationCenter[1] + y, equationCenter[2], -1], angle);
        data.geometry.getAttribute('position').setXYZ(i, p[0] - center[0], p[1] - center[1], p[2] - center[2]);
      });
      data.geometry.getAttribute('position').needsUpdate = true; data.geometry.computeBoundingSphere(); previous.current = angle;
      const mirrored = 1 + 1.9 * Math.cos(angle) < 0;
      [0, 1, 1, 0].forEach((u, i) => data.geometry.getAttribute('uv').setX(i, mirrored ? 1 - u : u));
      data.geometry.getAttribute('uv').needsUpdate = true;
    }
    data.material.opacity = node.alpha * .58 * Math.min(1, Math.abs(1 + 1.9 * Math.cos(angle)) / .15);
  }, -.3);
  return <mesh geometry={data.geometry} material={data.material} dispose={null} frustumCulled={false}/>;
}

export function MegaEulerWorld({ motion, fold, runtime, reading, assets, windows }: { motion: MotionState; fold: MegaEulerController; runtime: ContentRuntime; reading: ReadingState; assets: MathAssets; windows: WindowAssets }) {
  const { camera, scene, size } = useThree(), root = useRef<Group>(null), timer = useRef(1);
  const scratch = useMemo(() => ({ p: new Vector3(), delta: new Vector3(), ray: new Raycaster() }), []);
  useFrame(() => {
    const active = !motion.spaceFrozen && !motion.suspended && !document.hidden;
    runtime.euler.frozen = !active;
    advanceConnection(runtime.connection, fold.clock, active ? motion.frameDt * (reading.phase === 'closed' ? 1 : .18) : 0,
      reading.phase === 'reading' || reading.phase === 'focusing' ? reading.angle : null);
    timer.current += motion.frameDt;
    const check = timer.current > .18;
    if (check) { timer.current = 0; runtime.occluders = []; scene.traverse(o => { if (o.userData.mathOccluder) runtime.occluders.push(o); }); }
    const angle = fold.angle(0);
    for (const [id, node] of runtime.nodes) {
      if (!(MEGA_EULER_IDS as readonly string[]).includes(id) || !node.group) { node.onScreen = node.discovered = false; node.alpha = 0; continue; }
      const trace = id === 'leonhard-euler', equation = id === 'euler-identity';
      const center = trace ? EULER_TRACE.center : equation ? equationCenter : [0, 0, 0] as [number, number, number];
      node.position.set(...megaEulerPoint(0, [...center, -1], angle)); node.group.position.copy(node.position); node.group.updateMatrixWorld(true);
      node.alpha = reading.selectedId === id ? 1 - reading.progress : 1;
      node.discovered = motion.phase === 'exploring';
      scratch.p.copy(node.position).project(camera);
      node.onScreen = scratch.p.z > -1 && scratch.p.z < 1 && Math.abs(scratch.p.x) < 1.1 && Math.abs(scratch.p.y) < 1.1;
      node.visualScreen.set((scratch.p.x + 1) * size.width / 2, (1 - scratch.p.y) * size.height / 2);
      const corners = trace ? traceBounds(0, angle, megaEulerPoint) : equation ? [[-.45, -.13], [.45, .13]].map(([x, y]) => megaEulerPoint(0, [center[0] + x, center[1] + y, center[2], -1], angle)) : cellBounds(id, 0, angle, megaEulerPoint);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, radius = 0;
      for (const p of corners) {
        scratch.p.set(...p); radius = Math.max(radius, scratch.p.distanceTo(node.position)); scratch.p.project(camera);
        const x = (scratch.p.x + 1) * size.width / 2, y = (1 - scratch.p.y) * size.height / 2;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      node.sphere.radius = radius;
      node.bounds = node.onScreen ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
      if (check && node.onScreen) {
        scratch.ray.set(camera.position, scratch.delta.copy(node.position).sub(camera.position).normalize());
        node.occluded = blockingDistance(scratch.ray, runtime.occluders) < camera.position.distanceTo(node.position) - .12;
      }
      if (id === 'unit-circle') {
        scratch.p.set(...megaEulerPoint(0, [...figureMarkerSource(id, runtime.connection.angle), CELL_FIGURE.sourceW], angle)).project(camera);
        node.visualScreen.set((scratch.p.x + 1) * size.width / 2, (1 - scratch.p.y) * size.height / 2);
      }
    }
    runtime.relation.positions = ['euler-identity', 'unit-circle', 'complex-rotation'].map(id => runtime.nodes.get(id)!.position.toArray());
    if (root.current) root.current.userData = { owner: 0, angle, sourceW: -1, worldCount: 1, volumeFigures: 2, humanTraces: 1,
      sharedProjection: true, frames: 0, particles: 0, sourceUnchanged: true };
  }, -.4);
  return <group ref={root} name="mega-euler-world">
    {MEGA_EULER_IDS.map(id => { const node = runtime.nodes.get(id)!; return <group key={id} name={`math-node-${id}`} ref={g => { node.group = g; }} position={node.position}>
      {id === 'leonhard-euler' ? <EulerTrace node={node} runtime={runtime} fold={fold} project={megaEulerPoint}/> : id === 'euler-identity' ? <Equation node={node} assets={assets} fold={fold}/> : <CellFigure id={id} node={node} runtime={runtime} fold={fold} section={owner} project={megaEulerPoint} surfaceColor="#7e8486"/>}
    </group>; })}
    {[...runtime.nodes.keys()].map(id => <WindowWorld key={id} node={NODE_BY_ID.get(id)!} assets={assets} windows={windows} runtime={runtime} reading={reading} fullObjects neutral/>)}
  </group>;
}
