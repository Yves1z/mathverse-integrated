import { minimumJerk } from '../config/motion.ts';

export const SPACE_A = {
  bayLength: 48, bayCount: 7, baysBehind: 2, projectionDistance: 28,
  foldedAngle: .52, stableDuration: 72, anticipationDuration: 8,
  foldDuration: 24, settleDuration: 10, clearance: 3.2,
} as const;

export type Point4 = readonly [number, number, number, number];
export type Point3 = [number, number, number];
export type BeamKind = 'primary' | 'layer' | 'joint' | 'light';
export type Beam = { a: number; b: number; width: number; depth: number; kind: BeamKind };
export type Assembly = { id: string; section: number; moving: boolean; anchor: Point3; vertices: Point4[]; beams: Beam[] };
export type FoldPhase = 'stable' | 'anticipation' | 'folding' | 'settling';

export function projectVertex(point: Point4, angle: number, anchor: Point3): Point3 {
  return projectVertexInto(point, angle, anchor, [0, 0, 0]);
}

export function projectVertexInto(point: Point4, angle: number, anchor: Point3, output: Point3): Point3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  const x = point[0] * c - point[3] * s, w = point[0] * s + point[3] * c;
  const scale = SPACE_A.projectionDistance / (SPACE_A.projectionDistance - w);
  output[0] = anchor[0] + x * scale; output[1] = anchor[1] + point[1] * scale; output[2] = anchor[2] + point[2] * scale;
  return output;
}

function builder(id: string, section: number, anchor: Point3, moving = false) {
  const assembly: Assembly = { id, section, anchor, moving, vertices: [], beams: [] };
  const ids = new Map<string, number>();
  const vertex = (point: Point4) => {
    const key = point.join(',');
    let index = ids.get(key);
    if (index === undefined) { index = assembly.vertices.length; ids.set(key, index); assembly.vertices.push(point); }
    return index;
  };
  const edge = (a: Point4, b: Point4, width: number, depth: number, kind: BeamKind) => {
    assembly.beams.push({ a: vertex(a), b: vertex(b), width, depth, kind });
  };
  const loop = (points: Point4[], width: number, depth: number, kind: BeamKind = 'layer') => {
    points.forEach((point, i) => edge(point, points[(i + 1) % points.length], width, depth, kind));
  };
  return { assembly, edge, loop };
}

export function createBay(section: number): Assembly[] {
  const z = -24 - section * SPACE_A.bayLength, eye = 1.55;
  const left = builder(`fold-${section}`, section, [-24, eye, z], true);
  let previous: Point4[] | null = null;
  for (let i = 0; i < 12; i++) {
    const depth = 18 - i * 1.15, w = (i - 5.5) * .9;
    const points: Point4[] = [[-20, -14, depth, w], [-20, 21, depth, w], [11, 21, depth, w], [11, -14, depth, w]];
    left.loop([points[0], [-20, 4, depth, w], points[1], [-5, 21, depth, w],
      points[2], [11, 4, depth, w], points[3], [-5, -14, depth, w]], .64, 1.1);
    left.edge([-20, 4, depth, w], [-5, 4, depth, w], .5, .85, 'layer');
    left.edge([-5, 4, depth, w], [11, 4, depth, w], .5, .85, 'layer');
    left.edge([-5, -14, depth, w], [-5, 4, depth, w], .5, .85, 'layer');
    left.edge([-5, 4, depth, w], [-5, 21, depth, w], .5, .85, 'layer');
    if (previous) points.forEach((point, j) => left.edge(previous![j], point, .26, .26, 'joint'));
    previous = points;
  }

  const right = builder(`right-${section}`, section, [0, eye, z]);
  previous = null;
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 1.15;
    const offset = section % 2 === 0 ? -13 : 4;
    const points: Point4[] = [[x, -18, -13 + offset, 0], [x, 12, -13 + offset, 0], [x, 12, 13 + offset, 0], [x, -18, 13 + offset, 0]];
    right.loop(points, .62, 1.15);
    right.edge([x, -18, offset, 0], [x, 12, offset, 0], .48, .8, 'layer');
    if (previous) points.forEach((point, j) => right.edge(previous![j], point, .28, .28, 'joint'));
    previous = points;
  }

  const crown = builder(`crown-${section}`, section, [0, eye, z]);
  previous = null;
  for (let i = 0; i < 8; i++) {
    const y = 20.5 + i * 1.35, offset = section % 2 === 0 ? 9 : -9;
    const points: Point4[] = [[-36, y, -8 + offset, 0], [40, y, -8 + offset, 0], [40, y, 8 + offset, 0], [-36, y, 8 + offset, 0]];
    crown.loop(points, .75, 1.25);
    crown.edge([3, y, -8 + offset, 0], [3, y, 8 + offset, 0], .6, 1, 'layer');
    if (previous) points.forEach((point, j) => crown.edge(previous![j], point, .3, .3, 'joint'));
    previous = points;
  }

  const spine = builder(`spine-${section}`, section, [0, eye, z]);
  for (const depth of [-24, 24]) {
    spine.edge([-15.5, -25, depth, 0], [-15.5, 28, depth, 0], 2.2, 2.8, 'primary');
    spine.edge([23.5, -27, depth, 0], [23.5, 28, depth, 0], 2.0, 2.8, 'primary');
    spine.edge([-40, 24.5, depth, 0], [44, 24.5, depth, 0], 2, 3.2, 'primary');
    spine.edge([-32, -16, depth, 0], [29, -16, depth, 0], 1, 1.8, 'primary');
  }
  spine.edge([-15.5, 28, -24, 0], [-15.5, 28, 24, 0], 1.5, 1.5, 'primary');
  spine.edge([23.5, -27, -24, 0], [23.5, -27, 24, 0], 1.5, 1.5, 'primary');
  // Quiet light surfaces sit deep behind the ribs. They are not emissive outlines.
  spine.edge([-27, 4, -9, 0], [-27, 4, -3, 0], .04, .16, 'light');
  const distant = builder(`cross-${section}`, section, [section % 2 === 0 ? 8 : -8, eye, z]);
  previous = null;
  for (let i = 0; i < 5; i++) {
    const depth = -12 - i * 1.9;
    const points: Point4[] = [[-24, -20, depth, 0], [-24, 30, depth, 0], [40, 30, depth, 0], [40, -20, depth, 0]];
    distant.loop(points, 1.15, 1.6);
    distant.edge([14, -20, depth, 0], [14, 30, depth, 0], .85, 1.35, 'layer');
    distant.edge([-24, 12, depth, 0], [40, 12, depth, 0], .85, 1.35, 'layer');
    if (previous) points.forEach((point, j) => distant.edge(previous![j], point, .35, .35, 'joint'));
    previous = points;
  }
  return [left.assembly, right.assembly, crown.assembly, spine.assembly, distant.assembly];
}

