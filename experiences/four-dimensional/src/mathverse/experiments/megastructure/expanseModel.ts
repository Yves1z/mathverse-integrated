import type { V3, V4 } from '../inversion/inversionModel.ts';
import { MEGA_EULER, createMegaEulerField, megaEulerPoint, projectMegaAssembly } from './megaEulerModel.ts';
import type { Assembly, Point4 } from '../layered/spaceModel.ts';

export const EXPANSE = { pitch: 216, far: 1500, fog: .0024, center: [-128, 14, -190] as V3, worldScale: 2.2 } as const;

// Expand the architectural layout, rather than scaling the camera and scene
// together. Horizontal openings grow more than the beam cross sections.
export function openHostPoint(p: readonly number[], out: V3 = [0, 0, 0]): V3 {
  out[0] = p[0] * 3.3 + Math.sign(p[0]) * 50;
  out[1] = 1.55 + (p[1] - 1.55) * 4.2;
  out[2] = p[2] * 4.5;
  return out;
}

// The mathematical source remains isotropic; its cell and figures share this
// exact projection, independently of the surrounding architectural layout.
export function expanseEulerPoint(section: number, source: V4, angle: number, out: V3 = [0, 0, 0]): V3 {
  megaEulerPoint(section, source, angle, out);
  for (let i = 0; i < 3; i++) out[i] = EXPANSE.center[i] + (out[i] - MEGA_EULER.center[i]) * EXPANSE.worldScale;
  return out;
}

export function createExpanseField(first: number): Assembly[] {
  const field = createMegaEulerField(first).map(a => ({ ...a, beams: a.beams.map(b => {
    const scale = a.id === 'euler-fold-0' ? 1.5 : b.kind === 'primary' ? 2.4 : b.kind === 'layer' ? 1.45 : 1.4;
    return { ...b, width: b.width * scale, depth: b.depth * scale };
  }) }));
  // Adjacent stories and lateral banks share the same spatial rhythm. They
  // extend beyond the central route, with no independently animated clutter.
  const tiers: Assembly[] = [];
  for (const offset of [[0, 280, 0], [0, -280, 0], [-430, 140, -108], [430, 140, -108]]) {
    for (const a of field) {
      if (a.id === 'euler-fold-0' || !/^(spine|crown|cross)-/.test(a.id)) continue;
      tiers.push({ ...a, id: `expanse-tier-${offset.join(':')}-${a.id}`, moving: false,
        vertices: a.vertices.map(p => {
          const v = projectExpanseAssembly(a, p, 0, [0, 0, 0]);
          return [v[0] + offset[0], v[1] + offset[1], v[2] + offset[2], 99] as Point4;
        }) });
    }
  }
  return [...field, ...tiers];
}

export function projectExpanseAssembly(a: Assembly, source: Point4, angle: number, out: V3): V3 {
  if (a.id.startsWith('expanse-tier-')) { out[0] = source[0]; out[1] = source[1]; out[2] = source[2]; return out; }
  if (a.id === 'euler-fold-0') return source[3] === 99 ? openHostPoint(source, out) : expanseEulerPoint(0, [...source], angle, out);
  projectMegaAssembly(a, source, angle, out);
  return openHostPoint(out, out);
}
