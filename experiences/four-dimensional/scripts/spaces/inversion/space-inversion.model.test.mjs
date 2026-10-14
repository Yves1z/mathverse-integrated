import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import { HYPER_CELLS, HYPER_EDGES, HYPER_VERTICES, INVERSION, InversionController, projectHyper, rotateXW, segmentDistance } from '../../../src/mathverse/experiments/inversion/inversionModel.ts';
import { createMotion, MOTION } from '../../../src/mathverse/config/motion.ts';
import { advanceMotion, resumeMotion, suspendMotion } from '../../../src/mathverse/motion/MotionKernel.ts';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/inversion/space-inversion`; await fs.mkdir(output, { recursive: true });
assert.equal(HYPER_VERTICES.length, 16); assert.equal(HYPER_EDGES.length, 32); assert.equal(HYPER_CELLS.length, 8);
assert.equal(new Set(HYPER_EDGES.map(e => `${e.a}/${e.b}`)).size, 32);
for (let id = 0; id < 16; id++) assert.equal(HYPER_EDGES.filter(e => e.a === id || e.b === id).length, 4);
for (const cell of HYPER_CELLS) { assert.equal(cell.vertices.length, 8); assert.equal(HYPER_EDGES.filter(e => cell.vertices.includes(e.a) && cell.vertices.includes(e.b)).length, 12); }
let minimumDenominator = Infinity, minimumRouteClearance = Infinity, maximumCoordinate = 0;
const overviewCamera = new PerspectiveCamera(55, 16 / 9, .08, 800); overviewCamera.position.set(80, 55, 319.75); overviewCamera.lookAt(new Vector3(...INVERSION.center)); overviewCamera.updateMatrixWorld();
let overviewMaximumNDC = [0, 0];
for (let i = 0; i <= 720; i++) {
  const angle = Math.PI * i / 720, points = HYPER_VERTICES.map(v => projectHyper(v, angle));
  for (const v of HYPER_VERTICES) {
    const r = rotateXW(v, angle); assert.ok(Math.abs(r.reduce((s, x) => s + x * x, 0) - 4) < 1e-12);
    minimumDenominator = Math.min(minimumDenominator, INVERSION.lens - r[3]);
  }
  for (const p of points) { assert.ok(p.every(Number.isFinite)); maximumCoordinate = Math.max(maximumCoordinate, ...p.map(Math.abs)); const screen = new Vector3(...p).project(overviewCamera); overviewMaximumNDC = [Math.max(overviewMaximumNDC[0], Math.abs(screen.x)), Math.max(overviewMaximumNDC[1], Math.abs(screen.y))]; }
  for (const edge of HYPER_EDGES) {
    minimumRouteClearance = Math.min(minimumRouteClearance, segmentDistance([0, MOTION.eyeHeight, INVERSION.cameraStart], [0, MOTION.eyeHeight, INVERSION.cameraLimit], points[edge.a], points[edge.b]));
    // A centrally projected source edge must stay on its projected straight line.
    for (const t of [.2, .5, .8]) {
      const source = HYPER_VERTICES[edge.a].map((v, k) => v + (HYPER_VERTICES[edge.b][k] - v) * t), mid = projectHyper(source, angle);
      assert.ok(segmentDistance(mid, [mid[0] + 1e-6, mid[1], mid[2]], points[edge.a], points[edge.b]) < 1e-7);
    }
  }
}
assert.ok(minimumDenominator > .48); assert.ok(minimumRouteClearance > 3.2);
assert.ok(overviewMaximumNDC.every(v => v < .95));
const extent = angle => Math.max(...HYPER_VERTICES.slice(0, 8).map(v => Math.abs(projectHyper(v, angle)[1] - INVERSION.center[1])));
const sizeRatio = extent(Math.PI) / extent(0); assert.ok(Math.abs(sizeRatio - (INVERSION.lens + 1) / (INVERSION.lens - 1)) < 1e-12);
const initial = HYPER_VERTICES.map(v => projectHyper(v, 0));
for (const v of HYPER_VERTICES) assert.ok(initial.some(p => Math.hypot(...projectHyper(v, Math.PI).map((x, k) => x - p[k])) < 1e-10));
const run = fps => { const m = new InversionController(); for (let i = 0; i < fps * 58.2; i++) m.advance(1 / fps, false, false); return m.snapshot(); };
const rates = [30, 60, 120].map(run); for (const r of rates) { assert.equal(r.events, 1); assert.equal(r.phase, 'stable'); assert.equal(r.angle, Math.PI); }
const m = new InversionController(); m.begin(); for (let i = 0; i < 1200; i++) m.advance(1 / 60, false, false);
const before = m.snapshot(); m.seek(Math.PI / 2); assert.equal(m.angle, before.angle);
const stopped = m.snapshot(); m.advance(.05, true, false); m.advance(.05, false, true); m.advance(NaN, false, false); assert.deepEqual(m.snapshot(), stopped);
m.seek(0, true); assert.equal(m.angle, 0); m.begin(true); assert.equal(m.angle, Math.PI);
const travel = createMotion(); travel.phase = 'exploring'; travel.z = -4; travel.pitch = 0; travel.speed = MOTION.explorationSpeed * INVERSION.baseSpeedScale;
for (let i = 0; i < 60 * 600; i++) {
  travel.speedScale = INVERSION.baseSpeedScale * Math.max(0, (travel.z - INVERSION.cameraLimit) / (INVERSION.cameraStart - INVERSION.cameraLimit));
  const previous = travel.z; advanceMotion(travel, 1 / 60); assert.ok(travel.z < previous && travel.z > INVERSION.cameraLimit);
}
const tenMinutes = { z: travel.z, speed: travel.speed };
suspendMotion(travel); const z = travel.z; advanceMotion(travel, 100); assert.equal(travel.z, z); resumeMotion(travel); advanceMotion(travel, 100); assert.equal(travel.z, z);
const report = { checkedAt: new Date().toISOString(), vertices: 16, edges: 32, cubicCells: 8, sampledAngles: 721,
  minimumDenominator, minimumRouteClearance, maximumCoordinate, overviewMaximumNDC, trackedCellSizeRatio: sizeRatio, fps: rates.map((r, i) => ({ fps: [30, 60, 120][i], ...r })),
  cameraAfterTenMinutes: tenMinutes, checks: { fixedTopology: true, projectionFinite: true, projectedEdgesStraight: true, sourceLengthPreserved: true,
    sameCellChangesDepth: true, finalSpatialShapeReturns: true, interruptedSeekContinuous: true, freezeAndReducedMotionStopClock: true, safeContinuousTravel: true, suspensionNoCatchup: true },
  scope: 'Exact four-dimensional vertex/edge projection. Decorative beveled beam sections are three-dimensional. Route clearance uses a finite camera segment and 721 angular samples; this is not an analytic proof of every intermediate angle.' };
await fs.writeFile(output + '/model-verification.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
