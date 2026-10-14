import type { NodePlacement } from '../content/layout';
import { projectVertex, SPACE_A, type Point3, type Point4 } from './spaceModel.ts';

export type SpaceMount = { id: string; section: number; surface: 'fold' | 'right' | 'crown'; layer: number; center: Point3; width: number; height: number; range: number };
export const SPACE_MOUNTS: readonly SpaceMount[] = [
  { id: 'euler-identity', section: 1, surface: 'fold', layer: 5, center: [-11.5, 12.5, 0], width: 10, height: 12, range: 105 },
  { id: 'unit-circle', section: 0, surface: 'fold', layer: 7, center: [3, -5, 0], width: 10, height: 12, range: 90 },
  { id: 'complex-rotation', section: 0, surface: 'fold', layer: 9, center: [3, 12.5, 0], width: 10, height: 12, range: 90 },
  { id: 'leonhard-euler', section: 0, surface: 'right', layer: 3, center: [0, 3, -6.5], width: 8, height: 10.5, range: 95 },
  { id: 'gaussian-integral', section: 1, surface: 'right', layer: 4, center: [0, -3, -2.5], width: 8, height: 10, range: 100 },
  { id: 'mobius-strip', section: 1, surface: 'crown', layer: 2, center: [-16.5, 0, -9], width: 11, height: 10, range: 110 },
];

export function mountPoint(mount: SpaceMount, section: number, angle: number, point: readonly number[], forward = 0): Point3 {
  const z = -24 - section * SPACE_A.bayLength;
  if (mount.surface === 'fold') {
    const depth = 18 - mount.layer * 1.15, w = (mount.layer - 5.5) * .9;
    return projectVertex([point[0], point[1], depth + forward, w] as Point4, angle, [-24, 1.55, z]);
  }
  if (mount.surface === 'right') return [20 + mount.layer * 1.15 - forward, 1.55 + point[1], z + point[2]];
  return [point[0], 1.55 + 20.5 + mount.layer * 1.35 - forward, z + point[2]];
}

export function mountPose(mount: SpaceMount, section: number, angle: number) {
  const position = mountPoint(mount, section, angle, mount.center, .8);
  if (mount.surface !== 'fold') return { position, rotation: mount.surface === 'right' ? [0, -Math.PI / 2, 0] as Point3 : [Math.PI / 2, 0, 0] as Point3,
    scale: [mount.width / 6.2, mount.height / 4, 1] as Point3 };
  const a = mountPoint(mount, section, angle, [mount.center[0] - 1, mount.center[1], 0], .8);
  const b = mountPoint(mount, section, angle, [mount.center[0] + 1, mount.center[1], 0], .8);
  const xScale = Math.hypot(b[0] - a[0], b[2] - a[2]) / 2;
  const w = mount.center[0] * Math.sin(angle) + (mount.layer - 5.5) * .9 * Math.cos(angle);
  const yScale = SPACE_A.projectionDistance / (SPACE_A.projectionDistance - w);
  return { position, rotation: [0, -Math.atan2(b[2] - a[2], b[0] - a[0]), 0] as Point3,
    scale: [mount.width / 6.2 * xScale, mount.height / 4 * yScale, yScale] as Point3 };
}

export function spaceContentLayout(): NodePlacement[] {
  return SPACE_MOUNTS.map(mount => ({ id: mount.id, anchor: { chunkId: 0, localPosition: mountPose(mount, mount.section, 0).position },
    orientation: mountPose(mount, mount.section, 0).rotation, scale: 1, discoveryRange: mount.range }));
}

export function mountSupports(mount: SpaceMount): Point3[] {
  if (mount.surface === 'fold') return [[mount.center[0] - mount.width * .35, mount.center[1] > 4 ? 21 : 4, 0], [mount.center[0] + mount.width * .35, mount.center[1] > 4 ? 21 : 4, 0]];
  if (mount.surface === 'right') return [[0, 12, mount.center[2] - mount.width * .35], [0, 12, mount.center[2] + mount.width * .35]];
  return [[mount.center[0] - mount.width * .35, 0, mount.center[2] + 8], [mount.center[0] + mount.width * .35, 0, mount.center[2] + 8]];
}
