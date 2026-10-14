import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { threeWorldPoint } from '../../../src/mathverse/experiments/fusion/fusionModel.ts';
import { EULER_TRACE, tracePage } from '../../../src/mathverse/shared/math/eulerTraceModel.ts';
const pages = [0, 1, 2].map(tracePage), originals = pages.map(p => new Float32Array(p.positions));
const center = angle => threeWorldPoint(0, [...EULER_TRACE.center, -1], angle);
let maxError = 0;
for (let page = 0; page < 3; page++) {
  const mesh = pages[page];
  for (const coordinate of mesh.positions) assert.ok(Math.abs(coordinate) < 1, 'Paper remains inside the original cubic cell');
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = mesh.indices.slice(i, i + 3).map(index => Array.from(mesh.positions.slice(index * 3, index * 3 + 3)));
    const u = b.map((v, j) => v - a[j]), v = c.map((n, j) => n - a[j]);
    assert.ok(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 1e-8);
  }
  for (let step = 0; step <= 360; step++) for (let i = 0; i < mesh.positions.length; i += 3) {
    const source = [...mesh.positions.slice(i, i + 3), -1], point = threeWorldPoint(0, source, step * Math.PI / 360);
    assert.ok(point.every(Number.isFinite));
  }
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const source = [...mesh.positions.slice(i, i + 3), -1], a = threeWorldPoint(0, source, 0), b = threeWorldPoint(0, source, Math.PI);
    const inner = Math.hypot(...a.map((v, j) => v - center(0)[j])), outer = Math.hypot(...b.map((v, j) => v - center(Math.PI)[j]));
    maxError = Math.max(maxError, Math.abs(outer / inner - 2.9 / .9));
  }
  assert.deepEqual(mesh.positions, originals[page]);
}
assert.ok(maxError < 1e-12);
const report = { checkedAt: new Date().toISOString(), pages: 3, vertices: pages.reduce((s, p) => s + p.positions.length / 3, 0), triangles: pages.reduce((s, p) => s + p.indices.length / 3, 0), sampledAngles: 361, insideSourceCell: true, sourceUnchanged: true, finiteProjection: true, maxEndpointScaleError: maxError };
await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion-euler/model-verification.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
