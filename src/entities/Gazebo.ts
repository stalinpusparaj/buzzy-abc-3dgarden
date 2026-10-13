import { ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { mat, mergeColored, type Part } from '../core/geometry';
import { toon } from '../core/materials';
import { palette } from '../core/theme';
import { sphereCollider } from './colliders';

/** Sing-along stage: round gazebo with a flower-vine roof (one merged draw call). */
export class Gazebo {
  readonly root = new Group();
  readonly collider: Mesh;

  constructor() {
    const parts: Part[] = [
      { geo: new CylinderGeometry(3.2, 3.4, 0.5, 20), color: palette.wood, matrix: mat(0, 0.25) },
      { geo: new CylinderGeometry(2.6, 2.6, 0.12, 20), color: palette.path, matrix: mat(0, 0.55) },
      {
        geo: new ConeGeometry(3.8, 2.2, 16),
        color: palette.petals[2] ?? 0xb28dff,
        matrix: mat(0, 4.7),
      },
      { geo: new SphereGeometry(0.45, 10, 8), color: palette.buzzyBody, matrix: mat(0, 6.0) },
      {
        geo: new TorusGeometry(3.3, 0.22, 6, 24),
        color: palette.grass,
        matrix: mat(0, 3.65, 0, Math.PI / 2),
      },
    ];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      parts.push({
        geo: new CylinderGeometry(0.18, 0.22, 3.2, 8),
        color: 0xfff4e0,
        matrix: mat(Math.cos(a) * 2.7, 2.1, Math.sin(a) * 2.7),
      });
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const c = palette.petals[i % palette.petals.length] ?? 0xff8fa3;
      parts.push({
        geo: new SphereGeometry(0.28, 7, 5),
        color: c,
        matrix: mat(Math.cos(a) * 3.3, 3.75, Math.sin(a) * 3.3),
      });
    }
    const mesh = new Mesh(mergeColored(parts), toon('vertex'));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.root.name = 'gazebo';
    this.collider = sphereCollider(this.root, 4.6, 2.8);
  }
}
