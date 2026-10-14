import type { V3 } from '../../experiments/inversion/inversionModel.ts';
import type { SourceMesh } from './cellFigureModel.ts';

// A finite, display-scaled patch of exp(-(x²+z²)); source coordinates stay in w=-1.
export const GAUSSIAN = { radius: .69, width: .28, floor: -.28, height: .62 } as const;
export function gaussianHeight(radius: number) { return GAUSSIAN.floor + GAUSSIAN.height * Math.exp(-((radius / GAUSSIAN.width) ** 2)); }
export function gaussianPoint(radius: number, theta: number): V3 {
  return [radius * Math.cos(theta), gaussianHeight(radius), radius * Math.sin(theta)];
}
export function gaussianSlice(x: number): V3 { return [x * Math.cos(1.05), gaussianHeight(x), x * Math.sin(1.05)]; }
export function gaussianBell(): SourceMesh {
  const positions: number[] = [0, gaussianHeight(0), 0], indices: number[] = [], nr = 64, nu = 192;
  // One central vertex prevents a ring of degenerate triangles at the peak.
  for (let j = 1; j <= nr; j++) for (let i = 0; i < nu; i++) positions.push(...gaussianPoint(j / nr * GAUSSIAN.radius, i / nu * Math.PI * 2));
  for (let i = 0; i < nu; i++) indices.push(0, 1 + (i + 1) % nu, 1 + i);
  for (let j = 0; j < nr - 1; j++) for (let i = 0; i < nu; i++) {
    const a = 1 + j * nu + i, b = 1 + j * nu + (i + 1) % nu, c = a + nu, d = b + nu;
    indices.push(a, b, c, b, d, c);
  }
  return { positions: new Float32Array(positions), indices };
}
