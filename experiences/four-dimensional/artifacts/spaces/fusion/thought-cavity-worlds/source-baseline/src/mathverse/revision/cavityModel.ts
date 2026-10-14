import { HYPER_EDGES, HYPER_VERTICES, INVERSION, rotateXW, type V3, type V4 } from './inversionModel.ts';

export const CAVITY = { center: [-88, 14, -110] as V3, scale: 18, yaw: .90, firstBay: -2, bays: 8, pitch: 64, routeRadius: 3.2 } as const;
export function cavityPoint(_section: number, source: V4, angle: number, output: V3 = [0, 0, 0]): V3 {
  const p = rotateXW(source, angle), scale = CAVITY.scale * INVERSION.lens / (INVERSION.lens - p[3]), c = Math.cos(CAVITY.yaw), s = Math.sin(CAVITY.yaw);
  output[0] = CAVITY.center[0] + (p[0] * c + p[2] * s) * scale;
  output[1] = CAVITY.center[1] + p[1] * scale;
  output[2] = CAVITY.center[2] + (-p[0] * s + p[2] * c) * scale;
  return output;
}
export type CavityKind = 'primary' | 'layer' | 'joint' | 'light';
export type CavityBeam = { a: V3; b: V3; width: number; depth: number; kind: CavityKind; moving: boolean; sourceA?: V4; sourceB?: V4; attachment?: number };
export const CAVITY_SOCKETS = [12, 13, 14, 15].map(vertex => {
  const p = cavityPoint(0, HYPER_VERTICES[vertex], 0);
  return { vertex, point: [p[0] + 12 * Math.sin(CAVITY.yaw), p[1], p[2] + 12 * Math.cos(CAVITY.yaw)] as V3 };
});
export function cavityBeams(angle: number): CavityBeam[] {
  const beams: CavityBeam[] = [];
  const put = (a: V3, b: V3, width: number, depth: number, kind: CavityKind, extra: Partial<CavityBeam> = {}) => beams.push({ a, b, width, depth, kind, moving: false, ...extra });
  const loop = (points: V3[], width: number, depth: number, kind: CavityKind) => points.forEach((p, i) => put(p, points[(i + 1) % points.length], width, depth, kind));
  // The populated chamber is fixed. Surrounding empty bays establish a finite architectural study.
  for (let index = 0; index < CAVITY.bays; index++) {
    const z = -30 - (CAVITY.firstBay + index) * CAVITY.pitch;
    loop([[-34, -32, z], [-34, 54, z], [36, 54, z], [36, -32, z]], 3.8, 4.6, 'primary');
    if (index < CAVITY.bays - 1) for (const x of [-34, 36]) for (const y of [-32, 54]) put([x, y, z], [x, y, z - CAVITY.pitch], 2.7, 3.4, 'primary');
    for (let rib = 0; rib < 6; rib++) {
      const x = 40 + rib * 2.1;
      loop([[x, -28, z + 18], [x, 48, z + 18], [x, 48, z - 18], [x, -28, z - 18]], 1.0, 1.8, 'layer');
    }
    for (let rib = 0; rib < 5; rib++) {
      const y = 60 + rib * 2.0;
      loop([[-50, y, z + 16], [62, y, z + 16], [62, y, z - 16], [-50, y, z - 16]], 1.2, 2.0, 'layer');
    }
    // Leave an actual side opening around the Euler chamber, rather than fading a wall.
    if (z < -200 || z > 20) for (let rib = 0; rib < 5; rib++) {
      const x = -42 - rib * 2.2;
      loop([[x, -28, z + 18], [x, 48, z + 18], [x, 48, z - 18], [x, -28, z - 18]], 1.0, 1.8, 'layer');
    }
  }
  // One near upright gives a narrow, physical occlusion that changes with forward parallax.
  put([-34, -32, -46], [-34, 64, -46], 3.8, 4.6, 'primary');
  const collar = CAVITY_SOCKETS.map(s => s.point);
  // Reorder the four source corners to form a face perimeter.
  loop([collar[0], collar[1], collar[3], collar[2]], 3.4, 4.2, 'primary');
  for (const socket of CAVITY_SOCKETS) {
    put(socket.point, [-34, socket.vertex & 2 ? 54 : -32, socket.point[2]], 3.4, 4.2, 'primary');
    put(cavityPoint(0, HYPER_VERTICES[socket.vertex], angle), socket.point, 2.0, 2.4, 'joint', { moving: true, attachment: socket.vertex });
  }
  const sourceEdge = (a: V4, b: V4, width: number, depth: number, kind: CavityKind) => put(cavityPoint(0, a, angle), cavityPoint(0, b, angle), width, depth, kind, { moving: true, sourceA: a, sourceB: b });
  for (const edge of HYPER_EDGES) {
    const kind = edge.kind === 'outer' ? 'primary' : edge.kind === 'tracked' ? 'layer' : 'joint';
    sourceEdge(HYPER_VERTICES[edge.a], HYPER_VERTICES[edge.b], edge.kind === 'outer' ? 2.7 : edge.kind === 'tracked' ? 1.1 : .75, edge.kind === 'outer' ? 3.4 : edge.kind === 'tracked' ? 1.6 : .95, kind);
  }
  // Seven nested source-face ribs share the exact cell projection and slow event.
  // Corner identities are fixed in 4D; no independently spinning decorative cage.
  for (let rib = 0; rib < 7; rib++) {
    const w = -.80 + rib * .28, corners: V4[] = [[-1, -1, 1, w], [1, -1, 1, w], [1, 1, 1, w], [-1, 1, 1, w]];
    for (let i = 0; i < 4; i++) sourceEdge(corners[i], corners[(i + 1) % 4], .75, 1.3, 'layer');
  }
  // A short source-space ivory seam stays fixed to the inhabited inner cell.
  sourceEdge([-.98, .96, .99, -1], [-.68, .96, .99, -1], .025, .035, 'light');
  return beams;
}
export function cavityCounts() {
  const result = { primary: 0, layer: 0, joint: 0, light: 0 };
  for (const beam of cavityBeams(0)) result[beam.kind]++;
  return result;
}
