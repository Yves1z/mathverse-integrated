import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Object3D, Vector3 } from 'three';
import type { MotionState } from '../config/motion';
import type { OrderedController } from './orderedModel';
import { CAVITY, cavityBeams, cavityCounts, cavityPoint, type CavityKind } from './cavityModel';
import { HYPER_VERTICES } from './inversionModel';
import { beamRouteClearance } from './spaceModel';
import { createStructureDepthMaterial, createStructureGeometry, createStructureMaterial } from './structureSurface';
import { createBeamBounds, SpaceOccluder } from './SpaceOccluder';

const kinds: CavityKind[] = ['primary', 'layer', 'joint', 'light'];
export function CavityField({ motion, fold, reduced }: { motion: MotionState; fold: OrderedController; reduced: boolean }) {
  const root = useRef<Group>(null), previous = useRef<number | null>(null), meshes = useRef<Partial<Record<CavityKind, InstancedMesh>>>({});
  const data = useMemo(() => {
    const counts = cavityCounts(), parts = Object.fromEntries(kinds.map(kind => {
      const material = createStructureMaterial(kind);
      if (kind !== 'light') material.color.set(kind === 'primary' ? '#53595e' : kind === 'layer' ? '#3d4449' : '#343b3f');
      return [kind, { geometry: createStructureGeometry(kind, counts[kind]), material, depth: createStructureDepthMaterial() }];
    })) as Record<CavityKind, { geometry: ReturnType<typeof createStructureGeometry>; material: ReturnType<typeof createStructureMaterial>; depth: ReturnType<typeof createStructureDepthMaterial> }>;
    const occluder = new SpaceOccluder(); occluder.records = Array.from({ length: counts.primary + counts.layer + counts.joint }, createBeamBounds);
    return { counts, parts, occluder, dummy: new Object3D(), a: new Vector3(), b: new Vector3(), d: new Vector3(), up: new Vector3(0, 1, 0) };
  }, []);
  useEffect(() => () => Object.values(data.parts).forEach(p => { p.geometry.dispose(); p.material.dispose(); p.depth.dispose(); }), [data]);
  useFrame(() => {
    if (motion.phase === 'exploring') fold.advance(motion.frameDt * Math.max(.18, motion.speedScale), motion.z, motion.spaceFrozen, reduced);
    motion.spaceTime = fold.clock;
    if (root.current) root.current.userData.rhythm = fold.snapshot();
    const angle = fold.angle(0); if (angle === previous.current) return; previous.current = angle;
    const beams = cavityBeams(angle), cursor = { primary: 0, layer: 0, joint: 0, light: 0 }; let recordIndex = 0, clearance = Infinity;
    for (const [seed, beam] of beams.entries()) {
      const { kind, width, depth } = beam, index = cursor[kind]++;
      data.a.set(...beam.a); data.b.set(...beam.b); data.d.subVectors(data.b, data.a); const length = data.d.length();
      data.dummy.position.copy(data.a).add(data.b).multiplyScalar(.5); data.dummy.quaternion.setFromUnitVectors(data.up, data.d.divideScalar(Math.max(.001, length)));
      data.dummy.scale.set(1, 1, 1); data.dummy.updateMatrix(); meshes.current[kind]?.setMatrixAt(index, data.dummy.matrix);
      data.parts[kind].geometry.getAttribute('beamSize').setXYZ(index, width, length + .018, depth); data.parts[kind].geometry.getAttribute('beamSeed').setX(index, seed * .618);
      if (kind !== 'light') {
        const record = data.occluder.records[recordIndex++]; data.dummy.scale.set(width, length + .018, depth); data.dummy.updateMatrix();
        record.matrix.copy(data.dummy.matrix); record.inverse.copy(record.matrix).invert();
        const radius = Math.hypot(width, depth) / 2 + .02; record.box.min.copy(data.a).min(data.b).addScalar(-radius); record.box.max.copy(data.a).max(data.b).addScalar(radius);
        clearance = Math.min(clearance, beamRouteClearance(beam.a, beam.b, radius));
      }
    }
    for (const kind of kinds) {
      if (meshes.current[kind]) meshes.current[kind]!.instanceMatrix.needsUpdate = true;
      (data.parts[kind].geometry.getAttribute('beamSize') as InstancedBufferAttribute).needsUpdate = true; data.parts[kind].geometry.getAttribute('beamSeed').needsUpdate = true;
    }
    if (root.current) root.current.userData = { composition: 'euler-in-layered-megastructure-cavity', modules: 1, inhabitedCells: 1, boundedStudy: true, counts: cursor,
      bones: recordIndex, movingBeams: beams.filter(b => b.moving).length, staticBeams: beams.filter(b => !b.moving).length, minimumClearance: clearance,
      sourceRibs: 7, connectiveBridges: 4, rhythm: fold.snapshot(), sections: [{ section: 0, angle, points: HYPER_VERTICES.map(v => cavityPoint(0, v, angle)) }],
      attachments: beams.filter(b => b.attachment !== undefined).map(b => ({ vertex: b.attachment, a: b.a, b: b.b })),
      routeRadius: CAVITY.routeRadius, projection: 'cell-and-seven-local-ribs-share-XW-central-projection', scaffold: 'static-3D-host-with-four-bound-endpoints', exteriorParticles: 0, bloom: false };
  }, -1);
  return <group ref={root} name="ordered-inversion-field"><primitive object={data.occluder}/>
    {kinds.map(kind => <instancedMesh key={kind} ref={mesh => { if (mesh) { meshes.current[kind] = mesh; mesh.instanceMatrix.setUsage(DynamicDrawUsage); } }} args={[data.parts[kind].geometry, data.parts[kind].material, data.counts[kind]]} customDepthMaterial={data.parts[kind].depth} frustumCulled={false} castShadow={kind !== 'light'} receiveShadow={kind !== 'light'}/>)}
  </group>;
}
