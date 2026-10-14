import type { SourceMesh } from './cellFigureModel';
import type { SpaceProjection } from '../../experiments/inversion/orderedModel';
import type { V3 } from '../../experiments/inversion/inversionModel';

export const EULER_TRACE = { center: [.58, -.54, .43] as V3, width: .34, height: .44, pages: 3, columns: 6, rows: 8 } as const;

// A fixed contemporary paper composition, entirely inside the same w=-1 source cell.
// Gentle curvature is part of the source geometry, never an independent animation.
export function tracePoint(page: number, u: number, v: number): V3 {
  const x = u * EULER_TRACE.width, y = v * EULER_TRACE.height;
  return [EULER_TRACE.center[0] + x * Math.cos(-.12) - y * Math.sin(-.12) + page * .025,
    EULER_TRACE.center[1] + x * Math.sin(-.12) + y * Math.cos(-.12) + page * .025,
    EULER_TRACE.center[2] - page * .023 + .014 * (1 - 4 * u * u)];
}
export function tracePage(page: number): SourceMesh & { uvs: Float32Array } {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  const { columns, rows } = EULER_TRACE;
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
    positions.push(...tracePoint(page, x / columns - .5, y / rows - .5)); uvs.push(x / columns, y / rows);
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const a = y * (columns + 1) + x, b = a + columns + 1; indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return { positions: new Float32Array(positions), indices, uvs: new Float32Array(uvs) };
}
export function traceBounds(section: number, angle: number, project: SpaceProjection): V3[] {
  return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => project(section,
    [EULER_TRACE.center[0] + .25 * x, EULER_TRACE.center[1] + .29 * y, EULER_TRACE.center[2] + .07 * z, -1], angle))));
}
