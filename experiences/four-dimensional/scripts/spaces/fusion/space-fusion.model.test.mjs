import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { FUSION, FUSION_COUNTS, FUSION_CELLS, firstFusionRing, fusionBeams, fusionPoint, fusionCorner } from '../../../src/mathverse/experiments/fusion/fusionModel.ts';
import { HYPER_VERTICES } from '../../../src/mathverse/experiments/inversion/inversionModel.ts';
import { OrderedController } from '../../../src/mathverse/experiments/inversion/orderedModel.ts';
import { circleTube, rotationRibbon, projectSourceBuffer, cellCenter } from '../../../src/mathverse/shared/math/cellFigureModel.ts';
const angles = [...Array.from({ length: 721 }, (_, i) => i / 720 * Math.PI), Math.acos(-1 / 1.9)];
const quiet = [-1, 1].map(id => HYPER_VERTICES.map(v => fusionPoint(id, v, 0))), ring = firstFusionRing(-4);
let minLength = Infinity, maxJump = 0, previous = null;
for (const theta of angles) {
  const beams = fusionBeams(theta, ring), counts = {};
  for (const beam of beams) {
    assert.ok([...beam.a, ...beam.b].every(Number.isFinite), 'Projection and attachment endpoints must remain finite');
    counts[beam.kind] = (counts[beam.kind] ?? 0) + 1;
    minLength = Math.min(minLength, Math.hypot(...beam.a.map((v, k) => v - beam.b[k])));
    if (beam.vertex !== undefined) {
      assert.deepEqual(beam.a, fusionPoint(beam.unit, HYPER_VERTICES[beam.vertex], beam.unit === 0 ? theta : 0));
      assert.deepEqual(beam.b, fusionCorner(beam.ring, (beam.unit === -1 || beam.unit === 1 ? 1 : 0) | (beam.vertex === 14 ? 2 : 0)));
    }
  }
  assert.deepEqual(counts, FUSION_COUNTS);
  for (let i = 0; i < 2; i++) assert.deepEqual(HYPER_VERTICES.map(v => fusionPoint([-1, 1][i], v, 0)), quiet[i]);
  if (previous && theta !== angles.at(-1)) for (let i = 0; i < beams.length; i++) maxJump = Math.max(maxJump, Math.hypot(...beams[i].a.map((v, k) => v - previous[i].a[k])));
  previous = beams;
}
let maxProjectionError = 0;
for (const source of [circleTube().positions, rotationRibbon().positions]) {
  const original = new Float32Array(source), output = new Float32Array(source.length), before = new Float32Array(source.length);
  projectSourceBuffer(source, before, 0, 0, [0, 0, 0], fusionPoint);
  for (const theta of [0, .4, 1.8, Math.acos(-1 / 1.9), Math.PI]) {
    projectSourceBuffer(source, output, 0, theta, [0, 0, 0], fusionPoint); const center = cellCenter(0, theta, fusionPoint);
    for (let i = 0; i < source.length; i += 3) {
      const p = fusionPoint(0, [source[i], source[i + 1], source[i + 2], -1], theta);
      for (let k = 0; k < 3; k++) maxProjectionError = Math.max(maxProjectionError, Math.abs(output[i + k] - (p[k] - center[k])));
    }
    assert.ok(output.every(Number.isFinite));
  }
  const initialRadius = Math.max(...Array.from({ length: before.length / 3 }, (_, i) => Math.hypot(...before.slice(i * 3, i * 3 + 3))));
  const finalRadius = Math.max(...Array.from({ length: output.length / 3 }, (_, i) => Math.hypot(...output.slice(i * 3, i * 3 + 3))));
  assert.ok(Math.abs(finalRadius / initialRadius - 2.9 / .9) < 1e-5); assert.deepEqual(source, original);
}
const fold = new OrderedController(() => 0, 'inhabited-cell-out-in');
for (let i = 0; i < 12000; i++) fold.advance(.1, -4 - i * .035, false, false);
assert.equal(fold.snapshot().section, 0); assert.deepEqual(Object.keys(fold.snapshot().angles), ['0']);
// Retire the rear scaffold beyond the 620-unit axial distance, in deep fog.
const retirementZ = FUSION.origin, retiredRing = firstFusionRing(retirementZ - .001) - 1;
assert.ok(Math.abs(fusionCorner(retiredRing, 0)[2] - retirementZ) > 620);
const report = { checkedAt: new Date().toISOString(), sampledAngles: angles.length, cells: FUSION_CELLS.length, solidBeams: 184, counts: FUSION_COUNTS,
  minLength, maxStepEndpointMotion: maxJump, maxProjectionError, endScale: 2.9 / .9, immutableSourceGeometry: true, exactAttachments: true,
  quietCellsUnchanged: true, oneController: fold.snapshot(), rearScaffoldRetirementAxialGapOver620: true, scope: 'Three fixed study cells, reusable scaffold; not an endless sequence of populated worlds.' };
await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion/model-verification.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