export function createField(firstSection: number): Assembly[] {
  return Array.from({ length: SPACE_A.bayCount }, (_, i) => createBay(firstSection + i)).flat();
}

export class FoldController {
  clock = 0;
  stableTime = 0;
  phase: FoldPhase = 'stable';
  section: number | null = null;
  elapsed = 0;
  from = 0;
  to = SPACE_A.foldedAngle as number;
  events = 0;
  private angles = new Map<number, number>();

  angle(section: number) { return this.angles.get(section) ?? 0; }

  trigger(cameraZ: number, reduced = false): boolean {
    if (this.phase !== 'stable') return false;
    this.section = Math.max(0, Math.round((-cameraZ - 16) / SPACE_A.bayLength));
    this.from = this.angle(this.section);
    this.to = this.from > SPACE_A.foldedAngle * .5 ? 0 : SPACE_A.foldedAngle;
    this.elapsed = 0; this.stableTime = 0; this.events++;
    if (reduced) { this.angles.set(this.section, this.to); return true; }
    this.phase = 'anticipation';
    return true;
  }

  advance(dt: number, cameraZ: number, frozen: boolean, reduced: boolean) {
    if (frozen || reduced || dt <= 0 || !Number.isFinite(dt)) return;
    this.clock += dt;
    if (this.phase === 'stable') {
      this.stableTime += dt;
      if (this.stableTime >= SPACE_A.stableDuration) this.trigger(cameraZ);
      return;
    }
    this.elapsed += dt;
    const a = SPACE_A.anticipationDuration, b = a + SPACE_A.foldDuration, c = b + SPACE_A.settleDuration;
    let progress: number;
    if (this.elapsed < a) { this.phase = 'anticipation'; progress = .035 * minimumJerk(this.elapsed / a); }
    else if (this.elapsed < b) { this.phase = 'folding'; progress = .035 + .965 * minimumJerk((this.elapsed - a) / SPACE_A.foldDuration); }
    else { this.phase = 'settling'; progress = 1; }
    this.angles.set(this.section!, this.from + (this.to - this.from) * progress);
    if (this.elapsed >= c) { this.phase = 'stable'; this.stableTime = 0; }
  }

  retain(first: number) {
    for (const key of this.angles.keys()) if (key < first || key >= first + SPACE_A.bayCount) this.angles.delete(key);
  }

  snapshot() {
    return { clock: this.clock, phase: this.phase, section: this.section, elapsed: this.elapsed,
      angle: this.section === null ? 0 : this.angle(this.section), events: this.events,
      states: this.angles.size, stableTime: this.stableTime };
  }
}

export function beamRouteClearance(a: Point3, b: Point3, radius: number): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, -(a[0] * dx + (a[1] - 1.55) * dy) / lengthSquared)) : 0;
  return Math.hypot(a[0] + t * dx, a[1] - 1.55 + t * dy) - radius;
}
