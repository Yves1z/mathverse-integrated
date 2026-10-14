export type ReferenceBeam = { center: [number, number, number]; size: [number, number, number]; kind: 'primary' | 'layer' | 'joint' };
export const REFERENCE_VIEW = { eye: [5, 8, 110] as [number, number, number], yaw: .10, pitch: .27, fov: 58, far: 700 };

// Each opening is a deep, solid assembly. Three orthogonal families share a
// material and section hierarchy; no frame is an isolated wire cage.
export function createReferenceBeams(): ReferenceBeam[] {
  const beams: ReferenceBeam[] = [];
  const box = (center: ReferenceBeam['center'], size: ReferenceBeam['size'], kind: ReferenceBeam['kind'] = 'primary') => beams.push({ center, size, kind });
  const opening = (center: number[], width: number, height: number, axis: 'z'|'x'|'y', layers = 8, pitch = 4.6) => {
    const transform = (p: number[]): [number,number,number] => axis === 'z' ? [center[0]+p[0],center[1]+p[1],center[2]+p[2]] : axis === 'x' ? [center[0]+p[2],center[1]+p[1],center[2]-p[0]] : [center[0]+p[0],center[1]+p[2],center[2]-p[1]];
    const size = (s: number[]): [number,number,number] => axis === 'z' ? [s[0],s[1],s[2]] : axis === 'x' ? [s[2],s[1],s[0]] : [s[0],s[2],s[1]];
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
  opening([24,50,-24],70,62,'z',9);
  opening([-43,90,-38],66,60,'z',8);
  opening([-12,-47,-58],68,58,'z',8);
  opening([48,119,-110],66,64,'z',7);
  opening([-31,27,-126],56,52,'z',7);
  opening([-68,13,-115],62,72,'z',7);
  opening([133,68,-90],56,76,'z',7);
  opening([35,-38,-175],64,62,'z',6);
  opening([-6,56,-210],62,75,'z',6);
  opening([74,87,-240],70,65,'z',6);
  opening([-20,-30,-230],64,64,'z',6);
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
  return beams;
}
