import type { Object3D, Vector3 } from 'three';
import {
  Color,
  ConeGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  SphereGeometry,
} from 'three';
import { mat, mergeColored, type Part } from '../core/geometry';
import { toon } from '../core/materials';
import { mulberry32 } from '../core/random';
import { palette } from '../core/theme';
import { GAZEBO_POS, ISLAND_RADIUS, pathCurve, POND } from '../scenes/layout';

const pathSamples = pathCurve.getSpacedPoints(60);

function freeSpot(x: number, z: number, keepOut: Vector3[]): boolean {
  if (Math.hypot(x, z) > ISLAND_RADIUS - 1.5) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.2) return false;
  if (Math.hypot(x - GAZEBO_POS.x, z - GAZEBO_POS.z) < 4.5) return false;
  if (pathSamples.some((p) => Math.hypot(p.x - x, p.z - z) < 2.2)) return false;
  return !keepOut.some((p) => Math.hypot(p.x - x, p.z - z) < 2.6);
}

/** Instanced flowers + grass tufts: 2 draw calls for ~110 little things. */
export function createDecor(keepOut: Vector3[]): Object3D[] {
  const rnd = mulberry32(7);
  const flowerParts: Part[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    flowerParts.push({
      geo: new SphereGeometry(0.16, 6, 4),
      color: 0xffffff,
      matrix: mat(Math.cos(a) * 0.18, 0.12, Math.sin(a) * 0.18, 0, 0, 0, 1, 0.5, 1),
    });
  }
  flowerParts.push({
    geo: new SphereGeometry(0.12, 6, 4),
    color: 0xffe9a8,
    matrix: mat(0, 0.16, 0),
  });
  const flowers = new InstancedMesh(mergeColored(flowerParts), toon('vertex'), 70);
  const tufts = new InstancedMesh(
    mergeColored([
      {
        geo: new ConeGeometry(0.08, 0.6, 4),
        color: palette.grassDark,
        matrix: mat(0, 0.3, 0, 0, 0, 0.2),
      },
      {
        geo: new ConeGeometry(0.08, 0.5, 4),
        color: palette.grassDark,
        matrix: mat(0.12, 0.25, 0.05, 0, 0, -0.3),
      },
      {
        geo: new ConeGeometry(0.08, 0.45, 4),
        color: palette.grass,
        matrix: mat(-0.1, 0.22, 0.06, 0.2, 0, 0.1),
      },
    ]),
    toon('vertex'),
    50,
  );
  const m = new Matrix4();
  const color = new Color();
  const place = (mesh: InstancedMesh, colored: boolean): void => {
    let n = 0;
    while (n < mesh.count) {
      const x = (rnd() * 2 - 1) * ISLAND_RADIUS;
      const z = (rnd() * 2 - 1) * ISLAND_RADIUS;
      if (!freeSpot(x, z, keepOut)) continue;
      const s = 0.8 + rnd() * 0.7;
      m.copy(mat(x, 0, z, 0, rnd() * 6.28, 0, s));
      mesh.setMatrixAt(n, m);
      if (colored)
        mesh.setColorAt(n, color.setHex(palette.petals[n % palette.petals.length] ?? 0xffffff));
      n++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  place(flowers, true);
  place(tufts, false);
  flowers.name = 'decor-flowers';
  tufts.name = 'decor-tufts';
  return [flowers, tufts];
}

/** Slowly drifting clouds (one instanced draw call). */
export class Clouds {
  readonly mesh: InstancedMesh;
  private readonly seeds: { x: number; y: number; z: number; s: number; v: number }[] = [];
  private readonly m = new Matrix4();

  constructor(count = 7) {
    const geo = mergeColored([
      { geo: new IcosahedronGeometry(2.2, 1), color: palette.cloud, matrix: mat(0, 0, 0) },
      { geo: new IcosahedronGeometry(1.6, 1), color: palette.cloud, matrix: mat(2.2, -0.3, 0.2) },
      { geo: new IcosahedronGeometry(1.5, 1), color: palette.cloud, matrix: mat(-2.1, -0.4, -0.1) },
      { geo: new IcosahedronGeometry(1.2, 1), color: palette.cloud, matrix: mat(0.8, 1.2, 0) },
    ]);
    this.mesh = new InstancedMesh(geo, toon('vertex'), count);
    this.mesh.name = 'clouds';
    this.mesh.frustumCulled = false;
    const rnd = mulberry32(3);
    for (let i = 0; i < count; i++) {
      this.seeds.push({
        x: rnd() * 90 - 45,
        y: 13 + rnd() * 9,
        z: -40 + rnd() * 50,
        s: 0.8 + rnd() * 0.8,
        v: 0.3 + rnd() * 0.4,
      });
    }
    this.update(0);
  }

  update(dt: number): void {
    this.seeds.forEach((c, i) => {
      c.x += c.v * dt;
      if (c.x > 50) c.x = -50;
      this.m.copy(mat(c.x, c.y, c.z, 0, 0, 0, c.s, c.s * 0.8, c.s));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
