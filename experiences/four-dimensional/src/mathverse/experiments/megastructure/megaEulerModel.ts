import { minimumJerk } from '../../config/motion.ts';
import { HYPER_EDGES, HYPER_VERTICES, rotateXW, type V3, type V4 } from '../inversion/inversionModel.ts';
import { createField, projectVertexInto, type Assembly, type BeamKind, type FoldPhase, type Point4 } from '../layered/spaceModel.ts';

export const MEGA_EULER = { center: [-32, 5, -44] as V3, scale: 12, lens: 1.9,
  firstHold: 32, stable: 80, anticipation: 6, rotation: 30, settle: 8, owner: 0 } as const;
export const MEGA_EULER_IDS = ['unit-circle', 'complex-rotation', 'euler-identity', 'leonhard-euler'] as const;

// The same source projection drives the figure, structural ribs and corner joints.
// No secondary scaling or camera-facing transform is applied to the world.
export function megaEulerPoint(_section: number, source: V4, angle: number, output: V3 = [0, 0, 0]): V3 {
  const p = rotateXW(source, angle), s = MEGA_EULER.scale * MEGA_EULER.lens / (MEGA_EULER.lens - p[3]);
  output[0] = MEGA_EULER.center[0] + p[0] * s;
  output[1] = MEGA_EULER.center[1] + p[1] * s;
  output[2] = MEGA_EULER.center[2] + p[2] * s;
  return output;
}

export function createEulerAssembly(): Assembly {
  const assembly: Assembly = { id: 'euler-fold-0', section: 0, moving: true, anchor: MEGA_EULER.center, vertices: [], beams: [] };
  const ids = new Map<string, number>();
  const vertex = (p: Point4) => { const key = p.join(','); if (!ids.has(key)) { ids.set(key, assembly.vertices.length); assembly.vertices.push(p); } return ids.get(key)!; };
  const edge = (a: Point4, b: Point4, width: number, depth: number, kind: BeamKind) => assembly.beams.push({ a: vertex(a), b: vertex(b), width, depth, kind });
  for (const e of HYPER_EDGES) edge(HYPER_VERTICES[e.a], HYPER_VERTICES[e.b], e.axis === 3 ? .22 : e.kind === 'tracked' ? .18 : .70, e.axis === 3 ? .24 : e.kind === 'tracked' ? .30 : .82, e.axis === 3 ? 'joint' : 'primary');
  // Layered architectural density stays at the perimeter. Leave the facing
  // plane open, without a grid of bars through the mathematical silhouette.
  let previous: Point4[] | null = null;
  for (let i = 0; i < 12; i++) {
    const z = -1 + i * 2 / 11;
    const points: Point4[] = [[-1, -1, z, 1], [-1, 1, z, 1], [1, 1, z, 1], [1, -1, z, 1]];
    edge(points[0], points[1], .30, .56, 'layer');
    edge(points[1], points[2], .30, .56, 'layer');
    // The right face is a broad opening onto the travel route.
    if (previous) for (let j = 0; j < 3; j++) edge(previous[j], points[j], .17, .20, 'joint');
    previous = points;
  }
  // Fixed socket endpoints belong to existing A beams. Sentinel w=99 means a
  // world-space attachment, not a fabricated 4D coordinate or extra projection.
  const sockets: V3[] = [[-40, 26.05, -48], [-32, -14.45, -48], [-6.5, 29.55, -48], [-6.5, -23.45, -48]];
  const corners: V4[] = [[-1, 1, -1, -1], [-1, -1, -1, -1], [1, 1, -1, -1], [1, -1, -1, -1]];
  sockets.forEach((socket, i) => edge([...socket, 99], corners[i], .22, .26, 'joint'));
  return assembly;
}

