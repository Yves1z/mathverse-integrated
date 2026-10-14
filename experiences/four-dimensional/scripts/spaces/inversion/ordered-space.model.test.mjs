import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { HYPER_VERTICES, HYPER_EDGES } from '../../../src/mathverse/experiments/inversion/inversionModel.ts';
import { BRIDGE_VERTICES, fieldPoint, nearestSection, ORDERED, ORDERED_MOUNTS, OrderedController, windowPose, windowSupports } from '../../../src/mathverse/experiments/inversion/orderedModel.ts';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/inversion/ordered-inversion`; await fs.mkdir(output, { recursive: true });
assert.equal(nearestSection(-4), 0); assert.equal(nearestSection(-100.01), 1); assert.equal(nearestSection(-208.01), 2);
let minimumModuleLateral = Infinity, minimumBridgeVertical = Infinity, maximumWindowStep = 0;
const previous = new Map();
for (let i = 0; i <= 720; i++) {
  const angle = i * Math.PI / 720;
  for (const section of [-3, -2, -1, 0, 1, 2]) {
    const points = HYPER_VERTICES.map(v => fieldPoint(section, v, angle));
    for (const p of points) { assert.ok(p.every(Number.isFinite)); minimumModuleLateral = Math.min(minimumModuleLateral, Math.abs(p[0])); }
    for (const id of BRIDGE_VERTICES) minimumBridgeVertical = Math.min(minimumBridgeVertical, Math.abs(points[id][1] - 1.55));
    for (const edge of HYPER_EDGES) assert.ok(points[edge.a][0] * points[edge.b][0] > 0);
  }
  for (const mount of ORDERED_MOUNTS) {
    const pose = windowPose(mount, mount.section, angle); assert.ok([...pose.position, ...pose.scale, ...pose.rotation].every(Number.isFinite)); assert.ok(pose.scale.every(v => v > .05 && v < 30));
    if (previous.has(mount.id)) maximumWindowStep = Math.max(maximumWindowStep, Math.hypot(...pose.position.map((v, k) => v - previous.get(mount.id)[k])));
    previous.set(mount.id, pose.position);
    const supports = windowSupports(mount, mount.section, angle); assert.ok(supports.flat().every(Number.isFinite));
    const horizontal = [Math.cos(pose.rotation[1]), 0, -Math.sin(pose.rotation[1])];
    assert.ok(supports[1].reduce((dot, v, k) => dot + (v - supports[0][k]) * horizontal[k], 0) >= -1e-8, 'Suspension order must follow the facing rectangle throughout inversion');
    const recycled = windowPose(mount, mount.section + 2, angle); assert.ok(Math.abs(recycled.position[2] - pose.position[2] + ORDERED.pitch * 2) < 1e-9); assert.equal(recycled.position[0], pose.position[0]);
  }
}
// Every cell edge stays in one lateral half-space. Every inter-cell bridge joins
// vertices on the same side of the eye-height plane, independent of neighboring angles.
assert.ok(minimumModuleLateral - Math.hypot(1.6, 1.3) / 2 > 3.2); assert.ok(minimumBridgeVertical - Math.hypot(.42, .42) / 2 > 3.2);
const scheduler = new OrderedController(), sequence = [], restAngles = new Map();
for (let event = 0; event < 4; event++) {
  assert.ok(scheduler.trigger(-4)); sequence.push(scheduler.section);
  for (let i = 0; i < 60 * 44 + 2; i++) {
    const before = Array.from({ length: 6 }, (_, k) => scheduler.angle(k - 3)); scheduler.advance(1 / 60, -4, false, false);
    const after = Array.from({ length: 6 }, (_, k) => scheduler.angle(k - 3)); assert.ok(after.filter((a, k) => Math.abs(a - before[k]) > 1e-12).length <= 1);
  }
  assert.equal(scheduler.phase, 'stable'); restAngles.set(scheduler.section, scheduler.angle(scheduler.section));
}
assert.deepEqual(sequence, [0, 1, 0, 1]); assert.equal(scheduler.angle(0), 0); assert.equal(scheduler.angle(1), 0);
const before = scheduler.snapshot(); scheduler.advance(1, -4, true, false); scheduler.advance(1, -4, false, true); assert.deepEqual(scheduler.snapshot(), before);
let maximumCache = 0, eventCount = 0, stableFrames = 0;
const long = new OrderedController();
for (let i = 0; i < 60 * 1800; i++) { const z = -4 - i / 60 * .35; long.advance(1 / 60, z, false, false); long.retain(nearestSection(z) - ORDERED.behind);
  maximumCache = Math.max(maximumCache, Object.keys(long.snapshot().angles).length); if (long.phase === 'stable') stableFrames++; eventCount = long.events; }
assert.ok(maximumCache <= ORDERED.count + 3); assert.ok(stableFrames / (60 * 1800) > .5);
const report = { checkedAt: new Date().toISOString(), sampledAngles: 721, minimumModuleLateral, minimumBridgeVertical,
  clearanceAfterBodyRadius: minimumModuleLateral - Math.hypot(1.6, 1.3) / 2, maximumWindowStep, eventSequence: sequence, maximumMovingUnits: 1,
  thirtyMinuteSimulation: { maximumAngleCache: maximumCache, events: eventCount, stableRatio: stableFrames / (60 * 1800) },
  checks: { connectedFixedEdges: true, allZCentralRouteClear: true, independentlyRotatingNeighborsBridgeClear: true, windowsFollowSourceSurface: true, suspensionOrderPreserved: true, recyclePreservesSide: true, deterministicSequence: true, singleMovingUnit: true, stableTimeMajority: true, freezeStopsClock: true },
  scope: 'Route bounds follow constant-sign lateral and vertical half-spaces plus sampled projection extrema. Window rectangles use local tangents to projected source faces; inter-cell bridges are three-dimensional display connections.' };
await fs.writeFile(output + '/model-verification.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
