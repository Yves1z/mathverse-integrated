import { CAVITY, cavityBeams, cavityPoint, type CavityBeam } from './cavityModel.ts';
import { HYPER_EDGES, HYPER_VERTICES, INVERSION, rotateXW, type V3, type V4 } from '../inversion/inversionModel.ts';

export const CAVITY_WORLDS = [
  { id: 'euler', center: CAVITY.center, scale: CAVITY.scale, yaw: CAVITY.yaw, pitch: 0 },
  { id: 'mobius', center: [8, 124, -168] as V3, scale: 18, yaw: -.12, pitch: .68 },
  { id: 'gaussian', center: [-2, -106, -174] as V3, scale: 18, yaw: -.08, pitch: -.48 },
] as const;
export function cavityWorldPoint(section: number, source: V4, angle: number, output: V3 = [0, 0, 0]): V3 {
  if (section === 0) return cavityPoint(0, source, angle, output);
  const cell = CAVITY_WORLDS[section];
  if (!cell) throw new RangeError('Unknown inhabited cavity');
  const p = rotateXW(source, angle), scale = cell.scale * INVERSION.lens / (INVERSION.lens - p[3]);
  const cy = Math.cos(cell.yaw), sy = Math.sin(cell.yaw), cp = Math.cos(cell.pitch), sp = Math.sin(cell.pitch);
  const y = p[1] * cp - p[2] * sp, z = p[1] * sp + p[2] * cp;
  output[0] = cell.center[0] + (p[0] * cy + z * sy) * scale;
  output[1] = cell.center[1] + y * scale;
  output[2] = cell.center[2] + (-p[0] * sy + z * cy) * scale;
  return output;
}
export type CavityWorldBeam = CavityBeam & { section?: number };
export const WORLD_SOCKETS = CAVITY_WORLDS.map((cell, section) => [12, 13, 14, 15].map(vertex => {
  const p = cavityWorldPoint(section, HYPER_VERTICES[vertex], 0);
  return { section, vertex, point: [p[0] + 12 * Math.sin(cell.yaw) * Math.cos(cell.pitch), p[1] - 12 * Math.sin(cell.pitch), p[2] + 12 * Math.cos(cell.yaw) * Math.cos(cell.pitch)] as V3 };
}));
export function cavityWorldBeams(angles: readonly number[]): CavityWorldBeam[] {
  const beams: CavityWorldBeam[] = cavityBeams(angles[0] ?? 0)
    // A physical ceiling opening reveals the upper cavity; surrounding bays keep their layers.
    .filter(b => !(b.kind === 'layer' && !b.moving && b.a[1] >= 60 && b.b[1] >= 60 && Math.max(b.a[2], b.b[2]) < -60 && Math.min(b.a[2], b.b[2]) > -200))
    .map(b => {
      // Lift the crown and lower the sill at this viewing bay. The physical opening
      // keeps near structure at the perimeter while the fully expanded figure remains legible.
      if (!b.moving && b.kind === 'primary' && b.a[2] === -94 && b.b[2] === -94 && b.a[1] === b.b[1] && (b.a[1] === 54 || b.a[1] === -32)) {
        const y = b.a[1] === 54 ? 78 : -56;
        return { ...b, a: [b.a[0], y, -94] as V3, b: [b.b[0], y, -94] as V3 };
      }
      return b.moving ? { ...b, section: 0 } : b;
    });
  const put = (a: V3, b: V3, width: number, depth: number, kind: CavityBeam['kind'], extra: Partial<CavityWorldBeam> = {}) => beams.push({ a, b, width, depth, kind, moving: false, ...extra });
  const loop = (points: V3[], width: number, depth: number, kind: CavityBeam['kind']) => points.forEach((p, i) => put(p, points[(i + 1) % points.length], width, depth, kind));
  for (const x of [-34, 36]) { put([x, 54, -94], [x, 78, -94], 3.8, 4.6, 'primary'); put([x, -32, -94], [x, -56, -94], 3.8, 4.6, 'primary'); }
  // Repeated undercroft layers surround an actual opening instead of hiding a floor with alpha.
  for (let index = 0; index < CAVITY.bays; index++) {
    const z = -30 - (CAVITY.firstBay + index) * CAVITY.pitch;
    if (z < -180 || z > 0) for (let rib = 0; rib < 5; rib++) {
      const y = -40 - rib * 2;
      loop([[-50, y, z + 16], [62, y, z + 16], [62, y, z - 16], [-50, y, z - 16]], 1.2, 2, 'layer');
    }
  }
  for (const section of [1, 2]) {
    const angle = angles[section] ?? 0, sockets = WORLD_SOCKETS[section], collar = sockets.map(s => s.point);
    loop([collar[0], collar[1], collar[3], collar[2]], 3.4, 4.2, 'primary');
    for (const socket of sockets) {
      put(socket.point, [socket.vertex & 1 ? 36 : -34, section === 1 ? 54 : -32, socket.point[2]], 3.4, 4.2, 'primary');
      put(cavityWorldPoint(section, HYPER_VERTICES[socket.vertex], angle), socket.point, 2, 2.4, 'joint', { moving: true, section, attachment: socket.vertex });
    }
    const sourceEdge = (a: V4, b: V4, width: number, depth: number, kind: CavityBeam['kind']) => put(cavityWorldPoint(section, a, angle), cavityWorldPoint(section, b, angle), width, depth, kind, { moving: true, section, sourceA: a, sourceB: b });
    for (const edge of HYPER_EDGES) sourceEdge(HYPER_VERTICES[edge.a], HYPER_VERTICES[edge.b], edge.kind === 'outer' ? 2.7 : edge.kind === 'tracked' ? 1.1 : .75, edge.kind === 'outer' ? 3.4 : edge.kind === 'tracked' ? 1.6 : .95, edge.kind === 'outer' ? 'primary' : edge.kind === 'tracked' ? 'layer' : 'joint');
    for (let rib = 0; rib < 7; rib++) {
      const w = -.80 + rib * .28, corners: V4[] = [[-1, -1, 1, w], [1, -1, 1, w], [1, 1, 1, w], [-1, 1, 1, w]];
      for (let i = 0; i < 4; i++) sourceEdge(corners[i], corners[(i + 1) % 4], .75, 1.3, 'layer');
    }
    sourceEdge([-.98, .96, .99, -1], [-.68, .96, .99, -1], .025, .035, 'light');
  }
  return beams;
}
export function cavityWorldCounts() {
  const counts = { primary: 0, layer: 0, joint: 0, light: 0 };
  for (const beam of cavityWorldBeams([0, 0, 0])) counts[beam.kind]++;
  return counts;
}
