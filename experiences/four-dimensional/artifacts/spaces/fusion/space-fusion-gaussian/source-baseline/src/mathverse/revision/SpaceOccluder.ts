import { Box3, Matrix4, Object3D, Ray, Vector3, type Intersection, type Raycaster } from 'three';

export type BeamBounds = { matrix: Matrix4; inverse: Matrix4; box: Box3 };
export function createBeamBounds(): BeamBounds { return { matrix: new Matrix4(), inverse: new Matrix4(), box: new Box3() }; }

// The display mesh sizes its beams in the vertex shader, so its unit geometry
// cannot provide correct CPU picking. Test conservative oriented beam boxes.
export class SpaceOccluder extends Object3D {
  records: BeamBounds[] = [];
  private localRay = new Ray();
  private point = new Vector3();
  private unit = new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5));
  constructor() { super(); this.name = 'space-beam-occluder'; this.userData.mathOccluder = true; }
  override raycast(raycaster: Raycaster, intersections: Intersection[]) {
    for (const record of this.records) {
      if (!raycaster.ray.intersectsBox(record.box)) continue;
      this.localRay.copy(raycaster.ray).applyMatrix4(record.inverse);
      if (!this.localRay.intersectBox(this.unit, this.point)) continue;
      this.point.applyMatrix4(record.matrix);
      const distance = this.point.distanceTo(raycaster.ray.origin);
      if (distance < raycaster.near || distance > raycaster.far) continue;
      intersections.push({ distance, point: this.point.clone(), object: this });
    }
  }
}
