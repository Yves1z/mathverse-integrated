import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mobiusPoint, mobiusBoundary, mobiusRibbon, projectSourceBuffer, cellCenter } from '../../../src/mathverse/shared/math/cellFigureModel.ts';
import { fusionPoint, fusionBeams } from '../../../src/mathverse/experiments/fusion/fusionModel.ts';
import { OrderedController } from '../../../src/mathverse/experiments/inversion/orderedModel.ts';
const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6));
for (let i = 0; i <= 20; i++) { const v = (i / 10 - 1) * .14; close(mobiusPoint(0, -v), mobiusPoint(Math.PI * 2, v)); }
close(mobiusBoundary(0), mobiusBoundary(Math.PI * 4));
assert.notDeepEqual(mobiusBoundary(0), mobiusBoundary(Math.PI * 2));
const source = mobiusRibbon(), original = source.positions.slice(), out = new Float32Array(source.positions.length);
let minDenominator = Infinity;
for (let frame = 0; frame <= 360; frame++) {
  const angle = frame * Math.PI / 360;
  projectSourceBuffer(source.positions, out, 1, angle, [0, 0, 0], fusionPoint);
  assert.ok(out.every(Number.isFinite));
  for (let i = 0; i < original.length; i += 3) {
    assert.ok(Math.abs(original[i]) < .67 && Math.abs(original[i + 1]) < .67 && Math.abs(original[i + 2]) < .47);
    minDenominator = Math.min(minDenominator, 1.9 - original[i] * Math.sin(angle) + Math.cos(angle));
  }
  const beams = fusionBeams(Math.PI, -6, angle);
  assert.equal(beams.length, 190); assert.ok(beams.every(b => [...b.a, ...b.b].every(Number.isFinite)));
  for (const b of beams.filter(b => b.vertex !== undefined && b.unit === 1)) {
    const { HYPER_VERTICES } = await import('../../../src/mathverse/experiments/inversion/inversionModel.ts'); close(b.a, fusionPoint(1, HYPER_VERTICES[b.vertex], angle));
  }
}
assert.deepEqual(source.positions, original);
const radius = angle => { projectSourceBuffer(original, out, 1, angle, [0, 0, 0], fusionPoint); return Math.max(...Array.from({length: out.length / 3}, (_, i) => Math.hypot(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]))); };
const ratio = radius(Math.PI) / radius(0); assert.ok(Math.abs(ratio - 2.9 / .9) < 1e-6);
assert.ok(cellCenter(1, Math.PI, fusionPoint).every(Number.isFinite));
const controller = new OrderedController((_z, events) => events % 2, 'euler-mobius-euler-return-mobius-return'), sequence = [];
for (let event = 0; event < 8; event++) {
  controller.trigger(-4); sequence.push(controller.section);
  const quiet = controller.angle(event % 2 ? 0 : 1);
  for (let i = 0; i < 4401; i++) { controller.advance(.01, -4, false, false); assert.ok(controller.snapshot().movingUnits <= 1); assert.equal(controller.angle(event % 2 ? 0 : 1), quiet); }
  assert.equal(controller.phase, 'stable');
}
assert.deepEqual(sequence, [0, 1, 0, 1, 0, 1, 0, 1]);
const checks = { reversedSeam: true, singleBoundaryPeriod: Math.PI * 4, sourceUnchanged: true, projectedAngles: 361, endRadiusRatio: ratio, minDenominator, sequence, maximumMovingUnits: 1 };
await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion-mobius/model-verification.json`, JSON.stringify(checks, null, 2));
console.log(JSON.stringify(checks, null, 2));
