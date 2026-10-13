import {
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  Mesh,
  type Group,
} from 'three';
import { mat, mergeColored, ribbon, type Part } from '../core/geometry';
import { toon } from '../core/materials';
import { palette } from '../core/theme';
import { BUSHES, ISLAND_RADIUS, pathCurve, POND, ROCKS, TREES } from '../scenes/layout';

const R = ISLAND_RADIUS;

function treeParts(x: number, z: number, s: number): Part[] {
  return [
    {
      geo: new CylinderGeometry(0.35, 0.5, 2.4, 7),
      color: palette.trunk,
      matrix: mat(x, 1.2 * s, z, 0, 0, 0, s),
    },
    {
      geo: new IcosahedronGeometry(1.9, 1),
      color: palette.grassDark,
      matrix: mat(x, 3.4 * s, z, 0, 0, 0, s),
    },
    {
      geo: new IcosahedronGeometry(1.3, 1),
      color: palette.grass,
      matrix: mat(x + 0.9 * s, 4.3 * s, z + 0.3 * s, 0, 0, 0, s),
    },
    {
      geo: new IcosahedronGeometry(1.2, 1),
      color: palette.grass,
      matrix: mat(x - 0.8 * s, 4.1 * s, z - 0.4 * s, 0, 0, 0, s),
    },
  ];
}

/**
 * All static scenery (island, path, pond, trees, rocks, bushes) merged into ONE mesh with
 * vertex colours: one draw call (brief §7.4 "merge static scenery").
 */
export function createIsland(): Mesh {
  const parts: Part[] = [
    // Grass top (y = 0 surface) and floating rock underside.
    {
      geo: new CylinderGeometry(R, R - 0.4, 1.2, 56, 1),
      color: palette.grass,
      matrix: mat(0, -0.6),
    },
    {
      geo: new CylinderGeometry(R - 0.4, R - 3, 2.6, 40, 1),
      color: palette.soil,
      matrix: mat(0, -2.5),
    },
    {
      geo: new ConeGeometry(R - 3, 9, 28, 1),
      color: palette.rock,
      matrix: mat(0, -8.3, 0, Math.PI),
    },
    { geo: new ConeGeometry(4, 4, 10), color: palette.rock, matrix: mat(6, -12.5, 3, Math.PI) },
    { geo: ribbon(pathCurve, 2.6, 80, 0.04), color: palette.path },
    // Pond with a sandy rim.
    {
      geo: new CylinderGeometry(POND.r + 0.5, POND.r + 0.5, 0.1, 24),
      color: palette.path,
      matrix: mat(POND.x, 0.03, POND.z),
    },
    {
      geo: new CylinderGeometry(POND.r, POND.r, 0.1, 24),
      color: palette.water,
      matrix: mat(POND.x, 0.07, POND.z),
    },
  ];
  for (const [x, z, s] of TREES) parts.push(...treeParts(x, z, s));
  for (const [x, z, s] of ROCKS) {
    parts.push({
      geo: new DodecahedronGeometry(1, 0),
      color: palette.rock,
      matrix: mat(x, 0.35 * s, z, 0.3, x, 0, s * 1.2, s * 0.75, s),
    });
  }
  for (const [x, z, s] of BUSHES) {
    parts.push({
      geo: new IcosahedronGeometry(1.1, 1),
      color: palette.grassDark,
      matrix: mat(x, 0.6 * s, z, 0, 0, 0, s * 1.3, s, s),
    });
    parts.push({
      geo: new IcosahedronGeometry(0.8, 1),
      color: palette.grass,
      matrix: mat(x + 0.8 * s, 0.5 * s, z + 0.4 * s, 0, 0, 0, s),
    });
  }
  const mesh = new Mesh(mergeColored(parts), toon('vertex'));
  mesh.name = 'island';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

/** Attach the island to a parent and return it (keeps World.ts terse). */
export function addIsland(parent: Group): Mesh {
  const m = createIsland();
  parent.add(m);
  return m;
}
