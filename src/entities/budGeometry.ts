import type { BufferAttribute } from 'three';
import { CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three';
import { markShared } from '../core/dispose';
import { mat, mergeColored, type Part } from '../core/geometry';
import { palette } from '../core/theme';

export const STEM_HEIGHT = 2.2;
const PETALS = 6;
const CLOSED_TILT = -0.2;
const OPEN_TILT = 1.3;

function petalParts(color: number, tilt: number): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < PETALS; i++) {
    const yaw = (i / PETALS) * Math.PI * 2;
    const petal = new SphereGeometry(1, 10, 7);
    petal.applyMatrix4(mat(0, 0.8, 0, 0, 0, 0, 0.5, 0.82, 0.18)); // base at origin, flat face outward
    petal.applyMatrix4(mat(0, 0, 0.22, tilt)); // lean in (closed) or out (open)
    petal.applyMatrix4(mat(0, STEM_HEIGHT, 0, 0, yaw)); // around the head
    parts.push({ geo: petal, color });
  }
  parts.push({
    geo: new CylinderGeometry(0.55, 0.45, 0.22, 14),
    color: 0xffe066,
    matrix: mat(0, STEM_HEIGHT + 0.05),
  });
  parts.push({
    geo: new SphereGeometry(0.42, 10, 6),
    color: palette.stem,
    matrix: mat(0, STEM_HEIGHT - 0.15, 0, 0, 0, 0, 1, 0.6, 1),
  });
  return parts;
}

const petalCache = new Map<number, BufferGeometry>();

/**
 * Petals as ONE mesh with a morph target: influence 0 = tightly closed bud, 1 = full bloom.
 * Opening a bud is then a single uniform, and each bud costs one draw call for its head.
 */
export function petalGeometry(color: number): BufferGeometry {
  const cached = petalCache.get(color);
  if (cached) return cached;
  const closed = mergeColored(petalParts(color, CLOSED_TILT));
  const open = mergeColored(petalParts(color, OPEN_TILT));
  closed.morphAttributes.position = [open.getAttribute('position') as BufferAttribute];
  closed.morphAttributes.normal = [open.getAttribute('normal') as BufferAttribute];
  // Bounds must cover the open pose too or the bloom gets frustum-culled.
  open.computeBoundingSphere();
  if (open.boundingSphere) closed.boundingSphere = open.boundingSphere.clone();
  open.dispose();
  petalCache.set(color, markShared(closed));
  return closed;
}

let stem: BufferGeometry | null = null;

export function stemGeometry(): BufferGeometry {
  if (stem) return stem;
  const leaf = (side: number): Part => ({
    geo: new SphereGeometry(1, 8, 5),
    color: palette.grass,
    matrix: mat(side * 0.55, 0.7, 0, 0, 0, side * -0.9, 0.6, 0.18, 0.32),
  });
  stem = markShared(
    mergeColored([
      {
        geo: new CylinderGeometry(0.16, 0.24, STEM_HEIGHT, 8),
        color: palette.stem,
        matrix: mat(0, STEM_HEIGHT / 2),
      },
      leaf(1),
      leaf(-1),
      { geo: new CylinderGeometry(0.9, 1.05, 0.25, 14), color: palette.soil, matrix: mat(0, 0.1) },
    ]),
  );
  return stem;
}
