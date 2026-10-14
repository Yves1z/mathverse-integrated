import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Box3, Group, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Raycaster, Vector3 } from 'three';
import { SPACE_MOUNTS, mountPose, mountPoint, mountSupports, spaceContentLayout } from '../../../src/mathverse/experiments/layered/spaceContent.ts';
import { SpaceOccluder, createBeamBounds } from '../../../src/mathverse/shared/rendering/SpaceOccluder.ts';
import { createContentRuntime } from '../../../src/mathverse/content/runtime.ts';
import { pickNode } from '../../../src/mathverse/content/picking.ts';
let maxStep = 0;
for (const mount of SPACE_MOUNTS) {
  let previous;
  for (let i = 0; i <= 104; i++) {
    const angle = i * .52 / 104, pose = mountPose(mount, mount.section, angle);
    assert.ok([...pose.position, ...pose.rotation, ...pose.scale].every(Number.isFinite));
    assert.ok(pose.scale.every(v => v > .2 && v < 4));
    if (previous) maxStep = Math.max(maxStep, new Vector3(...pose.position).distanceTo(new Vector3(...previous)));
    previous = pose.position;
    for (const point of mountSupports(mount)) assert.ok(mountPoint(mount, mount.section, angle, point).every(Number.isFinite));
    const recycled = mountPose(mount, mount.section + 3, angle);
    assert.ok(Math.abs(recycled.position[2] - pose.position[2] + 144) < 1e-8);
    assert.equal(recycled.position[0], pose.position[0]); assert.equal(recycled.position[1], pose.position[1]);
  }
}
assert.ok(maxStep < .2);
const runtime = createContentRuntime(spaceContentLayout()), node = runtime.nodes.get('euler-identity');
node.group = new Group(); node.group.add(new Mesh(new PlaneGeometry(6, 4), new MeshBasicMaterial()));
node.group.position.set(0, 0, -8); node.group.updateMatrixWorld(true); node.position.set(0, 0, -8); node.sphere.radius = 4;
node.discovered = node.onScreen = true; node.alpha = 1;
const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
assert.equal(pickNode(ray, runtime), 'euler-identity');
const blocker = new SpaceOccluder(), record = createBeamBounds(), dummy = new Object3D();
function moveBlock(x, z) {
  dummy.position.set(x, 0, z); dummy.rotation.z = .4; dummy.scale.set(.8, 12, .8); dummy.updateMatrix();
  record.matrix.copy(dummy.matrix); record.inverse.copy(dummy.matrix).invert();
  record.box.copy(new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5)).applyMatrix4(record.matrix));
}
moveBlock(0, -4); blocker.records = [record]; runtime.occluders = [blocker];
assert.equal(pickNode(ray, runtime), null); assert.ok(runtime.blockedCount > 0);
moveBlock(9, -4); assert.equal(pickNode(ray, runtime), 'euler-identity');
moveBlock(0, -12); assert.equal(pickNode(ray, runtime), 'euler-identity');
const report = { checkedAt: new Date().toISOString(), windows: SPACE_MOUNTS.length, foldSamples: 105, maximumMountStep: maxStep,
  checks: { finiteMountedProjection: true, continuousMountMotion: true, recyclePreservesPose: true, foregroundBeamBlocksPicking: true, missDoesNotBlock: true, backgroundBeamDoesNotBlock: true },
  scope: 'Mounted display frames use a local tangent plane inside the projected aperture; they are not exact projective images of four-dimensional solid windows.' };
await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/layered/space-revision-a-worlds/model-verification.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
