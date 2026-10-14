import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Object3D, Vector3 } from 'three';
import type { MotionState } from '../config/motion';
import type { OrderedController } from './orderedModel';
import { FUSION_CELLS, FUSION_COUNTS, firstFusionRing, fusionBeams, fusionPoint, type FusionKind } from './fusionModel';
import { HYPER_VERTICES } from './inversionModel';
import { createStructureDepthMaterial, createStructureGeometry, createStructureMaterial } from './structureSurface';
import { createBeamBounds, SpaceOccluder } from './SpaceOccluder';

const kinds = Object.keys(FUSION_COUNTS) as FusionKind[];
export function FusionField({ motion, fold, reduced, fusionContent = false }: { motion: MotionState; fold: OrderedController; reduced: boolean; fusionContent?: boolean }) {
  const root = useRef<Group>(null), previous = useRef(''), meshes = useRef<Partial<Record<FusionKind, InstancedMesh>>>({});
  const data = useMemo(() => {
    const parts = Object.fromEntries(kinds.map(kind => {
      const surface = kind === 'seam' ? 'light' : kind === 'tracked' || kind === 'spine' ? 'primary' : kind === 'outer' ? 'layer' : 'joint';
      const material = createStructureMaterial(surface);
      if (kind !== 'seam') material.color.set(({ tracked: '#626260', outer: '#484d50', bridge: '#373d40', spine: '#41464a' })[kind]);
      return [kind, { geometry: createStructureGeometry(surface, FUSION_COUNTS[kind]), material, depth: createStructureDepthMaterial() }];
    })) as Record<FusionKind, { geometry: ReturnType<typeof createStructureGeometry>; material: ReturnType<typeof createStructureMaterial>; depth: ReturnType<typeof createStructureDepthMaterial> }>;
    const occluder = new SpaceOccluder(); occluder.records = Array.from({ length: 184 }, createBeamBounds);
    return { parts, occluder, dummy: new Object3D(), a: new Vector3(), b: new Vector3(), d: new Vector3(), up: new Vector3(0, 1, 0), color: new Color() };
  }, []);
  useEffect(() => () => Object.values(data.parts).forEach(p => { p.geometry.dispose(); p.material.dispose(); p.depth.dispose(); }), [data]);
  useFrame(() => {
    if (motion.phase === 'exploring') fold.advance(motion.frameDt * Math.max(.18, motion.speedScale), motion.z, motion.spaceFrozen, reduced);
    motion.spaceTime = fold.clock;
    const angle = fold.angle(0), upperAngle = fusionContent ? fold.angle(1) : 0, firstRing = firstFusionRing(motion.z), key = `${angle}/${upperAngle}/${firstRing}`;
    if (root.current) root.current.userData.rhythm = fold.snapshot();
    if (key === previous.current) return; previous.current = key;
    const beams = fusionBeams(angle, firstRing, upperAngle), cursor = { tracked: 0, outer: 0, bridge: 0, spine: 0, seam: 0 }; let recordIndex = 0;
    for (const [seed, beam] of beams.entries()) {
      const { kind, width, depth } = beam, index = cursor[kind]++, mesh = meshes.current[kind], part = data.parts[kind];
      data.a.set(...beam.a); data.b.set(...beam.b); data.d.subVectors(data.b, data.a); const length = data.d.length();
      data.dummy.position.copy(data.a).add(data.b).multiplyScalar(.5);
      data.dummy.quaternion.setFromUnitVectors(data.up, data.d.divideScalar(Math.max(.001, length))); data.dummy.scale.set(1, 1, 1); data.dummy.updateMatrix();
      mesh?.setMatrixAt(index, data.dummy.matrix); mesh?.setColorAt(index, data.color.setScalar(beam.unit !== null && beam.unit !== 0 && !(fusionContent && beam.unit === 1) ? .52 : 1));
      part.geometry.getAttribute('beamSize').setXYZ(index, width, length + .018, depth); part.geometry.getAttribute('beamSeed').setX(index, seed * .618);
      if (kind !== 'seam') {
        const record = data.occluder.records[recordIndex++]; data.dummy.scale.set(width, length + .018, depth); data.dummy.updateMatrix();
        record.matrix.copy(data.dummy.matrix); record.inverse.copy(record.matrix).invert();
        const radius = Math.hypot(width, depth) / 2 + .02;
        record.box.min.copy(data.a).min(data.b).addScalar(-radius); record.box.max.copy(data.a).max(data.b).addScalar(radius);
      }
    }
    for (const kind of kinds) {
      const mesh = meshes.current[kind]; if (mesh) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
      (data.parts[kind].geometry.getAttribute('beamSize') as InstancedBufferAttribute).needsUpdate = true;
      data.parts[kind].geometry.getAttribute('beamSeed').needsUpdate = true;
    }
    if (root.current) root.current.userData = { composition: fusionContent ? 'euler-and-mobius-worlds-with-quiet-side-reference' : 'inhabited-cell-with-side-behind-and-upper-ahead-references', inhabitedCells: fusionContent ? 2 : 1, modules: 3, bones: 184,
      counts: cursor, firstRing, scaffoldRings: 10, connectiveBridges: 12, maximumMovingUnits: 1, rhythm: fold.snapshot(),
      sections: FUSION_CELLS.map(c => ({ section: c.id, role: c.role, angle: c.id === 0 ? angle : c.id === 1 ? upperAngle : 0, points: HYPER_VERTICES.map(v => fusionPoint(c.id, v, c.id === 0 ? angle : c.id === 1 ? upperAngle : 0)) })),
      attachments: beams.filter(b => b.vertex !== undefined).map(b => ({ unit: b.unit, vertex: b.vertex, ring: b.ring, a: b.a, b: b.b })),
      projection: 'same-XW-central-projection-with-rigid-cell-placement', scaffold: 'artistic-3D-graph-attached-to-projected-vertices', fixedCellIdentities: true, boundedStudy: true, exteriorParticles: 0, bloom: false };
  }, -1);
  return <group ref={root} name="ordered-inversion-field"><primitive object={data.occluder}/>
    {kinds.map(kind => <instancedMesh key={kind} ref={mesh => { if (mesh) { meshes.current[kind] = mesh; mesh.instanceMatrix.setUsage(DynamicDrawUsage); } }}
      args={[data.parts[kind].geometry, data.parts[kind].material, FUSION_COUNTS[kind]]} customDepthMaterial={data.parts[kind].depth}
      frustumCulled={false} castShadow={kind !== 'seam'} receiveShadow={kind !== 'seam'}/>)}
  </group>;
}
