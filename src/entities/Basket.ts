import { CylinderGeometry, Group, Mesh, TorusGeometry } from 'three';
import { mat, mergeColored, type Part } from '../core/geometry';
import { toon } from '../core/materials';
import { palette } from '../core/theme';
import { markShared } from '../core/dispose';
import type { BufferGeometry } from 'three';

let geo: BufferGeometry | null = null;

/** Woven picnic basket with a handle (placeholder until basket.glb). One merged draw call. */
function basketGeometry(): BufferGeometry {
  if (geo) return geo;
  const parts: Part[] = [
    {
      geo: new CylinderGeometry(1.15, 0.85, 1.0, 20, 1, true),
      color: 0xc98a4b,
      matrix: mat(0, 0.5),
    },
    { geo: new CylinderGeometry(1.05, 0.8, 0.9, 20), color: 0x7a4a2a, matrix: mat(0, 0.5) },
    {
      geo: new TorusGeometry(1.15, 0.09, 8, 28),
      color: 0xe0a35e,
      matrix: mat(0, 1.0, 0, Math.PI / 2),
    },
    {
      geo: new TorusGeometry(1.0, 0.07, 8, 24),
      color: 0xe0a35e,
      matrix: mat(0, 0.45, 0, Math.PI / 2),
    },
    { geo: new TorusGeometry(1.0, 0.07, 8, 24, Math.PI), color: 0xc98a4b, matrix: mat(0, 1.0, 0) },
    {
      geo: new CylinderGeometry(0.3, 0.3, 0.05, 12),
      color: palette.cloth,
      matrix: mat(0.75, 1.0, 0.35, 0.4, 0, -0.3),
    },
  ];
  geo = markShared(mergeColored(parts));
  return geo;
}

export class Basket {
  readonly root = new Group();
  readonly body: Mesh;

  constructor() {
    this.body = new Mesh(basketGeometry(), toon('vertex'));
    this.body.castShadow = true;
    this.root.add(this.body);
    this.root.name = 'basket';
  }
}
