import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Group, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import type { ContentRuntime, NodeRuntime } from '../content/runtime';
import { fieldPoint, type OrderedController } from './orderedModel';
import { CELL_FIGURE, circleTube, markerSource, projectSourceBuffer, ribbonEdge, rotationRibbon, type SourceMesh } from './cellFigureModel';

function dynamicGeometry(source: SourceMesh | BufferGeometry) {
  const geometry = new BufferGeometry(), input = source instanceof BufferGeometry ? new Float32Array(source.getAttribute('position').array) : source.positions;
  const indices = source instanceof BufferGeometry ? source.index : source.indices;
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(input.length), 3).setUsage(DynamicDrawUsage));
  if (indices) geometry.setIndex(indices);
  if (source instanceof BufferGeometry) source.dispose();
  return { geometry, input, output: geometry.getAttribute('position').array as Float32Array };
}
export function CellFigure({ id, node, runtime, fold, section }: { id: string; node: NodeRuntime; runtime: ContentRuntime; fold: OrderedController; section: () => number }) {
  const root = useRef<Group>(null), previous = useRef(''), { camera, size } = useThree();
  const data = useMemo(() => {
    const surface = new MeshStandardMaterial({ color: '#9ba2a5', metalness: .55, roughness: .36, side: DoubleSide, transparent: true });
    const rim = new MeshStandardMaterial({ color: '#cbc0a4', metalness: .45, roughness: .36, emissive: '#887a55', emissiveIntensity: .20, transparent: true });
    const inner = new MeshStandardMaterial({ color: '#989fa0', metalness: .48, roughness: .40, transparent: true });
    const point = new MeshStandardMaterial({ color: '#e2d2a7', emissive: '#c7b68b', emissiveIntensity: .55, roughness: .45, transparent: true });
    const parts = id === 'unit-circle' ? [dynamicGeometry(circleTube()), dynamicGeometry(new SphereGeometry(.027, 12, 8))] : [dynamicGeometry(rotationRibbon()),
      ...[CELL_FIGURE.ribbonOuter, CELL_FIGURE.ribbonInner].map(r => dynamicGeometry(new TubeGeometry(new CatmullRomCurve3(Array.from({ length: 193 }, (_, i) => new Vector3(...ribbonEdge((i / 192 - .5) * Math.PI * CELL_FIGURE.turns * 2, r)))), 192, .0045, 6, false)))];
    return { parts, materials: id === 'unit-circle' ? [rim, point] : [surface, rim, inner], allMaterials: [surface, rim, inner, point], screen: new Vector3() };
  }, [id]);
  useEffect(() => () => { data.parts.forEach(p => p.geometry.dispose()); data.allMaterials.forEach(m => m.dispose()); }, [data]);
  useFrame(() => {
    const current = section(), angle = fold.angle(current), sourceAngle = runtime.connection.angle;
    const key = `${current}/${angle}`;
    for (let i = 0; i < data.parts.length; i++) {
      if (key === previous.current && !(id === 'unit-circle' && i === 1)) continue;
      const part = data.parts[i]; projectSourceBuffer(part.input, part.output, current, angle, id === 'unit-circle' && i === 1 ? markerSource(sourceAngle) : [0, 0, 0]);
      part.geometry.getAttribute('position').needsUpdate = true; part.geometry.computeVertexNormals(); part.geometry.computeBoundingSphere();
    }
    previous.current = key;
    const collapse = Math.abs(1 + 1.9 * Math.cos(angle)), bodyOpacity = Math.min(1, Math.max(0, (collapse - .015) / .075));
    data.materials.forEach((material, i) => { material.opacity = node.alpha * (id === 'complex-rotation' && i === 0 ? bodyOpacity : 1); material.depthWrite = material.opacity > .99; });
    if (root.current) {
      const marker = id === 'unit-circle' ? fieldPoint(current, [...markerSource(sourceAngle), -1], angle) : null;
      if (marker) data.screen.set(...marker).project(camera);
      const radialScale = 16 * 1.9 / (1.9 + Math.cos(angle));
      root.current.userData = { id, section: current, angle, sourceW: -1, sourceGeometry: id === 'unit-circle' ? 'unit-circle-and-shared-angle-marker' : 'partial-helicoid-from-complex-radials',
        position: node.position.toArray(), fullCellInterior: true, projection: 'every-source-vertex-through-identical-XW-projection', frame: false, portalTexture: false,
        sourceUnchanged: true, endScale: 2.9 / .9, centralReferenceScale: radialScale, localBounds: data.parts[0].geometry.boundingSphere?.radius,
        markerWorld: marker, markerScreen: marker ? [(data.screen.x + 1) * size.width / 2, (1 - data.screen.y) * size.height / 2] : null,
        collapseOpacity: bodyOpacity };
    }
  }, -.3);
  return <group ref={root} name={`cell-volume-${id}`}>{data.parts.map((part, i) => <mesh key={i} geometry={part.geometry} material={data.materials[i]} frustumCulled={false} dispose={null}/>)}</group>;
}
