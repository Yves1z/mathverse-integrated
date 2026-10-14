import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { cavityBeams, cavityCounts, cavityPoint, CAVITY } from '../../../src/mathverse/experiments/fusion/cavityModel.ts';
import { HYPER_VERTICES } from '../../../src/mathverse/experiments/inversion/inversionModel.ts';
import { beamRouteClearance } from '../../../src/mathverse/experiments/layered/spaceModel.ts';
const base = cavityBeams(0), counts = cavityCounts(); let minimumClearance = Infinity, maxEndpointError = 0;
for (let step = 0; step <= 360; step++) {
  const angle = step * Math.PI / 360, beams = cavityBeams(angle); assert.equal(beams.length, base.length);
  for (let index = 0; index < beams.length; index++) {
    const beam = beams[index]; assert.ok([...beam.a, ...beam.b].every(Number.isFinite));
    if (!beam.moving) assert.deepEqual(beam, base[index]);
    else if (beam.attachment !== undefined) { const projected = cavityPoint(0, HYPER_VERTICES[beam.attachment], angle); maxEndpointError = Math.max(maxEndpointError, Math.hypot(...projected.map((v, j) => v - beam.a[j]))); assert.deepEqual(beam.b, base[index].b); }
    else { assert.deepEqual(beam.a, cavityPoint(0, beam.sourceA, angle)); assert.deepEqual(beam.b, cavityPoint(0, beam.sourceB, angle)); }
    if (beam.kind !== 'light') minimumClearance = Math.min(minimumClearance, beamRouteClearance(beam.a, beam.b, Math.hypot(beam.width, beam.depth) / 2 + .02));
  }
}
assert.ok(minimumClearance > CAVITY.routeRadius, 'Entire central route remains clear for every sampled angle');
const report = { checkedAt: new Date().toISOString(), instances: base.length, counts, localMovingBeams: base.filter(b => b.moving).length, staticBeams: base.filter(b => !b.moving).length, sampledAngles: 361, minimumClearance, requiredClearance: CAVITY.routeRadius, maxEndpointError, staticHostUnchanged: true };
await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/thought-cavity/model-verification.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
