import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, Object3D, Raycaster, Vector3 } from 'three';
import type { MotionState } from '../config/motion';
import type { ContentRuntime } from '../content/runtime';
import type { MathAssets } from '../content/assets';
import { NODE_BY_ID } from '../content/nodes';
import { blockingDistance } from '../content/picking';
import type { ReadingState } from '../reading/ReadingKernel';
import { PortalWindow } from '../windows/PortalWindow';
import { WindowWorld } from '../windows/WindowWorld';
import { advanceConnection, WINDOW } from '../windows/windowMotion';
import { fieldPoint, windowPose, windowSupports, ORDERED_MOUNTS, type OrderedController, type SpaceProjection } from './orderedModel';
import { CELL_FIGURE, VOLUME_IDS, isCellContent, cellBounds, cellCenter, figureMarkerSource } from './cellFigureModel';
import { CellFigure } from './CellFigure';
import { NodeVisual } from '../content/NodeVisual';
import { EulerTrace } from './EulerTrace';
import { EULER_TRACE, traceBounds } from './eulerTraceModel';

import type { WindowAssets } from '../windows/WindowAssets';

export function OrderedWindows({ motion, fold, runtime, reading, assets, windows, project = fieldPoint, fusion = false, fusionContent = false, gaussianContent = false, eulerTrace = false, quietLabels = false }: { motion: MotionState; fold: OrderedController; runtime: ContentRuntime; reading: ReadingState; assets: MathAssets; windows: WindowAssets; project?: SpaceProjection; fusion?: boolean; fusionContent?: boolean; gaussianContent?: boolean; eulerTrace?: boolean; quietLabels?: boolean }) {
  const { camera, scene, size } = useThree();
  const root = useRef<Group>(null), supports = useRef<InstancedMesh>(null);
  const sections = useMemo(() => new Map(ORDERED_MOUNTS.map(m => [m.id, eulerTrace && m.id === 'leonhard-euler' ? 0 : gaussianContent && m.id === 'gaussian-integral' ? 2 : m.section])), [gaussianContent, eulerTrace]);
  const volumeIds = useMemo(() => new Set([...VOLUME_IDS, ...(fusionContent ? ['mobius-strip'] : []), ...(gaussianContent ? ['gaussian-integral'] : [])]), [fusionContent, gaussianContent]);
  const scratch = useMemo(() => ({ a: new Vector3(), b: new Vector3(), delta: new Vector3(), up: new Vector3(0, 1, 0), dummy: new Object3D(), project: new Vector3(), raycaster: new Raycaster(), corner: new Vector3() }), []);
  const elapsed = useRef(1);
  useFrame(() => {
    const controlled = reading.phase === 'focusing' || reading.phase === 'reading' ? reading.angle : null;
    const active = motion.phase === 'exploring' && !motion.suspended && !document.hidden && (!motion.spaceFrozen || controlled !== null);
    runtime.euler.frozen = motion.spaceFrozen || motion.suspended || document.hidden;
    advanceConnection(runtime.connection, fold.clock, active ? motion.frameDt * (reading.phase === 'closed' ? 1 : .18) : 0, controlled);
    elapsed.current += motion.frameDt;
    const check = elapsed.current > .15;
    if (check) { elapsed.current = 0; runtime.occluders = []; scene.traverse(o => { if (o.userData.mathOccluder) { let visible = true; for (let parent: Object3D | null = o; parent; parent = parent.parent) visible = visible && parent.visible; if (visible) runtime.occluders.push(o); } }); }
    let supportIndex = 0;
    const candidates: { id: string; distance: number }[] = [];
    for (const mount of ORDERED_MOUNTS) {
      const node = runtime.nodes.get(mount.id)!, group = node.group;
      if (!group) continue;
      const trace = eulerTrace && mount.id === 'leonhard-euler';
      if (fusion && !isCellContent(mount.id) && !volumeIds.has(mount.id) && !trace) { node.onScreen = node.discovered = false; node.alpha = 0; node.bounds = null; group.visible = false; continue; }
      let section = sections.get(mount.id)!;
      if (!fusion && reading.phase === 'closed' && node.position.z - motion.z > 140 && camera.position.distanceTo(node.position) > mount.range + 12) {
        section += 2; sections.set(mount.id, section);
      }
      const angle = fold.angle(section);
      const volume = volumeIds.has(mount.id), annotation = mount.id === 'euler-identity';
      const pose = volume || trace ? { position: trace ? project(section, [...EULER_TRACE.center, -1], angle) : cellCenter(section, angle, project), rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number], facing: 1 } :
        windowPose(annotation ? { ...mount, center: [...CELL_FIGURE.annotations, -1], width: .96, height: .72 } : mount, section, angle, project);
      node.position.set(...pose.position); group.position.copy(node.position); group.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]); group.scale.set(pose.scale[0], pose.scale[1], pose.scale[2]); group.updateMatrixWorld(true);
      node.sphere.radius = Math.hypot(3.3 * group.scale.x, 2.25 * group.scale.y, group.scale.z);
      const distance = camera.position.distanceTo(node.position);
      node.discovered = motion.phase === 'exploring' && distance < mount.range;
      scratch.project.copy(node.position).project(camera);
      node.visualScreen.set((scratch.project.x + 1) * size.width / 2, (1 - scratch.project.y) * size.height / 2);
      if (mount.id === 'unit-circle' || (fusionContent && mount.id === 'mobius-strip')) {
        scratch.project.set(...project(section, [...figureMarkerSource(mount.id, runtime.connection.angle), -1], angle)).project(camera);
        node.visualScreen.set((scratch.project.x + 1) * size.width / 2, (1 - scratch.project.y) * size.height / 2);
        scratch.project.copy(node.position).project(camera);
      }
      node.onScreen = motion.phase === 'exploring' && pose.facing > .08 && scratch.project.z > -1 && scratch.project.z < 1 && Math.abs(scratch.project.x) < .98 && Math.abs(scratch.project.y) < .94;
      if (check && node.onScreen) {
        scratch.raycaster.set(camera.position, scratch.delta.copy(node.position).sub(camera.position).normalize());
        node.occluded = blockingDistance(scratch.raycaster, runtime.occluders) < distance - .12;
      }
      if (node.discovered && node.onScreen && !node.occluded) candidates.push({ id: mount.id, distance: distance + (annotation ? 28 : 0) });
      node.alpha = (motion.phase === 'exploring' ? Math.max(0, Math.min(1, (pose.facing - .05) / .18)) : 0) * Math.min(1, Math.max(0, (mount.range + 12 - distance) / 18)) * (reading.selectedId === mount.id ? 1 - reading.progress : 1);
      group.visible = node.alpha > .001;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const corners = trace ? traceBounds(section, angle, project) : volume ? cellBounds(mount.id, section, angle, project) : [-1, 1].flatMap(x => [-1, 1].map(y => scratch.corner.set(x * (annotation ? 1.9 : WINDOW.width / 2), y * (annotation ? .495 : WINDOW.height / 2), 0).applyMatrix4(group.matrixWorld).toArray()));
      if (volume || trace) node.sphere.radius = Math.max(...corners.map(p => scratch.corner.set(p[0], p[1], p[2]).distanceTo(node.position)));
      for (const corner of corners) {
        scratch.corner.set(corner[0], corner[1], corner[2]).project(camera);
        const px = (scratch.corner.x + 1) * size.width / 2, py = (1 - scratch.corner.y) * size.height / 2;
        minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      }
      node.bounds = node.onScreen ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
      if (!volume && !annotation && !trace) windowSupports(mount, section, angle).forEach((point, i) => {
        scratch.a.set(...point);
        scratch.b.set((i ? 1 : -1) * WINDOW.width * .35, WINDOW.height / 2 + .05, 0).applyMatrix4(group.matrixWorld);
        scratch.delta.subVectors(scratch.b, scratch.a); const length = scratch.delta.length();
        scratch.dummy.position.copy(scratch.a).add(scratch.b).multiplyScalar(.5);
        scratch.dummy.quaternion.setFromUnitVectors(scratch.up, scratch.delta.divideScalar(Math.max(length, .001)));
        scratch.dummy.scale.set(node.alpha > .001 ? .095 : 0, length, .095); scratch.dummy.updateMatrix();
        supports.current?.setMatrixAt(supportIndex++, scratch.dummy.matrix);
      });
    }
    if (supports.current) {
      scratch.dummy.scale.setScalar(0); scratch.dummy.updateMatrix();
      for (let i = supportIndex; i < 12; i++) supports.current.setMatrixAt(i, scratch.dummy.matrix);
      supports.current.instanceMatrix.needsUpdate = true;
    }
    const emphasized = new Set(candidates.sort((a, b) => (a.id === reading.hoveredId ? -1 : a.distance) - (b.id === reading.hoveredId ? -1 : b.distance)).slice(0, 2).map(n => n.id));
    for (const [id, node] of runtime.nodes) {
      node.emphasized = emphasized.has(id);
      if (!node.label || !node.group) continue;
      if (volumeIds.has(id) && node.bounds) node.screen.set(id === 'mobius-strip' || id === 'gaussian-integral' ? node.bounds.x + node.bounds.width / 2 : id === 'unit-circle' ? node.bounds.x - 65 : node.bounds.x + node.bounds.width + 80, node.bounds.y + node.bounds.height + 22);
      else if (eulerTrace && id === 'leonhard-euler' && node.bounds) node.screen.set(node.bounds.x + node.bounds.width / 2, node.bounds.y + node.bounds.height + 16);
      else if (id === 'euler-identity' && node.bounds) node.screen.set(node.bounds.x + node.bounds.width / 2, node.bounds.y - 78);
      else { scratch.project.set(0, -WINDOW.height / 2 - .24, .1).applyMatrix4(node.group.matrixWorld).project(camera);
        node.screen.set((scratch.project.x + 1) * size.width / 2, (1 - scratch.project.y) * size.height / 2); }
      const shown = node.emphasized && (!quietLabels || reading.hoveredId === id) && reading.phase === 'closed' && node.screen.y > 85 && node.screen.y < size.height - 115 && node.screen.x > 90 && node.screen.x < size.width - 90;
      node.label.style.transform = `translate(${node.screen.x}px,${node.screen.y}px) translate(-50%,0)`;
      node.label.style.opacity = shown ? '1' : '0'; node.label.style.visibility = shown ? 'visible' : 'hidden'; node.label.style.pointerEvents = shown ? 'auto' : 'none';
      node.label.tabIndex = shown ? 0 : -1; node.label.setAttribute('aria-hidden', shown ? 'false' : 'true');
    }
    runtime.relation.positions = ['euler-identity', 'unit-circle', 'complex-rotation'].map(id => runtime.nodes.get(id)!.position.toArray());
    if (root.current) root.current.userData = { sections: Object.fromEntries(sections), windows: 6, exteriorFrames: fusion ? 0 : 3, volumeFigures: volumeIds.size, unframedAnnotations: 1, humanTraces: eulerTrace ? 1 : 0, angle: runtime.connection.angle, mountedInStructure: true, occlusion: 'conservative-oriented-beam-boxes', sourceSurface: gaussianContent ? 'three-worlds-in-w=-1-cell-interiors' : fusionContent ? 'two-worlds-in-w=-1-cell-interiors' : 'left-content-in-w=-1-cell-interior;right-windows-z=1', scheduling: 'single-ordered-clock', fusion };
  }, -.4);
  return <group ref={root} name="space-math-windows">
    <instancedMesh ref={supports} args={[undefined, undefined, 12]} frustumCulled={false}>
      <boxGeometry/><meshStandardMaterial color="#44474a" roughness={.61} metalness={.23}/>
    </instancedMesh>
    {[...runtime.nodes].map(([id, node]) => <group key={id} name={`math-node-${id}`} ref={group => { node.group = group; }} position={node.position}>
      {eulerTrace && id === 'leonhard-euler' ? <EulerTrace node={node} runtime={runtime} fold={fold} project={project}/> : volumeIds.has(id) ? <CellFigure id={id} node={node} runtime={runtime} fold={fold} section={() => sections.get(id)!} project={project}/> : id === 'euler-identity' ?
        <NodeVisual kind="identity" assets={assets} opacity={() => node.alpha}/>:!fusion&&<PortalWindow id={id} kind={NODE_BY_ID.get(id)!.rendererKey} assets={assets} windows={windows} opacity={() => node.alpha} inset/>}
      <WindowWorld node={NODE_BY_ID.get(id)!} assets={assets} windows={windows} runtime={runtime} reading={reading} fullObjects neutral/>
    </group>)}
  </group>;
}
