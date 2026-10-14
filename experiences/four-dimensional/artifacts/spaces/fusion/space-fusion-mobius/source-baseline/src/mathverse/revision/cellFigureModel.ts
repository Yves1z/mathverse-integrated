import { fieldPoint, type SpaceProjection } from './orderedModel.ts';
import type { V3 } from './inversionModel.ts';

// The object lives throughout the w=-1 cubic cell, rather than on its z=1 face.
export const CELL_FIGURE = { radius: .70, ribbonInner: .17, ribbonOuter: .64, height: .64,
  turns: 1.5, sourceW: -1, annotations: [-.40, .81, .38] as V3 } as const;
export const VOLUME_IDS = new Set(['unit-circle', 'complex-rotation']);
export const isCellContent = (id: string) => VOLUME_IDS.has(id) || id === 'euler-identity';
export type SourceMesh = { positions: Float32Array; indices: number[] };
export function rotationRibbon(): SourceMesh {
  const positions: number[] = [], indices: number[] = [], nu = 192, nv = 12;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const t = (i / nu - .5) * 2 * Math.PI * CELL_FIGURE.turns;
    const r = CELL_FIGURE.ribbonInner + (CELL_FIGURE.ribbonOuter - CELL_FIGURE.ribbonInner) * j / nv;
    positions.push(r * Math.cos(t), r * Math.sin(t), t * CELL_FIGURE.height / (Math.PI * CELL_FIGURE.turns));
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1; indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { positions: new Float32Array(positions), indices };
}
export function circleTube(): SourceMesh {
  const positions: number[] = [], indices: number[] = [], nu = 256, nv = 8;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = i * 2 * Math.PI / nu, v = j * 2 * Math.PI / nv, r = CELL_FIGURE.radius + .010 * Math.cos(v);
    positions.push(r * Math.cos(u), r * Math.sin(u), .010 * Math.sin(v));
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1; indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { positions: new Float32Array(positions), indices };
}
export function ribbonEdge(t: number, radius: number): V3 {
  return [radius * Math.cos(t), radius * Math.sin(t), t * CELL_FIGURE.height / (Math.PI * CELL_FIGURE.turns)];
}
export function cellCenter(section: number, angle: number, project: SpaceProjection = fieldPoint): V3 { return project(section, [0, 0, 0, -1], angle); }
export function projectSourceBuffer(source: ArrayLike<number>, output: Float32Array, section: number, angle: number, offset: V3 = [0, 0, 0], project: SpaceProjection = fieldPoint) {
  const center = cellCenter(section, angle, project), p: V3 = [0, 0, 0];
  for (let i = 0; i < source.length; i += 3) {
    project(section, [source[i] + offset[0], source[i + 1] + offset[1], source[i + 2] + offset[2], -1], angle, p);
    output[i] = p[0] - center[0]; output[i + 1] = p[1] - center[1]; output[i + 2] = p[2] - center[2];
  }
}
export function cellBounds(id: string, section: number, angle: number, project: SpaceProjection = fieldPoint): V3[] {
  const extents = id === 'unit-circle' ? [.737, .737, .04] : [.65, .65, .65];
  return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => project(section, [x * extents[0], y * extents[1], z * extents[2], -1], angle))));
}
export function markerSource(angle: number): V3 { return [CELL_FIGURE.radius * Math.cos(angle), CELL_FIGURE.radius * Math.sin(angle), 0]; }
