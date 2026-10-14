import {CatmullRomCurve3,Vector3} from 'three';
export const ABYSS_JOURNEY={distanceScale:7.4,yaw:-.48,pitch:-.65,near:.3,far:1800} as const;
// The curve is parametrized by arc length. Height remains fixed, while the
// shallow lateral bow clears the foreground pillar before entering the well.
const curve=new CatmullRomCurve3([[95,28,150],[113,28,132],[120,28,95],[109,28,50],[92,28,-50],[92,28,-250],[92,28,-400]].map(p=>new Vector3(...p)),false,'centripetal');
curve.arcLengthDivisions=2048;curve.updateArcLengths();
export const ABYSS_ROUTE_LENGTH=curve.getLength();
const endpoint=curve.getPointAt(1),endTangent=curve.getTangentAt(1);
export function abyssRoutePoint(distance:number,out=new Vector3()):Vector3{
  const d=Math.max(0,distance);if(d<=ABYSS_ROUTE_LENGTH)return curve.getPointAt(d/ABYSS_ROUTE_LENGTH,out);
  return out.copy(endpoint).addScaledVector(endTangent,d-ABYSS_ROUTE_LENGTH);
}
export function abyssRouteStage(distance:number){return distance<20?'近景遮挡':distance<75?'经过巨柱':distance<120?'深井显露':'沿井边深入';}
