import {
  ConeGeometry,
  CylinderGeometry,
  BoxGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { mat, type Part } from '../../core/geometry';

/** Terse primitive helpers for placeholder props (all ~1 unit tall, base at y = 0, facing +z). */
type T = [number, number, number, number?, number?, number?, number?, number?, number?];

const at = (g: BufferGeometry, color: number, t: T): Part => ({
  geo: g,
  color,
  matrix: mat(
    t[0],
    t[1],
    t[2],
    t[3] ?? 0,
    t[4] ?? 0,
    t[5] ?? 0,
    t[6] ?? 1,
    t[7] ?? t[6] ?? 1,
    t[8] ?? t[6] ?? 1,
  ),
});

export const ball = (r: number, color: number, ...t: T): Part =>
  at(new SphereGeometry(r, 16, 12), color, t);
export const cyl = (r0: number, r1: number, h: number, color: number, ...t: T): Part =>
  at(new CylinderGeometry(r0, r1, h, 14), color, t);
export const cone = (r: number, h: number, color: number, ...t: T): Part =>
  at(new ConeGeometry(r, h, 12), color, t);
export const box = (w: number, h: number, d: number, color: number, ...t: T): Part =>
  at(new BoxGeometry(w, h, d), color, t);
export const ring = (r: number, tube: number, color: number, ...t: T): Part =>
  at(new TorusGeometry(r, tube, 8, 20), color, t);

/** Pair of cartoon eyes looking out along +z. */
export function eyes(x: number, y: number, z: number, r = 0.07): Part[] {
  return [
    ball(r, 0xffffff, x, y, z),
    ball(r, 0xffffff, -x, y, z),
    ball(r * 0.55, 0x1d1720, x, y, z + r * 0.6),
    ball(r * 0.55, 0x1d1720, -x, y, z + r * 0.6),
  ];
}
