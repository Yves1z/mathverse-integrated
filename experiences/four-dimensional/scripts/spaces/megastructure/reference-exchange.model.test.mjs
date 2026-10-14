import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createExchangeSolids,solidCorners,exchangePoint,exchangeConnections,ReferenceExchangeController,REFERENCE_EXCHANGE,EXCHANGE_CORNERS,EXCHANGE_ATTACHMENTS,EXCHANGE_SOCKETS} from '../../../src/mathverse/shared/projection/referenceExchangeModel.ts';
import {createJourneyBeams,referenceRouteClearance} from '../../../src/mathverse/experiments/megastructure/referenceModel.ts';
const solids=createExchangeSolids();assert.equal(solids.length,72);let minimum=Infinity,denominator=Infinity,maxStep=0,previous=[];
for(let i=0;i<=720;i++){
 const angle=i*Math.PI/720,points=solids.flatMap(s=>solidCorners(s).map(v=>{const c=Math.cos(angle),sine=Math.sin(angle);denominator=Math.min(denominator,REFERENCE_EXCHANGE.lens-v[0]*sine-v[3]*c);return exchangePoint(v,angle);}));
 assert.ok(points.every(p=>p.every(Number.isFinite)));minimum=Math.min(minimum,...points.map(p=>p[0]-5));
 if(previous.length)maxStep=Math.max(maxStep,...points.map((p,j)=>Math.hypot(...p.map((x,a)=>x-previous[j][a]))));previous=points;
 const edges=exchangeConnections(angle);assert.equal(edges.length,12);
 for(let j=0;j<8;j++){assert.deepEqual(edges[j].a,exchangePoint([...EXCHANGE_CORNERS[j],-1],angle));assert.deepEqual(edges[j].b,exchangePoint([...EXCHANGE_CORNERS[j],1],angle));}
 for(let j=0;j<4;j++){assert.deepEqual(edges[j+8].a,EXCHANGE_SOCKETS[j]);assert.deepEqual(edges[j+8].b,exchangePoint(EXCHANGE_ATTACHMENTS[j],angle));}
 minimum=Math.min(minimum,...edges.map(e=>Math.min(e.a[0],e.b[0])-e.width-5));
}
assert.ok(minimum>3.2);assert.ok(denominator>.4);assert.ok(maxStep<2);
const background=createJourneyBeams(0,true);assert.equal(background.length,4680);assert.equal(Math.min(...background.map(referenceRouteClearance)),4.8);
const inside=exchangePoint([0,1,0,-1],0),outside=exchangePoint([0,1,0,-1],Math.PI);const ratio=(outside[1]-REFERENCE_EXCHANGE.center[1])/(inside[1]-REFERENCE_EXCHANGE.center[1]);assert.ok(Math.abs(ratio-2.9/.9)<1e-10);
const c=new ReferenceExchangeController();const step=(seconds,frozen=false,reduced=false)=>{for(let n=0;n<Math.round(seconds*60);n++)c.advance(1/60,100,frozen,reduced);};
step(24.1);assert.equal(c.events,1);assert.equal(c.phase,'anticipation');let last=c.angle;
for(let n=0;n<44*60;n++){c.advance(1/60,100,false,false);assert.ok(c.angle>=last-1e-12);last=c.angle;}assert.equal(c.phase,'stable');assert.equal(c.angle,Math.PI);
const held=c.snapshot();step(10,true);assert.deepEqual(c.snapshot(),held);step(10,false,true);assert.deepEqual(c.snapshot(),held);
step(80);assert.equal(c.events,2);step(44.1);assert.equal(c.phase,'stable');assert.equal(c.angle,0);
c.reset();step(150,false,true);assert.equal(c.events,0);c.begin(true);assert.equal(c.angle,Math.PI);c.reset();for(let n=0;n<300*60;n++)c.advance(1/60,-221,false,false);assert.equal(c.events,0);
const report={angleSamples:721,solids:72,connections:12,backgroundBeams:background.length,dynamicClearance:minimum,routeClearance:4.8,minimumDenominator:denominator,maximumSampleStep:maxStep,naturalScaleRatio:ratio,monotoneEvent:true,freezeAndReduced:true};
await fs.mkdir(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-exchange`,{recursive:true});await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-exchange/model-verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
