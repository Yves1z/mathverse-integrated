import { HYPER_EDGES, HYPER_VERTICES, INVERSION, rotateXW, type V3, type V4 } from '../inversion/inversionModel.ts';

// A bounded composition study: one inhabited cell and two quiet reference cells.
// Only the cells are 4D projections. The shared scaffold is an artistic 3D graph.
export const FUSION = { origin: -104, pitch: 118, rings: 10, left: -132, right: 132, bottom: -74, top: 128 } as const;
export const FUSION_CELLS = [
  { id: -1, center: [88, -20, 14] as V3, yaw: -.52, scale: 12, role: 'side-behind' },
  { id: 0, center: [-72, 14, -104] as V3, yaw: 1.02, scale: 16, role: 'euler' },
  { id: 1, center: [30, 92, -222] as V3, yaw: -.12, scale: 12, role: 'upper-ahead' },
] as const;
export const THREE_WORLD_CELLS = [...FUSION_CELLS,
  { id: 2, center: [76, -24, -182] as V3, yaw: -.9, scale: 16, role: 'gaussian-ahead' },
] as const;
function placedPoint(cell: { center: V3; yaw: number; scale: number }, source: V4, angle: number, output: V3): V3 {
  const p = rotateXW(source, angle), s = cell.scale * INVERSION.lens / (INVERSION.lens - p[3]), c = Math.cos(cell.yaw), sn = Math.sin(cell.yaw);
  output[0] = cell.center[0] + (p[0] * c + p[2] * sn) * s;
  output[1] = cell.center[1] + p[1] * s;
  output[2] = cell.center[2] + (-p[0] * sn + p[2] * c) * s;
  return output;
}
export function fusionPoint(section: number, source: V4, angle: number, output: V3 = [0, 0, 0]): V3 {
  const cell = FUSION_CELLS.find(c => c.id === section) ?? FUSION_CELLS[1];
  return placedPoint(cell, source, angle, output);
}
export function threeWorldPoint(section: number, source: V4, angle: number, output: V3 = [0, 0, 0]): V3 {
  return placedPoint(THREE_WORLD_CELLS.find(c => c.id === section) ?? FUSION_CELLS[1], source, angle, output);
}
export type FusionKind = 'tracked' | 'outer' | 'bridge' | 'spine' | 'seam';
export type FusionBeam = { kind: FusionKind; a: V3; b: V3; width: number; depth: number; unit: number | null; vertex?: number; ring?: number };
export const FUSION_COUNTS = { tracked: 36, outer: 36, bridge: 36, spine: 76, seam: 6 } as const;
export const THREE_WORLD_COUNTS = { tracked: 48, outer: 48, bridge: 48, spine: 76, seam: 6 } as const;
export function firstFusionRing(cameraZ: number) { return Math.floor((FUSION.origin - cameraZ) / FUSION.pitch) - 5; }
export function fusionCorner(ring: number, corner: number): V3 {
  return [corner & 1 ? FUSION.right : FUSION.left, corner & 2 ? FUSION.top : FUSION.bottom, FUSION.origin - ring * FUSION.pitch + FUSION.pitch / 2];
}
export function fusionBeams(angle: number, firstRing: number, upperAngle = 0, gaussianAngle?: number): FusionBeam[] {
  const result: FusionBeam[] = [];
  const cells = gaussianAngle === undefined ? FUSION_CELLS : THREE_WORLD_CELLS, project = gaussianAngle === undefined ? fusionPoint : threeWorldPoint;
  const put = (kind: FusionKind, a: V3, b: V3, width: number, depth: number, unit: number | null, extra: Partial<FusionBeam> = {}) => result.push({ kind, a, b, width, depth, unit, ...extra });
  for (const cell of cells) {
    const theta = cell.id === 0 ? angle : cell.id === 1 ? upperAngle : cell.id === 2 ? gaussianAngle! : 0, points = HYPER_VERTICES.map(v => project(cell.id, v, theta));
    for (const edge of HYPER_EDGES) put(edge.kind as FusionKind, points[edge.a], points[edge.b], edge.kind === 'bridge' ? .48 : edge.kind === 'tracked' ? 1.04 : 1.35,
      edge.kind === 'bridge' ? .48 : edge.kind === 'tracked' ? .92 : 1.1, cell.id);
    // Four branches attach exactly to projected cell vertices and scaffold corners.
    // They have no independent rotation or phase.
    for (const vertex of [8, 14]) {
      const corner = (cell.center[0] > 0 ? 1 : 0) | (vertex === 14 ? 2 : 0);
      const attachRing = cell.id === 2 ? 1 : cell.id;
      for (const ring of [attachRing, attachRing + 1]) put('bridge', points[vertex], fusionCorner(ring, corner), .55, .55, cell.id, { vertex, ring });
    }
    if (cell.id !== 0) continue;
    const center = fusionPoint(0, [0, 0, 0, -1], theta), a = points[6];
    for (let axis = 0; axis < 3; axis++) {
      const end = points[6 ^ (1 << axis)], delta = end.map((v, k) => v - a[k]), length = Math.hypot(...delta), direction = delta.map(v => v / length);
      const radial = a.map((v, k) => v - center[k]), dot = radial.reduce((sum, v, k) => sum + v * direction[k], 0);
      let normal = radial.map((v, k) => v - direction[k] * dot), normalLength = Math.hypot(...normal);
      if (normalLength < 1e-8) { normal = [direction[2], 0, -direction[0]]; normalLength = Math.hypot(...normal); }
      for (const sign of [-1, 1]) {
        const offset = normal.map(v => v / normalLength * sign * .72);
        put('seam', a.map((v, k) => v + offset[k]) as V3, a.map((v, k) => v + delta[k] * .16 + offset[k]) as V3, .04, .04, 0);
      }
    }
  }
  for (let i = 0; i < FUSION.rings; i++) {
    const ring = firstRing + i;
    for (const [a, b] of [[0, 1], [0, 2], [1, 3], [2, 3]]) put('spine', fusionCorner(ring, a), fusionCorner(ring, b), 2.15, 1.7, null);
    if (i < FUSION.rings - 1) for (let corner = 0; corner < 4; corner++) put('spine', fusionCorner(ring, corner), fusionCorner(ring + 1, corner), 1.7, 1.7, null);
  }
  return result;
}
