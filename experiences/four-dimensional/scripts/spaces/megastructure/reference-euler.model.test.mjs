import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {circleTube,rotationRibbon,cellBounds} from '../../../src/mathverse/shared/math/cellFigureModel.ts';
import {tracePage} from '../../../src/mathverse/shared/math/eulerTraceModel.ts';
import {referenceEulerPoint,referenceEulerLayout,REFERENCE_EULER_SOURCE_Z} from '../../../src/mathverse/experiments/megastructure/referenceEulerModel.ts';
import {exchangePoint} from '../../../src/mathverse/shared/projection/referenceExchangeModel.ts';
import {createMotion} from '../../../src/mathverse/config/motion.ts';import {createReading,openReading,advanceReading,closeReading} from '../../../src/mathverse/reading/ReadingKernel.ts';import {advanceMotion} from '../../../src/mathverse/motion/MotionKernel.ts';
const sources=[circleTube().positions,rotationRibbon().positions,...[0,1,2].map(i=>tracePage(i).positions)];let clearance=Infinity,minimumDenominator=Infinity;
for(const source of sources)for(let i=0;i<source.length;i+=3){assert.ok(Math.abs(source[i])<1);assert.ok(Math.abs(source[i+1])<1);assert.ok(Math.abs(source[i+2]+REFERENCE_EULER_SOURCE_Z)<1);}
for(let n=0;n<=360;n++){
 const angle=n*Math.PI/360;
 for(const source of sources)for(let i=0;i<source.length;i+=3){const p=[source[i],source[i+1],source[i+2],-1],result=referenceEulerPoint(0,p,angle);assert.ok(result.every(Number.isFinite));clearance=Math.min(clearance,result[0]-5);minimumDenominator=Math.min(minimumDenominator,1.9-p[0]*Math.sin(angle)+Math.cos(angle));if(i===0)assert.deepEqual(result,exchangePoint([p[0],p[1],p[2]+REFERENCE_EULER_SOURCE_Z,-1],angle));}
 const bounds=cellBounds('complex-rotation',0,angle,referenceEulerPoint);assert.ok(bounds.flat().every(Number.isFinite));
}
assert.ok(clearance>3.2);assert.ok(minimumDenominator>.6);assert.equal(referenceEulerLayout().length,4);
const center=referenceEulerPoint(0,[0,0,0,-1],0),outer=referenceEulerPoint(0,[0,0,0,-1],Math.PI);
const scale0=referenceEulerPoint(0,[0,1,0,-1],0)[1]-center[1],scale1=referenceEulerPoint(0,[0,1,0,-1],Math.PI)[1]-outer[1];assert.ok(Math.abs(scale1/scale0-2.9/.9)<1e-10);
const motion=createMotion(),reading=createReading();motion.phase='exploring';motion.speed=.35;motion.yaw=motion.targetYaw=.1;motion.pitch=motion.targetPitch=.27;assert.ok(openReading(motion,reading,'leonhard-euler',center,[5,8,110]));assert.ok(Math.abs(reading.focusYaw-Math.atan2(center[0]-5,110-center[2]))<1e-12);
for(let i=0;i<180;i++){advanceMotion(motion,1/60);advanceReading(motion,reading,motion.frameDt);}assert.equal(reading.phase,'reading');assert.ok(Math.abs(motion.speed-.021)<1e-6);const saved=motion.distance;closeReading(motion,reading);for(let i=0;i<180;i++){advanceMotion(motion,1/60);advanceReading(motion,reading,motion.frameDt);}assert.equal(reading.phase,'closed');assert.ok(motion.distance>saved);assert.ok(Math.abs(motion.yaw-.1)<1e-6);
const report={samples:361,sourceMeshes:sources.length,contentContainedInSourceCell:true,minimumClearance:clearance,minimumDenominator,naturalScale:scale1/scale0,customCameraFocus:true,nonzeroReadingSpeed:.021,returnPreservesTravel:true};await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-reference-euler/model-verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
