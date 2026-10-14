import type {ReferenceBeam} from '../megastructure/referenceModel.ts';
export const ABYSS_POSES={entry:{label:'入口遮挡',eye:[95,28,150],target:[-20,-70,-100]},reveal:{label:'深井显露',eye:[109,28,50],target:[-10,-210,-120]},side:{label:'侧向环顾',eye:[109,28,50],target:[-540,60,-160]},up:{label:'抬头',eye:[109,28,50],target:[-15,600,-130]},down:{label:'俯视',eye:[109,28,50],target:[-50,-580,-170]},back:{label:'回望',eye:[109,28,50],target:[400,120,620]}} as const;
export type AbyssPose=keyof typeof ABYSS_POSES;
export function abyssLook(pose:AbyssPose){const {eye,target}=ABYSS_POSES[pose],dx=target[0]-eye[0],dy=target[1]-eye[1],dz=target[2]-eye[2];return{yaw:Math.atan2(dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))};}
export function abyssClearance(b:ReferenceBeam,p:readonly number[]){return Math.hypot(...p.map((v,i)=>Math.max(0,Math.abs(v-b.center[i])-b.size[i]/2)));}
export function createAbyssBeams(){const beams:ReferenceBeam[]=[];let assembly='';const box=(center:number[],size:number[],kind:ReferenceBeam['kind']='primary')=>beams.push({center:center as [number,number,number],size:size as [number,number,number],kind,seed:beams.length*.618,assembly});
  assembly='deep-well';for(const x of [-168,168])for(const z of [68,-245])box([x,0,z],[22,1400,26]);
  const rim=(y:number,t:number,kind:ReferenceBeam['kind'])=>{for(const z of [68,-245])box([0,y,z],[358,t,30],kind);for(const x of [-168,168])box([x,y,-88.5],[24,t,343],kind);};
  for(const [y,n]of [[-610,3],[-405,6],[-260,4],[-95,8],[80,4],[235,6],[470,3],[665,2]]){rim(y,13,'primary');for(let i=1;i<=n;i++)rim(y-i*5.5,3.2,'layer');}
  assembly='horizontal-libraries';const wing=(c:number[],s:number[],n:number)=>{box(c,s);for(let i=1;i<=n;i++)box([c[0],c[1]-i*10,c[2]],[s[0]-i*12,3.5,s[2]-i*8],'layer');for(const x of [-1,1])box([c[0]+x*(s[0]/2-12),c[1]-n*5,c[2]],[10,n*10+18,s[2]],'joint');};
  wing([315,82,25],[310,17,172],5);wing([-340,-120,-95],[370,20,210],6);wing([-265,245,-55],[210,19,175],4);wing([260,-340,-130],[210,22,260],3);wing([-10,-230,-360],[430,18,230],5);
  assembly='crossing-supports';wing([94,-105,-50],[148,18,58],3);box([0,-440,-80],[336,15,48]);box([126,185,-87],[54,20,310]);
  assembly='foreground';box([83,0,135],[16,900,10]);box([230,80,118],[250,18,76]);box([-170,95,115],[250,18,70]);
  const opening=(c:number[],w:number,h:number,axis:'z'|'x'|'back',layers:number,pitch:number)=>{const dir=axis==='back'?1:axis==='x'?(c[0]<0?-1:1):-1;
    const transform=(p:number[])=>axis==='x'?[c[0]+p[2]*dir,c[1]+p[1],c[2]+p[0]]:[c[0]+p[0],c[1]+p[1],c[2]+p[2]*dir];const size=(s:number[])=>axis==='x'?[s[2],s[1],s[0]]:s;
    for(let j=0;j<=layers;j++){const t=j===0?18:5,z=j*pitch;for(const x of [-w/2,w/2])box(transform([x,0,z]),size([t,h+t,26]),j===0?'primary':'layer');for(const y of [-h/2,h/2])box(transform([0,y,z]),size([w-t,t,26]),j===0?'primary':'layer');}
    for(const x of [-w/2,w/2])for(const y of [-h/2,h/2])box(transform([x,y,layers*pitch/2]),size([12,12,layers*pitch+26]),'joint');};
  assembly='side-depth';opening([575,0,-120],245,330,'x',7,19);opening([-540,80,-160],280,350,'x',6,22);opening([540,100,455],260,370,'x',5,23);
  assembly='far-depth';opening([-20,-30,-675],500,720,'z',6,24);opening([330,265,-470],260,320,'z',4,22);opening([-355,-365,-540],270,320,'z',4,25);
  assembly='rear-depth';opening([-70,70,685],530,720,'back',5,25);wing([330,115,455],[360,22,195],4);wing([-355,270,450],[300,23,185],3);
  return beams;
}


