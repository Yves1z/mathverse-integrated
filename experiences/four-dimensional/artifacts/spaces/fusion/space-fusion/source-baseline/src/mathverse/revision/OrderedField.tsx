import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import type { MotionState } from '../config/motion';
import { HYPER_EDGES, HYPER_VERTICES, type V3 } from './inversionModel';
import { BRIDGE_VERTICES, fieldPoint, nearestSection, ORDERED, type OrderedController } from './orderedModel';
import { createStructureDepthMaterial, createStructureGeometry, createStructureMaterial } from './structureSurface';
import { createBeamBounds, SpaceOccluder } from './SpaceOccluder';

const kinds = ['tracked', 'outer', 'bridge', 'seam'] as const;
export function OrderedField({ motion, fold, reduced }: { motion: MotionState; fold: OrderedController; reduced: boolean }) {
  const root = useRef<Group>(null), meshes = useRef<Partial<Record<typeof kinds[number], InstancedMesh>>>({});
  const previous = useRef('');
  const data = useMemo(() => {
    const counts = { tracked: ORDERED.count * 12, outer: ORDERED.count * 12, bridge: ORDERED.count * 8 + (ORDERED.count - 1) * BRIDGE_VERTICES.length, seam: ORDERED.count * 6 };
    const parts = Object.fromEntries(kinds.map(kind => {
      const surface = kind === 'tracked' ? 'primary' : kind === 'outer' ? 'layer' : kind === 'seam' ? 'light' : 'joint';
      const material = createStructureMaterial(surface); if (kind !== 'seam') material.color.set(kind === 'tracked' ? '#656360' : kind === 'outer' ? '#44494f' : '#30353a');
      return [kind, { geometry: createStructureGeometry(surface, counts[kind]), material, depth: createStructureDepthMaterial() }];
    })) as Record<typeof kinds[number], { geometry: ReturnType<typeof createStructureGeometry>; material: ReturnType<typeof createStructureMaterial>; depth: ReturnType<typeof createStructureDepthMaterial> }>;
    const occluder = new SpaceOccluder(); occluder.records = Array.from({ length: counts.tracked + counts.outer + counts.bridge }, createBeamBounds);
    return { counts, parts, occluder, points: Array.from({ length: ORDERED.count }, () => HYPER_VERTICES.map(() => [0, 0, 0] as V3)),
      a: new Vector3(), b: new Vector3(), d: new Vector3(), radial: new Vector3(), offset: new Vector3(), local: new Vector3(), inverse: new Quaternion(),
      up: new Vector3(0, 1, 0), dummy: new Object3D(), center: new Vector3() };
  }, []);
  useEffect(() => { previous.current = ''; }, [data]);
  useEffect(() => () => Object.values(data.parts).forEach(p => { p.geometry.dispose(); p.material.dispose(); p.depth.dispose(); }), [data]);
  useFrame(() => {
    const first = nearestSection(motion.z) - ORDERED.behind;
    if (motion.phase === 'exploring') fold.advance(motion.frameDt * Math.max(.18, motion.speedScale), motion.z, motion.spaceFrozen, reduced);
    fold.retain(first); motion.spaceTime = fold.clock;
    const key = Array.from({ length: ORDERED.count }, (_, i) => `${first + i}:${fold.angle(first + i)}`).join('/');
    if (root.current) root.current.userData.rhythm = fold.snapshot();
    if (previous.current === key) return; previous.current = key;
    const cursor = { tracked: 0, outer: 0, bridge: 0, seam: 0 }; let boundsIndex = 0;
    const put = (kind: typeof kinds[number], a: Vector3, b: Vector3, width: number, depth: number, seed: number) => {
      data.d.subVectors(b, a); const length = data.d.length(), index = cursor[kind]++;
      data.dummy.position.copy(a).add(b).multiplyScalar(.5); data.dummy.quaternion.setFromUnitVectors(data.up, data.d.divideScalar(Math.max(.001, length)));
      data.dummy.scale.set(1, 1, 1); data.dummy.updateMatrix(); meshes.current[kind]?.setMatrixAt(index, data.dummy.matrix);
      data.parts[kind].geometry.getAttribute('beamSize').setXYZ(index, width, length + .018, depth); data.parts[kind].geometry.getAttribute('beamSeed').setX(index, seed);
      if (kind !== 'seam') {
        const record = data.occluder.records[boundsIndex++]; data.dummy.scale.set(width, length + .018, depth); data.dummy.updateMatrix();
        record.matrix.copy(data.dummy.matrix); record.inverse.copy(record.matrix).invert();
        const radius = Math.hypot(width, depth) / 2 + .02; record.box.min.copy(a).min(b).addScalar(-radius); record.box.max.copy(a).max(b).addScalar(radius);
      }
    };
    for (let i = 0; i < ORDERED.count; i++) {
      const section = first + i, points = data.points[i], angle = fold.angle(section);
      HYPER_VERTICES.forEach((v, id) => fieldPoint(section, v, angle, points[id]));
      for (const [id, edge] of HYPER_EDGES.entries()) {
        data.a.set(...points[edge.a]); data.b.set(...points[edge.b]); const kind = edge.kind as typeof kinds[number];
        put(kind, data.a, data.b, kind === 'bridge' ? .55 : kind === 'tracked' ? 1.2 : 1.6, kind === 'bridge' ? .55 : kind === 'tracked' ? 1 : 1.3, section * 17 + id * .618);
      }
      data.center.set(0, 0, 0); for (let id = 0; id < 8; id++) data.center.add(data.a.set(...points[id])); data.center.divideScalar(8);
      for (let axis = 0; axis < 3; axis++) {
        data.a.set(...points[6]); data.b.set(...points[6 ^ 1 << axis]).lerp(data.a, .84);
        data.d.subVectors(data.b, data.a).normalize(); data.radial.copy(data.a).sub(data.center).normalize(); data.radial.addScaledVector(data.d, -data.radial.dot(data.d)).normalize();
        data.inverse.setFromUnitVectors(data.up, data.d).invert(); data.local.copy(data.radial).applyQuaternion(data.inverse);
        const surface = Math.min(Math.abs(data.local.x) > 1e-6 ? .6 / Math.abs(data.local.x) : Infinity, Math.abs(data.local.z) > 1e-6 ? .5 / Math.abs(data.local.z) : Infinity) + .035;
        for (const sign of [-1, 1]) { data.offset.copy(data.radial).multiplyScalar(sign * surface); data.a.add(data.offset); data.b.add(data.offset); put('seam', data.a, data.b, .06, .06, section + axis); data.a.sub(data.offset); data.b.sub(data.offset); }
      }
    }
    for (let i = 0; i < ORDERED.count - 1; i++) for (const id of BRIDGE_VERTICES) {
      data.a.set(...data.points[i][id]); data.b.set(...data.points[i + 1][id]); put('bridge', data.a, data.b, .42, .42, (first + i) * 31 + id);
    }
    for (const kind of kinds) { const mesh = meshes.current[kind]; if (mesh) mesh.instanceMatrix.needsUpdate = true;
      (data.parts[kind].geometry.getAttribute('beamSize') as InstancedBufferAttribute).needsUpdate = true; data.parts[kind].geometry.getAttribute('beamSeed').needsUpdate = true; }
    if (root.current) root.current.userData = { firstSection: first, modules: ORDERED.count, verticesPerModule: 16, edgesPerModule: 32, bones: ORDERED.count * 32 + (ORDERED.count - 1) * BRIDGE_VERTICES.length,
      connectiveBridges: (ORDERED.count - 1) * BRIDGE_VERTICES.length, counts: data.counts, rhythm: fold.snapshot(), sections: Array.from({ length: ORDERED.count }, (_, i) => ({ section: first + i, angle: fold.angle(first + i), points: data.points[i].map(p => [...p]) })),
      bloom: false, exteriorParticles: 0, fixedTopology: true, projection: 'same-XW-central-projection-as-approved-model', bridgeGeometry: 'three-dimensional-shared-endpoints', corridor: 'continuous-central-axis' };
  }, -1);
  return <group ref={root} name="ordered-inversion-field">
    <primitive object={data.occluder}/>
    {kinds.map(kind => <instancedMesh key={kind} ref={mesh => { if (mesh) { meshes.current[kind] = mesh; mesh.instanceMatrix.setUsage(DynamicDrawUsage); } }}
      args={[data.parts[kind].geometry, data.parts[kind].material, data.counts[kind]]} customDepthMaterial={data.parts[kind].depth}
      frustumCulled={false} castShadow={kind !== 'seam'} receiveShadow={kind !== 'seam'}/>)}
  </group>;
}
