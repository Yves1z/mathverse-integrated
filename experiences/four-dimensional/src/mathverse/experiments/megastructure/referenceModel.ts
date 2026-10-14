export type ReferenceBeam = { center: [number, number, number]; size: [number, number, number]; kind: 'primary' | 'layer' | 'joint'; seed?: number; assembly?: string };
export const REFERENCE_VIEW = { eye: [5, 8, 110] as [number, number, number], yaw: .10, pitch: .27, fov: 58, far: 700 };
export const REFERENCE_JOURNEY = { pitch: 600, behind: 1, ahead: 2, clearance: 3.2 } as const;

// Each opening is a deep, solid assembly. Three orthogonal families share a
// material and section hierarchy; no frame is an isolated wire cage.
export function createReferenceBeams(extended = false): ReferenceBeam[] {
  const beams: ReferenceBeam[] = [];
  const box = (center: ReferenceBeam['center'], size: ReferenceBeam['size'], kind: ReferenceBeam['kind'] = 'primary') => beams.push({ center, size, kind });
  const opening = (center: number[], width: number, height: number, axis: 'z'|'x'|'y'|'back', layers = 8, pitch = 4.6) => {
    const transform = (p: number[]): [number,number,number] => axis === 'z' || axis === 'back' ? [center[0]+p[0],center[1]+p[1],center[2]+p[2]*(axis==='back'?-1:1)] : axis === 'x' ? [center[0]+p[2],center[1]+p[1],center[2]-p[0]] : [center[0]+p[0],center[1]+p[2],center[2]-p[1]];
    const size = (s: number[]): [number,number,number] => axis === 'z' || axis === 'back' ? [s[0],s[1],s[2]] : axis === 'x' ? [s[2],s[1],s[0]] : [s[0],s[2],s[1]];
    const frame = (z: number, thickness: number, depth: number, kind: ReferenceBeam['kind']) => {
      box(transform([-width/2,0,z]),size([thickness,height+thickness,depth]),kind);
      box(transform([width/2,0,z]),size([thickness,height+thickness,depth]),kind);
      box(transform([0,height/2,z]),size([width-thickness,thickness,depth]),kind);
      box(transform([0,-height/2,z]),size([width-thickness,thickness,depth]),kind);
    };
    frame(0,6.4,12,'primary');
    for(let i=1;i<=layers;i++) frame(-i*pitch,2.3,2.7,'layer');
    // Solid corner spines connect every lamella to its host frame.
    for(const x of [-width/2,width/2]) for(const y of [-height/2,height/2])
      box(transform([x,y,-layers*pitch/2]),size([4.2,4.2,layers*pitch+10]),'joint');
  };
  opening([-57,18,40],64,74,'z',9);
  const apertureStart=beams.length;
  opening([24,50,-24],70,62,'z',9);
  beams.slice(apertureStart).forEach(b=>b.assembly='depth-exchange');
  opening([-43,90,-38],66,60,'z',8);
  opening([-12,-47,-58],68,58,'z',8);
  opening([48,119,-110],66,64,'z',7);
  opening([-31,27,-126],56,52,'z',7);
  opening([-68,13,-115],62,72,'z',7);
  opening([133,68,-90],56,76,'z',7);
  opening([35,-38,-175],64,62,'z',6);
  opening([-6,56,-210],62,75,'z',6);
  opening([74,87,-240],70,65,'z',6);
  opening([-20,extended?-34:-30,-230],64,64,'z',6);
  opening([95,18,-58],86,66,'x',8);
  opening([-103,70,-96],80,66,'x',8);
  opening([4,124,-45],110,90,'y',8);
  opening([8,-108,-104],108,84,'y',6);
  // Long, cropped members establish an inhabitable scale at the first view.
  box([-5,26,15],[300,7.8,16]);
  box([-2,104,-22],[178,8.8,17]);
  box([71,50,8],[8,162,18]);
  box([-91,40,20],[9,190,18]);
  // Solid parallel blades make architectural masses between the larger
  // apertures. Their deep sections and small gaps replace empty wire walls.
  for(let i=0;i<11;i++) box([-86+i*5.8,22,-56],[2.7,148,30],'layer');
  for(let i=0;i<12;i++) box([84+i*6.0,57,-124],[3,190,38],'layer');
  for(let i=0;i<12;i++) box([-72+i*5.8,104,-124],[2.6,90,26],'layer');
  if(extended){
    opening([-20,65,155],96,98,'back',9);
    opening([76,105,220],76,76,'back',8);
    opening([-62,-25,185],68,66,'back',7);
    opening([32,12,250],70,64,'back',7);
    opening([-124,25,72],102,88,'x',8);
    opening([147,42,76],106,96,'x',8);
    opening([-16,147,115],104,106,'y',8);
    opening([-238,52,16],112,98,'x',10);
    opening([-203,133,22],80,74,'x',8);
    opening([254,64,28],110,98,'x',9);
    opening([25,238,20],126,144,'y',8);
    opening([-95,187,55],100,126,'y',7);
    opening([-12,72,280],80,88,'back',8);
    for(let i=0;i<11;i++)box([-92+i*6.4,89,247],[2.8,116,29],'layer');
    for(let i=0;i<11;i++)box([63+i*6.2,46,201],[3.0,148,28],'layer');
    // Adjacent bays share these exact endpoints. The route passes through
    // their empty interior, rather than hiding solids near the viewer.
    for(const x of [-104,102])box([x,152,-90],[9,9,REFERENCE_JOURNEY.pitch]);
    for(const x of [-100,110])box([x,-135,-90],[9,9,REFERENCE_JOURNEY.pitch]);
  }
  return beams;
}

export function journeyCell(distance: number) { return Math.floor(distance / REFERENCE_JOURNEY.pitch); }
export function journeyCells(first: number) { return Array.from({length:4},(_,i)=>first-1+i); }
export function createJourneyBeams(first: number, exchanging = false): ReferenceBeam[] {
  const source=createReferenceBeams(true);
  return journeyCells(first).flatMap(cell=>source.flatMap((b,i)=>exchanging&&cell===0&&b.assembly==='depth-exchange'?[]:[({...b,center:[b.center[0],b.center[1],b.center[2]-cell*REFERENCE_JOURNEY.pitch] as [number,number,number],seed:i*.618+cell*73.19})]));
}

// Exact clearance from the center line to the conservative solid-box bounds.
export function referenceRouteClearance(beam: ReferenceBeam) {
  const [x,y]=REFERENCE_VIEW.eye;
  return Math.hypot(Math.max(0,Math.abs(x-beam.center[0])-beam.size[0]/2),Math.max(0,Math.abs(y-beam.center[1])-beam.size[1]/2));
}
