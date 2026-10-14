import { minimumJerk } from '../config/motion.ts';

export type V4 = [number, number, number, number];
export type V3 = [number, number, number];
export const INVERSION = {
  lens: 1.9, scale: 32, center: [0, 1.55, -67] as V3,
  firstHold: 14, anticipation: 6, rotation: 30, settle: 8, subsequentHold: 76,
  cameraStart: -4, cameraLimit: -25, baseSpeedScale: .4,
} as const;
export const HYPER_VERTICES: V4[] = Array.from({ length: 16 }, (_, id) => [0, 1, 2, 3].map(axis => (id >> axis & 1) ? 1 : -1) as V4);
export const HYPER_EDGES = HYPER_VERTICES.flatMap((_, a) => [0, 1, 2, 3].flatMap(axis => {
  const b = a ^ 1 << axis;
  return a < b ? [{ a, b, axis, kind: axis === 3 ? 'bridge' : (a & 8) ? 'outer' : 'tracked' }] : [];
}));
export const HYPER_CELLS = [0, 1, 2, 3].flatMap(axis => [-1, 1].map(side => ({ axis, side,
  vertices: HYPER_VERTICES.flatMap((v, id) => v[axis] === side ? [id] : []) })));
export function rotateXW(point: V4, angle: number): V4 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [point[0] * c - point[3] * s, point[1], point[2], point[0] * s + point[3] * c];
}
export function projectHyper(point: V4, angle: number, output: V3 = [0, 0, 0]): V3 {
  const p = rotateXW(point, angle), scale = INVERSION.scale * INVERSION.lens / (INVERSION.lens - p[3]);
  output[0] = INVERSION.center[0] + p[0] * scale; output[1] = INVERSION.center[1] + p[1] * scale; output[2] = INVERSION.center[2] + p[2] * scale;
  return output;
}
export type InversionPhase = 'stable' | 'anticipation' | 'rotation' | 'settling';
export class InversionController {
  clock = 0; angle = 0; phase: InversionPhase = 'stable'; elapsed = 0; hold = 0; events = 0;
  from = 0; to = Math.PI; automatic = true; private duration: number = INVERSION.rotation;
  private direct = false;
  begin(immediate = false) {
    if (this.phase !== 'stable') return false;
    this.start(this.angle > Math.PI / 2 ? 0 : Math.PI, immediate, false); return true;
  }
  seek(angle: number, immediate = false) {
    this.automatic = false; this.start(Math.max(0, Math.min(Math.PI, angle)), immediate, true);
  }
  private start(angle: number, immediate: boolean, direct: boolean) {
    this.from = this.angle; this.to = angle; this.elapsed = this.hold = 0; this.events++; this.direct = direct;
    this.duration = direct ? Math.max(2.4, Math.abs(angle - this.angle) / Math.PI * 16) : INVERSION.rotation;
    if (immediate || Math.abs(angle - this.angle) < 1e-9) { this.angle = angle; this.phase = 'stable'; return; }
    this.phase = direct ? 'rotation' : 'anticipation';
  }
  advance(dt: number, frozen: boolean, reduced: boolean) {
    if (frozen || reduced || !Number.isFinite(dt) || dt <= 0) return;
    this.clock += dt;
    if (this.phase === 'stable') {
      this.hold += dt;
      if (this.automatic && this.hold >= (this.events ? INVERSION.subsequentHold : INVERSION.firstHold)) this.begin();
      return;
    }
    this.elapsed += dt; const pre = this.direct ? 0 : INVERSION.anticipation, rotationEnd = pre + this.duration;
    let progress: number;
    if (this.elapsed < pre) { this.phase = 'anticipation'; progress = .035 * minimumJerk(this.elapsed / pre); }
    else if (this.elapsed < rotationEnd) { this.phase = 'rotation'; progress = this.direct ? minimumJerk((this.elapsed - pre) / this.duration) : .035 + .965 * minimumJerk((this.elapsed - pre) / this.duration); }
    else { this.phase = 'settling'; progress = 1; }
    this.angle = this.from + (this.to - this.from) * progress;
    if (this.elapsed >= rotationEnd + (this.direct ? 0 : INVERSION.settle)) { this.phase = 'stable'; this.hold = 0; }
  }
  snapshot() { return { clock: this.clock, angle: this.angle, phase: this.phase, elapsed: this.elapsed, from: this.from, to: this.to,
    events: this.events, automatic: this.automatic, hold: this.hold, progress: this.angle / Math.PI,
    trackedPosition: this.angle < .001 ? 'inside' : this.angle > Math.PI - .001 ? 'outside' : 'unfolding' }; }
}

// Distance between finite segments: the interior stationary point plus all four
// boundary minima. The finite camera interval must not be replaced by an infinite ray.
export function segmentDistance(a: V3, b: V3, c: V3, d: V3) {
  const sub = (p: V3, q: V3) => p.map((v, i) => v - q[i]) as V3;
  const dot = (p: V3, q: V3) => p.reduce((v, x, i) => v + x * q[i], 0);
  const u = sub(b, a), v = sub(d, c), w = sub(a, c), uu = dot(u, u), vv = dot(v, v), uv = dot(u, v), uw = dot(u, w), vw = dot(v, w);
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const distance = (s: number, t: number) => Math.hypot(...w.map((x, i) => x + s * u[i] - t * v[i]));
  const candidates = [distance(0, clamp(vw / vv)), distance(1, clamp((vw + uv) / vv)), distance(clamp(-uw / uu), 0), distance(clamp((uv - uw) / uu), 1)];
  const den = uu * vv - uv * uv;
  if (den > 1e-12) { const s = (uv * vw - vv * uw) / den, t = (uu * vw - uv * uw) / den; if (s >= 0 && s <= 1 && t >= 0 && t <= 1) candidates.push(distance(s, t)); }
  return Math.min(...candidates);
}
