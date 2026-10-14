import { minimumJerk } from '../../config/motion.ts';
import { HYPER_VERTICES, INVERSION, rotateXW, type V3, type V4 } from './inversionModel.ts';
import type { NodePlacement } from '../../content/layout';

export const ORDERED = { scale: 16, side: 72, origin: -100, pitch: 108, count: 6, behind: 3,
  firstHold: 20, stable: 60, anticipation: 6, rotation: 30, settle: 8 } as const;
export function sectionSide(section: number) { return ((section % 2) + 2) % 2 ? 1 : -1; }
export function nearestSection(cameraZ: number) { return Math.floor((ORDERED.origin - cameraZ) / ORDERED.pitch) + 1; }
export function fieldPoint(section: number, source: V4, angle: number, output: V3 = [0, 0, 0]): V3 {
  const p = rotateXW(source, angle), scale = ORDERED.scale * INVERSION.lens / (INVERSION.lens - p[3]), side = sectionSide(section);
  // Turn each unchanged model's front toward the central corridor.
  output[0] = side * (ORDERED.side - p[2] * scale); output[1] = 1.55 + p[1] * scale;
  output[2] = ORDERED.origin - section * ORDERED.pitch + side * p[0] * scale;
  return output;
}
export type SpaceProjection = typeof fieldPoint;
export class OrderedController {
  private selectSection: (cameraZ: number, events: number) => number;
  private sequence: string;
  constructor(selectSection: (cameraZ: number, events: number) => number = (z, events) => nearestSection(z) + events % 2, sequence = 'near-next-near-return-next-return') { this.selectSection = selectSection; this.sequence = sequence; }
  clock = 0; hold = 0; elapsed = 0; events = 0; phase: 'stable' | 'anticipation' | 'rotation' | 'settling' = 'stable';
  section: number | null = null; from = 0; to = Math.PI; private angles = new Map<number, number>();
  angle(section: number) { return this.angles.get(section) ?? 0; }
  trigger(cameraZ: number, immediate = false) {
    if (this.phase !== 'stable') return false;
    // A deterministic four-beat sequence: near, next, near-return, next-return.
    this.section = this.selectSection(cameraZ, this.events); this.from = this.angle(this.section); this.to = this.from > Math.PI / 2 ? 0 : Math.PI;
    this.elapsed = this.hold = 0; this.events++;
    if (immediate) this.angles.set(this.section, this.to); else this.phase = 'anticipation'; return true;
  }
  advance(dt: number, cameraZ: number, frozen: boolean, reduced: boolean) {
    if (frozen || reduced || dt <= 0 || !Number.isFinite(dt)) return;
    this.clock += dt;
    if (this.phase === 'stable') { this.hold += dt; if (this.hold >= (this.events ? ORDERED.stable : ORDERED.firstHold)) this.trigger(cameraZ); return; }
    this.elapsed += dt; const pre = ORDERED.anticipation, end = pre + ORDERED.rotation;
    let t = 1;
    if (this.elapsed < pre) { this.phase = 'anticipation'; t = .035 * minimumJerk(this.elapsed / pre); }
    else if (this.elapsed < end) { this.phase = 'rotation'; t = .035 + .965 * minimumJerk((this.elapsed - pre) / ORDERED.rotation); }
    else this.phase = 'settling';
    this.angles.set(this.section!, this.from + (this.to - this.from) * t);
    if (this.elapsed >= end + ORDERED.settle) { this.phase = 'stable'; this.hold = 0; }
  }
  retain(first: number) { for (const id of this.angles.keys()) if ((id < first - 1 || id >= first + ORDERED.count + 1) && id !== this.section) this.angles.delete(id); }
  snapshot() { return { clock: this.clock, hold: this.hold, elapsed: this.elapsed, events: this.events, phase: this.phase, section: this.section,
    angle: this.section === null ? 0 : this.angle(this.section), angles: Object.fromEntries(this.angles),
    movingUnits: this.phase === 'anticipation' || this.phase === 'rotation' ? 1 : 0, maximumMovingUnits: 1,
    sequence: this.sequence, stableDuration: ORDERED.stable, eventDuration: ORDERED.anticipation + ORDERED.rotation + ORDERED.settle }; }
}
export type OrderedMount = { id: string; section: number; center: V4; width: number; height: number; range: number };
export const ORDERED_MOUNTS: OrderedMount[] = [
  { id: 'euler-identity', section: 0, center: [0, .4, 1, -1], width: 1.05, height: .55, range: 250 },
  { id: 'unit-circle', section: 0, center: [-.48, -.4, 1, -1], width: .72, height: .62, range: 250 },
  { id: 'complex-rotation', section: 0, center: [.48, -.4, 1, -1], width: .72, height: .62, range: 250 },
  { id: 'leonhard-euler', section: 1, center: [0, .4, 1, -1], width: 1.05, height: .55, range: 320 },
  { id: 'gaussian-integral', section: 1, center: [-.48, -.4, 1, -1], width: .72, height: .62, range: 320 },
  { id: 'mobius-strip', section: 1, center: [.48, -.4, 1, -1], width: .72, height: .62, range: 320 },
];
export function windowPose(mount: OrderedMount, section: number, angle: number, project: SpaceProjection = fieldPoint) {
  const position = project(section, mount.center, angle);
  const source = [...mount.center] as V4; source[0] += .0001; const x = project(section, source, angle);
  source[0] = mount.center[0]; source[1] += .0001; const y = project(section, source, angle);
  const dx = x[0] - position[0], dz = x[2] - position[2], length = Math.hypot(dx, dz), sign = dz * sectionSide(section) >= 0 ? 1 : -1;
  // Face the fixed corridor side, not the changing camera direction. Fade at grazing.
  const rotation: V3 = [0, -Math.atan2(dz * sign, dx * sign), 0];
  return { position, rotation, scale: [length / .0001 * mount.width / 6.2, (y[1] - position[1]) / .0001 * mount.height / 4, 1] as V3,
    facing: project === fieldPoint ? Math.abs(dz) / length : 1, basisSign: sign, source: [...mount.center] };
}
export function windowSupports(mount: OrderedMount, section: number, angle: number): V3[] {
  const direction = windowPose(mount, section, angle).basisSign;
  return [-1, 1].map(sign => fieldPoint(section, [mount.center[0] + sign * direction * mount.width * .35, 1, 1, -1], angle));
}
export function orderedLayout(project: SpaceProjection = fieldPoint): NodePlacement[] {
  return ORDERED_MOUNTS.map(m => ({ id: m.id, anchor: { chunkId: 0, localPosition: windowPose(m, m.section, 0, project).position },
    orientation: windowPose(m, m.section, 0, project).rotation, scale: 1, discoveryRange: m.range }));
}
export const BRIDGE_VERTICES = [8, 14] as const;
export function modelPoints(section: number, angle: number) { return HYPER_VERTICES.map(v => fieldPoint(section, v, angle)); }
