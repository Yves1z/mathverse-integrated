import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Object3D, PointLight, Quaternion, Vector3 } from 'three';
import type { MotionState } from '../../config/motion';
import { createStructureDepthMaterial, createStructureGeometry, createStructureMaterial } from '../../shared/rendering/structureSurface';
import { HYPER_CELLS, HYPER_EDGES, HYPER_VERTICES, INVERSION, projectHyper, type InversionController, type V3 } from './inversionModel';
import { ReflectionEnvironment } from '../../shared/rendering/StudyLighting';

const groups = ['tracked', 'outer', 'bridge', 'seam'] as const;
export function InversionStructure({ motion, model, reduced }: { motion: MotionState; model: InversionController; reduced: boolean }) {
  const root = useRef<Group>(null), light = useRef<PointLight>(null);
  const meshes = useRef<Partial<Record<typeof groups[number], InstancedMesh>>>({});
  const previous = useRef(NaN);
  const data = useMemo(() => {
    const points = HYPER_VERTICES.map(() => [0, 0, 0] as V3);
    const parts = Object.fromEntries(groups.map(group => {
      const kind = group === 'seam' ? 'light' : group === 'tracked' ? 'primary' : group === 'outer' ? 'layer' : 'joint';
      const material = createStructureMaterial(kind);
      if (group !== 'seam') material.color.set(group === 'tracked' ? '#656360' : group === 'outer' ? '#44494f' : '#30353a');
      return [group, { geometry: createStructureGeometry(kind, group === 'seam' ? 6 : group === 'bridge' ? 8 : 12), material, depth: createStructureDepthMaterial() }];
    })) as Record<typeof groups[number], { geometry: ReturnType<typeof createStructureGeometry>; material: ReturnType<typeof createStructureMaterial>; depth: ReturnType<typeof createStructureDepthMaterial> }>;
    return { points, parts, a: new Vector3(), b: new Vector3(), direction: new Vector3(), radial: new Vector3(), offset: new Vector3(), local: new Vector3(), inverse: new Quaternion(), up: new Vector3(0, 1, 0), dummy: new Object3D(), center: new Vector3() };
  }, []);
  useEffect(() => { previous.current = NaN; }, [data]);
  useEffect(() => () => Object.values(data.parts).forEach(p => { p.geometry.dispose(); p.material.dispose(); p.depth.dispose(); }), [data]);
  useFrame(() => {
    model.advance(motion.frameDt, motion.spaceFrozen, reduced); motion.spaceTime = model.clock;
    if (previous.current === model.angle) { if (root.current) root.current.userData.model = model.snapshot(); return; }
    previous.current = model.angle;
    HYPER_VERTICES.forEach((point, i) => projectHyper(point, model.angle, data.points[i]));
    const cursor = { tracked: 0, outer: 0, bridge: 0, seam: 0 };
    const put = (group: typeof groups[number], a: Vector3, b: Vector3, width: number, depth: number, seed: number) => {
      data.direction.subVectors(b, a); const length = data.direction.length(), index = cursor[group]++;
      data.dummy.position.copy(a).add(b).multiplyScalar(.5);
      data.dummy.quaternion.setFromUnitVectors(data.up, data.direction.divideScalar(Math.max(length, .001))); data.dummy.scale.set(1, 1, 1); data.dummy.updateMatrix();
      meshes.current[group]?.setMatrixAt(index, data.dummy.matrix);
      (data.parts[group].geometry.getAttribute('beamSize') as InstancedBufferAttribute).setXYZ(index, width, length + .035, depth);
      (data.parts[group].geometry.getAttribute('beamSeed') as InstancedBufferAttribute).setX(index, seed);
    };
    HYPER_EDGES.forEach((edge, i) => {
      data.a.set(...data.points[edge.a]); data.b.set(...data.points[edge.b]);
      put(edge.kind as typeof groups[number], data.a, data.b, edge.kind === 'bridge' ? 1.1 : edge.kind === 'tracked' ? 2.4 : 3.2, edge.kind === 'bridge' ? 1.1 : edge.kind === 'tracked' ? 2 : 2.6, i * .618);
    });
    // The marked vertex is always the same source point, even when its cell swaps depth.
    const marked = 6; data.center.set(0, 0, 0);
    HYPER_VERTICES.forEach((p, i) => { if (p[3] < 0) data.center.add(new Vector3(...data.points[i])); }); data.center.divideScalar(8);
    for (let axis = 0; axis < 3; axis++) {
      data.a.set(...data.points[marked]); data.b.set(...data.points[marked ^ 1 << axis]).lerp(data.a, .84);
      data.direction.subVectors(data.b, data.a).normalize();
      data.radial.copy(data.a).sub(data.center).normalize(); data.radial.addScaledVector(data.direction, -data.radial.dot(data.direction)).normalize();
      data.inverse.setFromUnitVectors(data.up, data.direction).invert(); data.local.copy(data.radial).applyQuaternion(data.inverse);
      const surface = Math.min(Math.abs(data.local.x) > 1e-6 ? 1.2 / Math.abs(data.local.x) : Infinity, Math.abs(data.local.z) > 1e-6 ? 1 / Math.abs(data.local.z) : Infinity) + .065;
      for (const sign of [-1, 1]) {
        data.offset.copy(data.radial).multiplyScalar(sign * surface); data.a.add(data.offset); data.b.add(data.offset);
        put('seam', data.a, data.b, .12, .12, axis); data.a.sub(data.offset); data.b.sub(data.offset);
      }
    }
    if (light.current) light.current.position.set(...data.points[marked]);
    for (const group of groups) {
      const mesh = meshes.current[group]; if (mesh) mesh.instanceMatrix.needsUpdate = true;
      data.parts[group].geometry.getAttribute('beamSize').needsUpdate = true; data.parts[group].geometry.getAttribute('beamSeed').needsUpdate = true;
    }
    if (root.current) root.current.userData = { model: model.snapshot(), vertices: 16, edges: 32, cubicCells: HYPER_CELLS.length,
      points: data.points.map(p => [...p]), trackedIds: HYPER_VERTICES.flatMap((v, i) => v[3] < 0 ? [i] : []), markedVertex: marked,
      minimumProjectionDenominator: Math.min(...HYPER_VERTICES.map(p => INVERSION.lens - p[0] * Math.sin(model.angle) - p[3] * Math.cos(model.angle))),
      bloom: false, particles: 0, geometries: 4, lightSeams: 6, topologyChanges: 0, exactEdgeProjection: true, displaySections: 'three-dimensional-beveled-beams' };
  }, -1);
  return <group ref={root} name="inversion-structure">
    {groups.map(group => <instancedMesh key={group} ref={mesh => { if (mesh) { meshes.current[group] = mesh; mesh.instanceMatrix.setUsage(DynamicDrawUsage); } }}
      args={[data.parts[group].geometry, data.parts[group].material, group === 'seam' ? 6 : group === 'bridge' ? 8 : 12]}
      customDepthMaterial={data.parts[group].depth} frustumCulled={false} castShadow={group !== 'seam'} receiveShadow={group !== 'seam'}/>)}
    <pointLight ref={light} color="#eee5cf" intensity={35} distance={18} decay={2}/>
  </group>;
}

export function InversionLighting() {
  return <group name="inversion-lighting">
    <ReflectionEnvironment/><ambientLight intensity={.08} color="#dadadc"/>
    <hemisphereLight intensity={.3} color="#e0ded7" groundColor="#121315"/>
    <directionalLight position={[-80, 110, 65]} intensity={2.0} color="#efede7" castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-190} shadow-camera-right={190} shadow-camera-top={190} shadow-camera-bottom={-190}
      shadow-camera-near={1} shadow-camera-far={520} shadow-bias={-.00008} shadow-normalBias={.035} shadow-radius={3} shadow-intensity={.65}/>
    <directionalLight position={[80, -10, -180]} intensity={.8} color="#c3c7cb"/>
    <rectAreaLight position={[-80, 55, -20]} rotation={[-.25, -.9, 0]} width={90} height={110} intensity={3.8} color="#e8e5dd"/>
    <rectAreaLight position={[75, 25, -130]} rotation={[0, 1.4, 0]} width={65} height={95} intensity={2.2} color="#d7dce0"/>
  </group>;
}