export function createMegaEulerField(first: number): Assembly[] {
  return createField(first).map(a => {
    if (a.id === 'fold-0') return createEulerAssembly();
    // Widen the adjacent host opening at layout time. Keep real beams and
    // joints continuous, rather than fading a foreground column on demand.
    if (a.id === 'spine-0') {
      a.vertices = a.vertices.map(p => p[0] === -15.5 && p[2] === -24 ? [-6.5, p[1], p[2], p[3]] : p);
      a.beams = a.beams.filter(b => b.kind !== 'light');
    }
    // The next bay shares this boundary. Move its coincident endpoints too;
    // the longitudinal upper beam then leads back into the untouched field.
    if (a.id === 'spine-1') a.vertices = a.vertices.map(p => p[0] === -15.5 && p[2] === 24 ? [-6.5, p[1], p[2], p[3]] : p);
    if (a.id === 'cross-0') a.vertices = a.vertices.map(p => p[0] === -24 ? [-14, p[1], p[2], p[3]] : p);
    return a;
  });
}
export function projectMegaAssembly(assembly: Assembly, point: Point4, angle: number, out: V3): V3 {
  if (assembly.id !== 'euler-fold-0') return projectVertexInto(point, angle, assembly.anchor, out);
  if (point[3] === 99) { out[0] = point[0]; out[1] = point[1]; out[2] = point[2]; return out; }
  return megaEulerPoint(0, [...point], angle, out);
}

export class MegaEulerController {
  private lastVisibleZ: number;
  constructor(lastVisibleZ = -90) { this.lastVisibleZ = lastVisibleZ; }
  clock = 0; elapsed = 0; hold = 0; events = 0; section: number | null = null;
  phase: FoldPhase = 'stable'; from = 0; to = Math.PI;
  private value = 0; private manual = false;
  angle(section: number) { return section === 0 ? this.value : 0; }
  trigger(_cameraZ: number, reduced = false) {
    if (this.phase !== 'stable') return false;
    this.section = 0; this.from = this.value; this.to = this.value > Math.PI / 2 ? 0 : Math.PI;
    this.elapsed = this.hold = 0; this.events++;
    if (reduced) this.value = this.to; else this.phase = 'anticipation';
    return true;
  }
  // Fixed review poses are deliberately isolated from the default live route.
  review(angle: number) { this.value = angle; this.manual = true; this.section = 0; this.phase = 'stable'; }
  advance(dt: number, cameraZ: number, frozen: boolean, reduced: boolean) {
    if (frozen || reduced || this.manual || !Number.isFinite(dt) || dt <= 0) return;
    this.clock += dt;
    if (this.phase === 'stable') {
      this.hold += dt;
      // One finite Euler landmark; after it passes, the inherited giant field
      // continues recycling without replaying an invisible distant event.
      if (cameraZ > this.lastVisibleZ && this.hold >= (this.events ? MEGA_EULER.stable : MEGA_EULER.firstHold)) this.trigger(cameraZ);
      return;
    }
    this.elapsed += dt;
    const pre = MEGA_EULER.anticipation, end = pre + MEGA_EULER.rotation;
    let t = 1;
    if (this.elapsed < pre) { this.phase = 'anticipation'; t = .035 * minimumJerk(this.elapsed / pre); }
    else if (this.elapsed < end) { this.phase = 'folding'; t = .035 + .965 * minimumJerk((this.elapsed - pre) / MEGA_EULER.rotation); }
    else this.phase = 'settling';
    this.value = this.from + (this.to - this.from) * t;
    if (this.elapsed >= end + MEGA_EULER.settle) { this.phase = 'stable'; this.hold = 0; }
  }
  retain(_first: number) {}
  snapshot() { return { clock: this.clock, phase: this.phase, section: this.section, elapsed: this.elapsed,
    from: this.from, to: this.to, angle: this.value, events: this.events, states: 1, stableTime: this.hold,
    stableDuration: MEGA_EULER.stable, eventDuration: 44, maximumMovingUnits: 1, manual: this.manual,
    trackedPosition: this.value < .001 ? 'inside' : this.value > Math.PI - .001 ? 'outside' : 'unfolding' }; }
}
