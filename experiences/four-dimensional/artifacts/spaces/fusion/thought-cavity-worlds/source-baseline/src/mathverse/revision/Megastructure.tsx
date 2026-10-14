import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Object3D, Vector3 } from 'three';
import type { MotionState } from '../config/motion';
import { beamRouteClearance, createField, projectVertexInto, SPACE_A, type Assembly, type BeamKind, type FoldController } from './spaceModel';
import { createStructureDepthMaterial, createStructureGeometry, createStructureMaterial } from './structureSurface';
import { createBeamBounds, SpaceOccluder } from './SpaceOccluder';

const kinds: BeamKind[] = ['primary', 'layer', 'joint', 'light'];

export function Megastructure({ motion, fold, reduced, content=false }: { motion: MotionState; fold: FoldController; reduced: boolean; content?:boolean }) {
  const [first, setFirst] = useState(-SPACE_A.baysBehind);
  const root = useRef<Group>(null);
  const meshes = useRef<Partial<Record<BeamKind, InstancedMesh>>>({});
  const assemblies = useMemo(() => createField(first), [first]);
  const dummy = useMemo(() => new Object3D(), []);
  const start = useMemo(() => new Vector3(), []), end = useMemo(() => new Vector3(), []), delta = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const counts = useMemo(() => {
    const result = { primary: 0, layer: 0, joint: 0, light: 0 };
    for (const assembly of assemblies) for (const beam of assembly.beams) result[beam.kind]++;
    return result;
  }, [assemblies]);
  const surfaces = useMemo(() => Object.fromEntries(kinds.map(kind => [kind, {
    geometry: createStructureGeometry(kind, counts[kind]), material: createStructureMaterial(kind), depth: createStructureDepthMaterial(),
  }])) as Record<BeamKind, { geometry: ReturnType<typeof createStructureGeometry>; material: ReturnType<typeof createStructureMaterial>; depth: ReturnType<typeof createStructureDepthMaterial> }>, [counts]);
  const projected = useMemo(() => new Map<Assembly, [number, number, number][]>(assemblies.map(a => [a, a.vertices.map(() => [0, 0, 0])])), [assemblies]);
  const renderedAngles = useMemo(() => new Map<Assembly, number>(), [assemblies]);
  const clearances = useMemo(() => new Map<Assembly, number>(), [assemblies]);
  const occluder = useMemo(() => new SpaceOccluder(), []);
  const bounds = useMemo(() => new Map(assemblies.map(a => [a, a.beams.map(() => createBeamBounds())])), [assemblies]);
  useEffect(() => { occluder.records = content ? [...bounds.values()].flat() : []; }, [bounds, content, occluder]);
  useEffect(() => () => { for (const surface of Object.values(surfaces)) {
    surface.geometry.dispose(); surface.material.dispose(); surface.depth.dispose();
  } }, [surfaces]);

  useFrame(() => {
    const nextFirst = Math.floor(motion.distance / SPACE_A.bayLength) - SPACE_A.baysBehind;
    if (nextFirst !== first) setFirst(nextFirst);
    fold.advance(motion.frameDt * (content ? Math.max(.18, motion.speedScale) : 1), motion.z, motion.spaceFrozen, reduced);
    fold.retain(first);
    motion.spaceTime = fold.clock;
    const cursor = { primary: 0, layer: 0, joint: 0, light: 0 };
    const changed = new Set<BeamKind>();
    let minimumClearance = Infinity;
    for (const assembly of assemblies) {
      const angle = assembly.moving ? fold.angle(assembly.section) : 0;
      if (renderedAngles.get(assembly) === angle) {
        for (const beam of assembly.beams) cursor[beam.kind]++;
        minimumClearance = Math.min(minimumClearance, clearances.get(assembly)!);
        continue;
      }
      const points = projected.get(assembly)!;
      assembly.vertices.forEach((point, i) => {
        projectVertexInto(point, angle, assembly.anchor, points[i]);
      });
      let assemblyClearance = Infinity;
      for (const [beamIndex, beam] of assembly.beams.entries()) {
        const a = points[beam.a], b = points[beam.b];
        start.set(...a); end.set(...b); delta.subVectors(end, start);
        const length = delta.length();
        dummy.position.copy(start).add(end).multiplyScalar(.5);
        dummy.quaternion.setFromUnitVectors(up, delta.divideScalar(length));
        dummy.scale.set(1, 1, 1);
        const index = cursor[beam.kind]++, geometry = surfaces[beam.kind].geometry;
        (geometry.getAttribute('beamSize') as InstancedBufferAttribute).setXYZ(index, beam.width, length + .035, beam.depth);
        // Identity remains tied to its assembly and beam when sections recycle.
        (geometry.getAttribute('beamSeed') as InstancedBufferAttribute).setX(index, assembly.section * 17 + beamIndex * .618 + (assembly.moving ? .31 : .73));
        dummy.updateMatrix(); meshes.current[beam.kind]?.setMatrixAt(index, dummy.matrix); changed.add(beam.kind);
        if (content) {
          const record = bounds.get(assembly)![beamIndex];
          dummy.scale.set(beam.width, length + .035, beam.depth); dummy.updateMatrix();
          record.matrix.copy(dummy.matrix); record.inverse.copy(dummy.matrix).invert();
          const radius = Math.hypot(beam.width, beam.depth) / 2 + .02;
          record.box.min.copy(start).min(end).addScalar(-radius); record.box.max.copy(start).max(end).addScalar(radius);
        }
        assemblyClearance = Math.min(assemblyClearance, beamRouteClearance(a, b, Math.hypot(beam.width, beam.depth) / 2 + .04));
      }
      renderedAngles.set(assembly, angle); clearances.set(assembly, assemblyClearance);
      minimumClearance = Math.min(minimumClearance, assemblyClearance);
    }
    for (const kind of kinds) {
      const mesh = meshes.current[kind];
      if (mesh) { mesh.count = cursor[kind]; if (changed.has(kind)) {
        mesh.instanceMatrix.needsUpdate = true; surfaces[kind].geometry.getAttribute('beamSize').needsUpdate = true;
        surfaces[kind].geometry.getAttribute('beamSeed').needsUpdate = true;
      } }
    }
    if (root.current) root.current.userData = { firstSection: first, counts, minimumClearance,
      sharedVertices: assemblies.reduce((n, a) => n + a.vertices.length, 0), fold: fold.snapshot(), bloom: false, particles: 0,
      surface: 'satin-graphite', physicalBevel: true, shadowGeometryMatches: true };
  }, -1);

  return <group ref={root} name="layered-megastructure">
    {content && <primitive object={occluder}/>}
    {kinds.map(kind => <instancedMesh key={kind} ref={mesh => {
      if (mesh) { meshes.current[kind] = mesh; mesh.instanceMatrix.setUsage(DynamicDrawUsage); }
    }} args={[surfaces[kind].geometry, surfaces[kind].material, counts[kind]]}
      customDepthMaterial={surfaces[kind].depth} frustumCulled={false} castShadow={kind !== 'light'} receiveShadow={kind !== 'light'}/>)}
  </group>;
}
