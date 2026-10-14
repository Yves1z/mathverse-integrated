import { Path, Shape } from 'three';

export const ARCH = { radius: 0.65, height: 2.76, outerRadius: 0.775, outerHeight: 2.885 } as const;

export function archPath<T extends Path>(path: T, radius: number, height: number, bottom = 0): T {
  path.moveTo(-radius, bottom);
  path.lineTo(radius, bottom);
  path.lineTo(radius, height - radius);
  path.absarc(0, height - radius, radius, 0, Math.PI, false);
  path.lineTo(-radius, bottom);
  path.closePath();
  return path;
}

export function archShape(radius: number, height: number, bottom = 0): Shape {
  return archPath(new Shape(), radius, height, bottom);
}

export function archFrameShape(): Shape {
  const shape = archShape(ARCH.outerRadius, ARCH.outerHeight, -0.006);
  // The aperture must be contained by the outer contour for valid triangulation.
  shape.holes.push(archShape(ARCH.radius, ARCH.height, 0));
  return shape;
}

export function archRing(radius: number, height: number, width: number, bottom = 0): Shape {
  const shape = archShape(radius, height, bottom);
  shape.holes.push(archPath(new Path(), radius - width, height - width, bottom + width));
  return shape;
}
