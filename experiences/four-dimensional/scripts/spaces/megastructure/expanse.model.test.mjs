import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { EXPANSE, createExpanseField, projectExpanseAssembly, expanseEulerPoint, openHostPoint } from '../../../src/mathverse/experiments/megastructure/expanseModel.ts';
import { beamRouteClearance } from '../../../src/mathverse/experiments/layered/spaceModel.ts';
const field = createExpanseField(-2), target = field.find(a => a.id === 'euler-fold-0');
let clearance = Infinity;
for (const a of field) {
  const samples = a.moving ? 721 : 1;
  for (let n=0;n<samples;n++) {
    const points = a.vertices.map(p => projectExpanseAssembly(a,p,n*Math.PI/720,[0,0,0]));
    assert.ok(points.flat().every(Number.isFinite));
    for (const b of a.beams) clearance = Math.min(clearance, beamRouteClearance(points[b.a],points[b.b],Math.hypot(b.width,b.depth)/2+.04));
  }
}
assert.ok(clearance>3.2);
const host = field.filter(a=>a!==target).flatMap(a=>a.vertices.map(p=>projectExpanseAssembly(a,p,0,[0,0,0])));
for (const socket of target.vertices.filter(p=>p[3]===99)) {
  const mapped=openHostPoint(socket);
  assert.ok(host.some(p=>Math.hypot(...p.map((x,i)=>x-mapped[i]))<1e-8));
}
const radius = angle => {
  const a=expanseEulerPoint(0,[0,0,0,-1],angle), b=expanseEulerPoint(0,[0,.6,0,-1],angle);
  return Math.hypot(...b.map((x,i)=>x-a[i]));
};
assert.ok(Math.abs(radius(Math.PI)/radius(0)-2.9/.9)<1e-8);
// Recycling by the enlarged pitch must preserve coincident host boundaries.
const next=createExpanseField(-1);
for(const a of field.filter(a=>a.section>=-1)) assert.deepEqual(next.find(b=>b.id===a.id),a);
const report={assemblies:field.length,beams:field.reduce((n,a)=>n+a.beams.length,0),angleSamples:721,clearance,pitch:EXPANSE.pitch,far:EXPANSE.far,sourceRadiusRatio:radius(Math.PI)/radius(0),fixedSockets:true,recycling:true};
await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-expanse/model-verification.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
