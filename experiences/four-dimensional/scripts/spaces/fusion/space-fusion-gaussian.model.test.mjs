import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GAUSSIAN, gaussianBell, gaussianHeight, gaussianPoint, gaussianSlice } from '../../../src/mathverse/shared/math/gaussianFigureModel.ts';
import { projectSourceBuffer } from '../../../src/mathverse/shared/math/cellFigureModel.ts';
import { fusionBeams, threeWorldPoint, THREE_WORLD_COUNTS } from '../../../src/mathverse/experiments/fusion/fusionModel.ts';
import { OrderedController } from '../../../src/mathverse/experiments/inversion/orderedModel.ts';
import { HYPER_VERTICES } from '../../../src/mathverse/experiments/inversion/inversionModel.ts';
const source = gaussianBell(), original = source.positions.slice(), output = new Float32Array(original.length);
assert.equal(original.length / 3, 12289); assert.equal(source.indices.length / 3, 24384);
for (let r = 0; r <= GAUSSIAN.radius; r += .01) {
  assert.ok(gaussianHeight(r) <= .34 + 1e-12 && gaussianHeight(r) >= -.28);
  for (const theta of [0, .5, 1, 3]) assert.ok(Math.abs(gaussianPoint(r, theta)[1] - gaussianSlice(r)[1]) < 1e-12);
}
for (let i = 0; i < source.indices.length; i += 3) {
  const [a,b,c] = source.indices.slice(i,i+3).map(n=>Array.from(original.slice(n*3,n*3+3))), ab=b.map((v,k)=>v-a[k]), ac=c.map((v,k)=>v-a[k]);
  assert.ok(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]) > 1e-9);
}
const base = fusionBeams(Math.PI,-6,Math.PI,0), quiet = base.filter(b=>b.unit!==2);
for (let i=0;i<=360;i++) {
  const angle=i*Math.PI/360; projectSourceBuffer(original,output,2,angle,[0,0,0],threeWorldPoint); assert.ok(output.every(Number.isFinite));
  const beams=fusionBeams(Math.PI,-6,Math.PI,angle); assert.equal(beams.length,226); assert.deepEqual(beams.filter(b=>b.unit!==2),quiet);
  for (const kind of Object.keys(THREE_WORLD_COUNTS)) assert.equal(beams.filter(b=>b.kind===kind).length,THREE_WORLD_COUNTS[kind]);
  for (const beam of beams) assert.ok([...beam.a,...beam.b].every(Number.isFinite));
  for (const b of beams.filter(b=>b.vertex!==undefined)) {
    const p=threeWorldPoint(b.unit,HYPER_VERTICES[b.vertex],b.unit===2?angle:b.unit===-1?0:Math.PI);
    p.forEach((v,k)=>assert.ok(Math.abs(v-b.a[k])<1e-10));
  }
}
assert.deepEqual(source.positions,original);
const radius=angle=>{projectSourceBuffer(original,output,2,angle,[0,0,0],threeWorldPoint);let r=0;for(let i=0;i<output.length;i+=3)r=Math.max(r,Math.hypot(output[i],output[i+1],output[i+2]));return r;};
const ratio=radius(Math.PI)/radius(0);assert.ok(Math.abs(ratio-2.9/.9)<1e-6);
const fold=new OrderedController((_z,events)=>events%3,'euler-mobius-gaussian-out-then-return'),sequence=[];
for(let event=0;event<9;event++) {fold.trigger(-4);sequence.push(fold.section);const old=[0,1,2].map(s=>fold.angle(s));for(let i=0;i<4401;i++){fold.advance(.01,-4,false,false);assert.ok(fold.snapshot().movingUnits<=1);[0,1,2].filter(s=>s!==event%3).forEach(s=>assert.equal(fold.angle(s),old[s]));}assert.equal(fold.phase,'stable');}
assert.deepEqual(sequence,[0,1,2,0,1,2,0,1,2]);
const checks={vertices:original.length/3,triangles:source.indices.length/3,nondegeneratePeak:true,radialSymmetry:true,sourceUnchanged:true,angles:361,beamInstances:226,solidBeams:220,attachments:16,endpointRatio:ratio,sequence,oneMovingUnit:true};
await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion-gaussian/model-verification.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));
