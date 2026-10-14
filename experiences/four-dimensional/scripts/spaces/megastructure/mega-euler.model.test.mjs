import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createField, beamRouteClearance } from '../../../src/mathverse/experiments/layered/spaceModel.ts';
import { createMegaEulerField, projectMegaAssembly, megaEulerPoint, MEGA_EULER, MegaEulerController } from '../../../src/mathverse/experiments/megastructure/megaEulerModel.ts';
import { circleTube, rotationRibbon } from '../../../src/mathverse/shared/math/cellFigureModel.ts';
const original = createField(-2), revised = createMegaEulerField(-2);
const target = revised.find(a => a.id === 'euler-fold-0');
assert.ok(target);
let preserved = 0;
for (const a of original.filter(a => !['fold-0', 'spine-0', 'spine-1', 'cross-0'].includes(a.id))) { assert.deepEqual(revised.find(b => b.id === a.id), a); preserved++; }
let clearance = Infinity, minDenominator = Infinity, socketError = 0;
for (const assembly of revised.filter(a => a !== target)) {
  const points = assembly.vertices.map(p => projectMegaAssembly(assembly, p, 0, [0, 0, 0]));
  for (const beam of assembly.beams) clearance = Math.min(clearance, beamRouteClearance(points[beam.a], points[beam.b], Math.hypot(beam.width, beam.depth) / 2 + .04));
}
for (let i = 0; i <= 720; i++) {
  const angle = Math.PI * i / 720;
  const projected = target.vertices.map(p => projectMegaAssembly(target, p, angle, [0, 0, 0]));
  for (const p of target.vertices) {
    if (p[3] === 99) { const v = projectMegaAssembly(target, p, angle, [0, 0, 0]); socketError = Math.max(socketError, Math.hypot(...v.map((x, j) => x - p[j]))); }
    else minDenominator = Math.min(minDenominator, MEGA_EULER.lens - (p[0] * Math.sin(angle) + p[3] * Math.cos(angle)));
  }
  for (const b of target.beams) clearance = Math.min(clearance, beamRouteClearance(projected[b.a], projected[b.b], Math.hypot(b.width, b.depth) / 2 + .04));
  assert.ok(projected.flat().every(Number.isFinite));
}
assert.ok(clearance > 3.2); assert.ok(minDenominator > .48); assert.equal(socketError, 0);
const hostPoints = revised.filter(a => a.id !== target.id).flatMap(a => a.vertices.map(p => projectMegaAssembly(a, p, 0, [0, 0, 0])));
for (const socket of target.vertices.filter(p => p[3] === 99)) assert.ok(hostPoints.some(p => Math.hypot(...p.map((x, j) => x - socket[j])) < 1e-8), 'Every fixed connector must land on an actual host vertex');
const actualRadius = (source, angle) => {
  const center = megaEulerPoint(0, [0, 0, 0, -1], angle); let r = 0;
  for (let i = 0; i < source.positions.length; i += 3) {
    const p = megaEulerPoint(0, [source.positions[i], source.positions[i + 1], source.positions[i + 2], -1], angle);
    r = Math.max(r, Math.hypot(...p.map((x, j) => x - center[j])));
  } return r;
};
const ratios = [circleTube(), rotationRibbon()].map(s => actualRadius(s, Math.PI) / actualRadius(s, 0));
ratios.forEach(r => assert.ok(Math.abs(r - 2.9 / .9) < 1e-6));
const controller = new MegaEulerController();
for (let i = 0; i < 32 * 60 + 1; i++) controller.advance(1 / 60, -4, false, false);
assert.equal(controller.events, 1); assert.equal(controller.angle(1), 0);
for (let i = 0; i < 44 * 60 + 2; i++) controller.advance(1 / 60, -4, false, false);
assert.equal(controller.phase, 'stable'); assert.equal(controller.angle(0), Math.PI);
const held = controller.snapshot(); controller.advance(5, -4, true, false); assert.deepEqual(controller.snapshot(), held);
controller.trigger(-4, true); assert.equal(controller.angle(0), 0);
await fs.mkdir(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-euler`, { recursive: true });
const report = { preservedAssemblies: preserved, targetBeams: target.beams.length, angleSamples: 721, clearance, minDenominator, socketError, actualVertexRadiusRatios: ratios, oneActiveRegion: true, frozenStable: true };
await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-euler/model-verification.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
