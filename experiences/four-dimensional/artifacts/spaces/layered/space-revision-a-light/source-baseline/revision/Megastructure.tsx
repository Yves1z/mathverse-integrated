import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { DirectionalLight, DynamicDrawUsage, Group, InstancedMesh, Object3D, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MotionState } from '../config/motion';
import { beamRouteClearance, createField, projectVertexInto, SPACE_A, type Assembly, type BeamKind, type FoldController } from './spaceModel';

const kinds: BeamKind[] = ['primary', 'layer', 'joint', 'light'];

export function Megastructure({ motion, fold, reduced }: { motion: MotionState; fold: FoldController; reduced: boolean }) {
  const [first, setFirst] = useState(-SPACE_A.baysBehind);
  const root = useRef<Group>(null);
  const meshes = useRef<Partial<Record<BeamKind, InstancedMesh>>>({});
  const assemblies = useMemo(() => createField(first), [first]);
  const dummy = useMemo(() => new Object3D(), []);
  const start = useMemo(() => new Vector3(), []), end = useMemo(() => new Vector3(), []), delta = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 1, .025), []);
  const counts = useMemo(() => {
    const result = { primary: 0, layer: 0, joint: 0, light: 0 };
    for (const assembly of assemblies) for (const beam of assembly.beams) result[beam.kind]++;
    return result;
  }, [assemblies]);
  const projected = useMemo(() => new Map<Assembly, [number, number, number][]>(assemblies.map(a => [a, a.vertices.map(() => [0, 0, 0])])), [assemblies]);
  const renderedAngles = useMemo(() => new Map<Assembly, number>(), [assemblies]);
  const clearances = useMemo(() => new Map<Assembly, number>(), [assemblies]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const nextFirst = Math.floor(motion.distance / SPACE_A.bayLength) - SPACE_A.baysBehind;
    if (nextFirst !== first) setFirst(nextFirst);
    fold.advance(motion.frameDt, motion.z, motion.spaceFrozen, reduced);
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
      for (const beam of assembly.beams) {
        const a = points[beam.a], b = points[beam.b];
        start.set(...a); end.set(...b); delta.subVectors(end, start);
        const length = delta.length();
        dummy.position.copy(start).add(end).multiplyScalar(.5);
        dummy.quaternion.setFromUnitVectors(up, delta.divideScalar(length));
        dummy.scale.set(beam.width, length + .035, beam.depth);
        dummy.updateMatrix(); meshes.current[beam.kind]?.setMatrixAt(cursor[beam.kind]++, dummy.matrix); changed.add(beam.kind);
        assemblyClearance = Math.min(assemblyClearance, beamRouteClearance(a, b, Math.hypot(beam.width, beam.depth) / 2 + .04));
      }
      renderedAngles.set(assembly, angle); clearances.set(assembly, assemblyClearance);
      minimumClearance = Math.min(minimumClearance, assemblyClearance);
    }
    for (const kind of kinds) {
      const mesh = meshes.current[kind];
      if (mesh) { mesh.count = cursor[kind]; if (changed.has(kind)) mesh.instanceMatrix.needsUpdate = true; }
    }
    if (root.current) root.current.userData = { firstSection: first, counts, minimumClearance,
      sharedVertices: assemblies.reduce((n, a) => n + a.vertices.length, 0), fold: fold.snapshot(), bloom: false, particles: 0 };
  }, -1);

  return <group ref={root} name="layered-megastructure">
    {kinds.map(kind => <instancedMesh key={kind} ref={mesh => {
      if (mesh) { meshes.current[kind] = mesh; mesh.instanceMatrix.setUsage(DynamicDrawUsage); }
    }} args={[geometry, undefined, counts[kind]]} frustumCulled={false} castShadow={kind !== 'light'} receiveShadow={kind !== 'light'}>
      {kind === 'light' ? <meshBasicMaterial color="#c4bda9"/> :
        <meshStandardMaterial color={kind === 'primary' ? '#74767a' : kind === 'joint' ? '#414348' : '#62656a'}
          roughness={kind === 'primary' ? .62 : .73} metalness={.14}/>} 
    </instancedMesh>)}
  </group>;
}

export function StudyLighting({ motion }: { motion: MotionState }) {
  const key = useRef<DirectionalLight>(null), fill = useRef<DirectionalLight>(null);
  useFrame(() => {
    const z = Math.round(motion.z * 8) / 8;
    if (key.current) {
      key.current.position.set(-16, 9, z + 28);
      key.current.target.position.set(-4, 4, z - 30); key.current.target.updateMatrixWorld();
    }
    if (fill.current) {
      fill.current.position.set(24, 6, z - 45);
      fill.current.target.position.set(0, 0, z - 12); fill.current.target.updateMatrixWorld();
    }
  }, -.5);
  return <group name="study-lighting">
    <ambientLight intensity={.24} color="#dbdce0"/>
    <hemisphereLight intensity={.48} color="#e0e0e2" groundColor="#17181a"/>
    <directionalLight ref={key} position={[-16, 9, 24]} color="#f0eeea" intensity={4.6} castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-48} shadow-camera-right={48}
      shadow-camera-top={38} shadow-camera-bottom={-38} shadow-camera-near={1} shadow-camera-far={155}
      shadow-bias={-.00008} shadow-normalBias={.045}/>
    <directionalLight ref={fill} position={[24, 6, -49]} color="#e5e5e6" intensity={.62}/>
    <directionalLight position={[-28, 5, -60]} intensity={.33} color="#e4d9c5"/>
  </group>;
}
