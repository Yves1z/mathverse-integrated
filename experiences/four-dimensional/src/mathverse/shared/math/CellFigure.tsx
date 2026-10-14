import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, CatmullRomCurve3, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Group, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import type { ContentRuntime, NodeRuntime } from '../../content/runtime';
import { fieldPoint, type OrderedController, type SpaceProjection } from '../../experiments/inversion/orderedModel';
import { CELL_FIGURE, circleTube, figureMarkerSource, mobiusBoundary, mobiusRibbon, projectSourceBuffer, ribbonEdge, rotationRibbon, type SourceMesh } from './cellFigureModel';
import { GAUSSIAN, gaussianBell, gaussianPoint, gaussianSlice } from './gaussianFigureModel';

function dynamicGeometry(source: SourceMesh | BufferGeometry) {
  const geometry = new BufferGeometry(), input = source instanceof BufferGeometry ? new Float32Array(source.getAttribute('position').array) : source.positions;
  const indices = source instanceof BufferGeometry ? source.index : source.indices;
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(input.length), 3).setUsage(DynamicDrawUsage));
  if (indices) geometry.setIndex(indices);
  if (source instanceof BufferGeometry) source.dispose();
  return { geometry, input, output: geometry.getAttribute('position').array as Float32Array };
}
export function CellFigure({ id, node, runtime, fold, section, project = fieldPoint, surfaceColor = '#9ba2a5',horizontalYW=false }: { id: string; node: NodeRuntime; runtime: ContentRuntime; fold: Pick<OrderedController, 'angle'>; section: () => number; project?: SpaceProjection; surfaceColor?: string;horizontalYW?:boolean }) {
  const root = useRef<Group>(null), previous = useRef(''), { camera, size } = useThree();
  const data = useMemo(() => {
    const surface = new MeshStandardMaterial({ color: surfaceColor, metalness: .55, roughness: .36, side: DoubleSide, transparent: true });
    const rim = new MeshStandardMaterial({ color: '#cbc0a4', metalness: .45, roughness: .36, emissive: '#887a55', emissiveIntensity: .20, transparent: true });
    const inner = new MeshStandardMaterial({ color: '#989fa0', metalness: .48, roughness: .40, transparent: true });
    const point = new MeshStandardMaterial({ color: '#e2d2a7', emissive: '#c7b68b', emissiveIntensity: .55, roughness: .45, transparent: true });
    if (id === 'mobius-strip' || id === 'gaussian-integral') rim.emissiveIntensity = .45;
    const parts = id === 'gaussian-integral' ? [dynamicGeometry(gaussianBell()),
      dynamicGeometry(new TubeGeometry(new CatmullRomCurve3(Array.from({length: 193}, (_, i) => new Vector3(...gaussianSlice((i / 192 * 2 - 1) * GAUSSIAN.radius)))), 192, .0085, 6, false)),
      dynamicGeometry(new TubeGeometry(new CatmullRomCurve3(Array.from({length: 192}, (_, i) => new Vector3(...gaussianPoint(GAUSSIAN.radius, i / 192 * Math.PI * 2))), true), 192, .0055, 6, true))] : id === 'mobius-strip' ? [dynamicGeometry(mobiusRibbon()), dynamicGeometry(new TubeGeometry(new CatmullRomCurve3(Array.from({ length: 384 }, (_, i) => new Vector3(...mobiusBoundary(i * Math.PI * 4 / 384))), true), 384, .0085, 6, true)), dynamicGeometry(new SphereGeometry(.027, 12, 8))] : id === 'unit-circle' ? [dynamicGeometry(circleTube()), dynamicGeometry(new SphereGeometry(.027, 12, 8))] : [dynamicGeometry(rotationRibbon()),
      ...[CELL_FIGURE.ribbonOuter, CELL_FIGURE.ribbonInner].map(r => dynamicGeometry(new TubeGeometry(new CatmullRomCurve3(Array.from({ length: 193 }, (_, i) => new Vector3(...ribbonEdge((i / 192 - .5) * Math.PI * CELL_FIGURE.turns * 2, r)))), 192, .0045, 6, false)))];
    return { parts, surfaceRadius: 0, markerIndex: id === 'mobius-strip' ? 2 : id === 'unit-circle' ? 1 : -1, materials: id === 'mobius-strip' ? [surface, rim, point] : id === 'unit-circle' ? [rim, point] : [surface, rim, inner], allMaterials: [surface, rim, inner, point], screen: new Vector3() };
  }, [id, surfaceColor]);
  useEffect(() => () => { data.parts.forEach(p => p.geometry.dispose()); data.allMaterials.forEach(m => m.dispose()); }, [data]);
  useFrame(() => {
    const current = section(), angle = fold.angle(current), sourceAngle = runtime.connection.angle;
    const key = `${current}/${angle}`;
    for (let i = 0; i < data.parts.length; i++) {
      if (key === previous.current && i !== data.markerIndex) continue;
      const part = data.parts[i]; projectSourceBuffer(part.input, part.output, current, angle, i === data.markerIndex ? figureMarkerSource(id, sourceAngle) : [0, 0, 0], project);
      part.geometry.getAttribute('position').needsUpdate = true; part.geometry.computeVertexNormals(); part.geometry.computeBoundingSphere();
      if (i === 0) { data.surfaceRadius = 0; for (let j = 0; j < part.output.length; j += 3) data.surfaceRadius = Math.max(data.surfaceRadius, Math.hypot(part.output[j], part.output[j + 1], part.output[j + 2])); }
    }
    previous.current = key;
    const collapse = Math.abs(1 + 1.9 * Math.cos(angle)), bodyOpacity = horizontalYW?1:Math.min(1, Math.max(0, (collapse - .015) / .075));
    data.materials.forEach((material, i) => { material.opacity = node.alpha * ((id === 'complex-rotation' || id === 'mobius-strip' || id === 'gaussian-integral') && i === 0 ? bodyOpacity : 1); material.depthWrite = material.opacity > .99; });
    if (root.current) {
      const marker = data.markerIndex >= 0 ? project(current, [...figureMarkerSource(id, sourceAngle), -1], angle) : null;
      if (marker) data.screen.set(...marker).project(camera);
      const center = project(current, [0, 0, 0, -1], angle), reference = project(current, [0, 1, 0, -1], angle);
      const radialScale = Math.hypot(...reference.map((v, i) => v - center[i]));
      root.current.userData = { id, section: current, angle, sourceW: -1, sourceGeometry: id === 'gaussian-integral' ? 'finite-radial-gaussian-with-meridian-and-truncation-boundary' : id === 'mobius-strip' ? 'half-twist-ribbon-single-continuous-boundary' : id === 'unit-circle' ? 'unit-circle-and-shared-angle-marker' : 'partial-helicoid-from-complex-radials', singleBoundary: id === 'mobius-strip',
        position: node.position.toArray(), fullCellInterior: true, projection: horizontalYW?'every-source-vertex-through-identical-YW-projection':'every-source-vertex-through-identical-XW-projection', frame: false, portalTexture: false,
        sourceUnchanged: true, projectionBasis:horizontalYW?'YW-horizontal':'XW', endScale: 2.9 / .9, centralReferenceScale: radialScale, localBounds: data.surfaceRadius, boundsMeasure: 'maximum-actual-vertex-distance-from-cell-center',
        markerWorld: marker, markerScreen: marker ? [(data.screen.x + 1) * size.width / 2, (1 - data.screen.y) * size.height / 2] : null,
        collapseOpacity: bodyOpacity };
    }
  }, -.3);
  return <group ref={root} name={`cell-volume-${id}`}>{data.parts.map((part, i) => <mesh key={i} geometry={part.geometry} material={data.materials[i]} frustumCulled={false} dispose={null}/>)}</group>;
}
