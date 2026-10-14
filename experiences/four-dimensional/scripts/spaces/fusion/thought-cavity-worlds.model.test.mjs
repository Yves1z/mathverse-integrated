import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CAVITY } from '../../../src/mathverse/experiments/fusion/cavityModel.ts';
import { cavityWorldBeams, cavityWorldCounts, cavityWorldPoint } from '../../../src/mathverse/experiments/fusion/cavityWorldModel.ts';
import { HYPER_VERTICES } from '../../../src/mathverse/experiments/inversion/inversionModel.ts';
import { OrderedController } from '../../../src/mathverse/experiments/inversion/orderedModel.ts';
import { beamRouteClearance } from '../../../src/mathverse/experiments/layered/spaceModel.ts';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/thought-cavity-worlds`; await fs.mkdir(output, {recursive:true});
const angles = [0,0,0], base = cavityWorldBeams(angles), fold = new OrderedController((_z, events) => events % 3, 'euler-mobius-gaussian-out-then-return');
let minimumClearance=Infinity, maximumEndpointError=0, samples=0;
for(let event=0;event<6;event++) {
  const section=event%3, from=angles[section], to=from ? 0 : Math.PI;
  assert.equal(fold.trigger(-4),true); assert.equal(fold.section,section);
  for(let step=0;step<=360;step++) {
    angles[section]=from+(to-from)*step/360; const beams=cavityWorldBeams(angles); samples++; assert.equal(beams.length,base.length);
    for(let index=0;index<beams.length;index++) {
      const beam=beams[index]; assert.ok([...beam.a,...beam.b].every(Number.isFinite));
      if(!beam.moving) assert.deepEqual(beam,base[index]);
      else if(beam.attachment!==undefined) { const p=cavityWorldPoint(beam.section,HYPER_VERTICES[beam.attachment],angles[beam.section]); maximumEndpointError=Math.max(maximumEndpointError,Math.hypot(...p.map((v,i)=>v-beam.a[i]))); assert.deepEqual(beam.b,base[index].b); }
      else { assert.deepEqual(beam.a,cavityWorldPoint(beam.section,beam.sourceA,angles[beam.section])); assert.deepEqual(beam.b,cavityWorldPoint(beam.section,beam.sourceB,angles[beam.section])); }
      if(beam.kind!=='light') minimumClearance=Math.min(minimumClearance,beamRouteClearance(beam.a,beam.b,Math.hypot(beam.width,beam.depth)/2+.02));
    }
  }
  // The actual controller preserves all other cell angles while the event proceeds.
  const prior=[0,1,2].map(id=>fold.angle(id));
  for(let frame=0;frame<882;frame++){fold.advance(.05,-4,false,false); assert.ok(fold.snapshot().movingUnits<=1); for(let id=0;id<3;id++)if(id!==section)assert.equal(fold.angle(id),prior[id]);}
  assert.ok(Math.abs(fold.angle(section)-to)<1e-9); assert.equal(fold.phase,'stable');
}
assert.ok(minimumClearance>CAVITY.routeRadius);
assert.deepEqual(angles,[0,0,0]);
const counts=cavityWorldCounts(), report={checkedAt:new Date().toISOString(),instances:base.length,counts,movingBeams:base.filter(b=>b.moving).length,staticBeams:base.filter(b=>!b.moving).length,attachments:base.filter(b=>b.attachment!==undefined).length,samples,minimumClearance,requiredClearance:CAVITY.routeRadius,maximumEndpointError,staticHostUnchanged:true,oneCellAtATime:true,completeSixEventSequence:true};
await fs.writeFile(output+'/model-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
