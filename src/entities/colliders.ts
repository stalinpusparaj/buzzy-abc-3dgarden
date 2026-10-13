import { BoxGeometry, Mesh, MeshBasicMaterial, SphereGeometry, type Object3D } from 'three';
import { markShared } from '../core/dispose';

/**
 * Invisible hit colliders (brief P3 + §7.3): raycasts hit these simple shapes, never the
 * visual meshes. `visible = false` keeps them out of the draw calls; raycasting still works.
 */
const hitMaterial = markShared(new MeshBasicMaterial({ visible: false }));
const unitSphere = markShared(new SphereGeometry(1, 10, 8));
const unitBox = markShared(new BoxGeometry(1, 1, 1));

export function sphereCollider(owner: Object3D, radius: number, y = 0): Mesh {
  const m = new Mesh(unitSphere, hitMaterial);
  m.scale.setScalar(radius);
  m.position.y = y;
  m.visible = false;
  m.userData.hitOwner = owner;
  m.name = 'collider';
  owner.add(m);
  return m;
}

export function boxCollider(owner: Object3D, w: number, h: number, d: number, y = h / 2): Mesh {
  const m = new Mesh(unitBox, hitMaterial);
  m.scale.set(w, h, d);
  m.position.y = y;
  m.visible = false;
  m.userData.hitOwner = owner;
  m.name = 'collider';
  owner.add(m);
  return m;
}
