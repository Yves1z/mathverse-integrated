import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { beamRouteClearance, createField, FoldController, projectVertex, SPACE_A } from '../../../src/mathverse/experiments/layered/spaceModel.ts';

const field = createField(-2);
let clearance = Infinity, denominator = Infinity, connections = 0;
for (let i = 0; i <= 104; i++) {
  const angle = .52 * i / 104;
  for (const assembly of field) {
    const theta = assembly.moving ? angle : 0;
    const points = assembly.vertices.map(point => {
      const w = point[0] * Math.sin(theta) + point[3] * Math.cos(theta);
      denominator = Math.min(denominator, SPACE_A.projectionDistance - w);
      const p = projectVertex(point, theta, assembly.anchor); assert.ok(p.every(Number.isFinite)); return p;
    });
    for (const beam of assembly.beams) {
      assert.ok(beam.a !== beam.b && points[beam.a] && points[beam.b]);
      clearance = Math.min(clearance, beamRouteClearance(points[beam.a], points[beam.b], Math.hypot(beam.width, beam.depth) / 2 + .04));
    }
    if (i === 0 && assembly.moving) {
      const degrees = new Array(assembly.vertices.length).fill(0);
      assembly.beams.forEach(b => { degrees[b.a]++; degrees[b.b]++; });
      assert.ok(degrees.every(n => n >= 3)); connections += degrees.length;
    }
  }
}
assert.ok(clearance > SPACE_A.clearance); assert.ok(denominator > 10);
const rates = [30, 60, 120].map(hz => {
  const f = new FoldController(); f.trigger(-4);
  for (let i = 0; i < hz * 20; i++) f.advance(1 / hz, -4, false, false);
  const middle = f.snapshot();
  for (let i = 0; i < hz * 23; i++) f.advance(1 / hz, -4, false, false);
  assert.equal(f.phase, 'stable'); assert.ok(Math.abs(f.angle(0) - .52) < 1e-10);
  const frozen = f.snapshot(); f.advance(4, -4, true, false); assert.deepEqual(f.snapshot(), frozen);
  return { hz, angleAt20: middle.angle, end: f.angle(0) };
});
assert.ok(Math.max(...rates.map(r => r.angleAt20)) - Math.min(...rates.map(r => r.angleAt20)) < 1e-9);
const recycling = new FoldController();
for (let section = 0; section < 1000; section++) {
  const cameraZ = -24 - section * SPACE_A.bayLength;
  recycling.trigger(cameraZ, true); recycling.retain(section - 2);
  assert.ok(recycling.snapshot().states <= SPACE_A.bayCount);
}
const reverse = new FoldController(); reverse.trigger(-4, true); reverse.trigger(-4);
reverse.advance(20, -4, false, false); assert.ok(reverse.angle(0) > 0 && reverse.angle(0) < .52);
const report = { checkedAngles: 105, clearance, minimumProjectionDenominator: denominator, sharedConnectedVertices: connections, rates, boundedStates: recycling.snapshot().states };
await fs.writeFile((process.env.SPACE_A_OUTPUT || `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/layered/space-revision-a`) + '/model-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
