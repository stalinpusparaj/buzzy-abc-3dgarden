import { CatmullRomCurve3, Vector3 } from 'three';

/** Garden layout (brief §4): ~40-unit floating island, S-curve path, 6 buds, gazebo at the end. */
export const ISLAND_RADIUS = 20;

export const pathCurve = new CatmullRomCurve3(
  [
    [1.5, 19],
    [-3.5, 14],
    [-8, 8.5],
    [-6.5, 2.5],
    [0, -0.5],
    [7.5, -3],
    [8.5, -8],
    [3.5, -11.5],
    [0, -12.5],
  ].map(([x, z]) => new Vector3(x, 0, z)),
  false,
  'catmullrom',
  0.5,
);

export const GAZEBO_POS = new Vector3(0, 0, -15);

/** Bud slots along the path: curve parameter + side (−1 left, +1 right), front to back. */
const BUD_SLOTS: [number, number][] = [
  [0.1, 1],
  [0.25, -1],
  [0.41, 1],
  [0.56, -1],
  [0.72, 1],
  [0.86, -1],
];

export function budPositions(): Vector3[] {
  const up = new Vector3(0, 1, 0);
  return BUD_SLOTS.map(([t, side]) => {
    const p = pathCurve.getPointAt(t);
    const n = new Vector3().crossVectors(pathCurve.getTangentAt(t), up).normalize();
    return p.addScaledVector(n, side * 3.4);
  });
}

export const TREES: [number, number, number][] = [
  [-14, -7, 1.2],
  [14, 7, 1.0],
  [-11, -13, 0.9],
  [15, -5, 1.1],
  [-16, 4, 1.0],
  [11, -13, 0.85],
  [-4, 16.5, 0.7],
];

export const ROCKS: [number, number, number][] = [
  [10, 13, 1.1],
  [-15, 11, 0.9],
  [17, 1, 0.8],
  [-9, -3, 0.6],
  [4, 9, 0.5],
];

export const BUSHES: [number, number, number][] = [
  [-12, 14, 1],
  [16, 10, 0.9],
  [-17, -2, 1.1],
  [6, -16, 0.9],
  [-6, -17, 0.9],
  [13, 0, 0.7],
];

export const POND = { x: 9, z: 7.5, r: 3 };

/** Where Buzzy hovers in the garden when nothing is happening. */
export const BUZZY_HOME = new Vector3(6.5, 4.6, 14.5);
