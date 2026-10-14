import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CanvasTexture, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Group, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { NodeRuntime, ContentRuntime } from '../../content/runtime';
import { EULER_CHAPTERS } from '../../content/eulerStory';
import type { OrderedController, SpaceProjection } from '../../experiments/inversion/orderedModel';
import { EULER_TRACE, tracePage } from './eulerTraceModel';

function paperTexture(page: number) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 672;
  const ink = canvas.getContext('2d')!;
  ink.fillStyle = '#b9b4a8'; ink.fillRect(0, 0, 512, 672);
  for (let i = 0; i < 1200; i++) { ink.fillStyle = i % 2 ? 'rgba(40,35,28,.026)' : 'rgba(255,255,245,.035)'; ink.fillRect((i * 97) % 512, (i * 179) % 672, 2, 1); }
  ink.fillStyle = '#44423c'; ink.font = '20px Georgia, serif'; ink.fillText('LEONHARD', 44, 60); ink.fillText('EULER', 44, 85);
  ink.font = 'italic 33px Georgia, serif'; ink.fillText(['Σ 1/n²', '4 vertices', 'exp(iθ)'][page], 44, 175);
  ink.lineWidth = 1; ink.strokeStyle = 'rgba(50,48,42,.24)';
  for (let i = 0; i < 9; i++) { ink.beginPath(); ink.moveTo(44, 240 + i * 23); ink.lineTo(44 + 170 + (i * 71) % 195, 240 + i * 23); ink.stroke(); }
  ink.font = '18px Georgia, serif'; ink.fillText(['E041', 'E053', 'E101'][page], 44, 592);
  ink.font = '15px Georgia, serif'; ink.fillText('A CONTEMPORARY STUDY', 44, 623);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4; return texture;
}
export function EulerTrace({ node, runtime, fold, project,horizontalYW=false }: { node: NodeRuntime; runtime: ContentRuntime; fold: Pick<OrderedController, 'angle'>; project: SpaceProjection;horizontalYW?:boolean }) {
  const root = useRef<Group>(null), previous = useRef(''), radius = useRef(0);
  const pages = useMemo(() => Array.from({ length: 3 }, (_, i) => {
    const source = tracePage(i), geometry = new BufferGeometry(), texture = paperTexture(i);
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(source.positions.length), 3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('uv', new Float32BufferAttribute(source.uvs, 2)); geometry.setIndex(source.indices);
    const material = new MeshStandardMaterial({ map: texture, color: '#c6c3b9', roughness: .94, metalness: .02, side: DoubleSide, transparent: true });
    return { source: source.positions, geometry, material, texture, output: geometry.getAttribute('position').array as Float32Array };
  }), []);
  useEffect(() => () => pages.forEach(p => { p.geometry.dispose(); p.material.dispose(); p.texture.dispose(); }), [pages]);
  useFrame(() => {
    const angle = fold.angle(0), key = String(angle), collapse = horizontalYW?1:Math.abs(1 + 1.9 * Math.cos(angle));
    if (previous.current !== key) {
      const center = project(0, [...EULER_TRACE.center, -1], angle), point: [number, number, number] = [0, 0, 0];
      radius.current = 0;
      for (const page of pages) {
        for (let i = 0; i < page.source.length; i += 3) {
          project(0, [page.source[i], page.source[i + 1], page.source[i + 2], -1], angle, point);
          for (let j = 0; j < 3; j++) page.output[i + j] = point[j] - center[j];
          radius.current = Math.max(radius.current, Math.hypot(page.output[i], page.output[i + 1], page.output[i + 2]));
        }
        page.geometry.getAttribute('position').needsUpdate = true; page.geometry.computeVertexNormals(); page.geometry.computeBoundingSphere();
      }
      previous.current = key;
    }
    // The stack remains fixed; the selected chapter leaves an ink-like brightness trace.
    for (let i = 0; i < 3; i++) { pages[i].material.opacity = node.alpha * (.40 + .38 * runtime.euler.weights[i]) * Math.min(1, collapse / .10); pages[i].material.depthWrite = false; }
    if (root.current) root.current.userData = { owner: 0, sourceW: -1, angle, pages: 3, chapter: runtime.euler.chapter,
      source: 'contemporary-paper-study', historicalFacsimile: false, frame: false, independentMotion: false,
      position: node.position.toArray(), localRadius: radius.current, chapterTitles: EULER_CHAPTERS.map(c => c.short), sourceUnchanged: true };
  }, -.3);
  return <group ref={root} name="euler-cell-trace">{pages.map((page, i) => <mesh key={i} geometry={page.geometry} material={page.material} frustumCulled={false} dispose={null}/>)}</group>;
}
