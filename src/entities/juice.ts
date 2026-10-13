import type { Object3D } from 'three';
import { ease, lerp, type Scope } from '../core/tween';

/** Squash-and-stretch with easeOutBack overshoot: the default response to every tap (brief §4). */
export async function squash(
  scope: Scope,
  obj: Object3D,
  strength = 0.25,
  base = 1,
): Promise<void> {
  const wide = 1 + strength * 0.6;
  const flat = 1 - strength;
  await scope.tween({
    duration: 0.07,
    ease: ease.outQuad,
    update: (k) =>
      obj.scale.set(base * lerp(1, wide, k), base * lerp(1, flat, k), base * lerp(1, wide, k)),
  });
  await scope.tween({
    duration: 0.38,
    ease: ease.outBack,
    update: (k) =>
      obj.scale.set(base * lerp(wide, 1, k), base * lerp(flat, 1, k), base * lerp(wide, 1, k)),
  });
}

/** Scale from 0 to `base` with overshoot. */
export function popIn(
  scope: Scope,
  obj: Object3D,
  base = 1,
  duration = 0.45,
  delay = 0,
): Promise<void> {
  obj.scale.setScalar(0.0001);
  return scope.tween({
    duration,
    delay,
    ease: ease.outBack,
    update: (k) => obj.scale.setScalar(Math.max(base * k, 0.0001)),
  });
}

/** Soft side-to-side wobble for a wrong answer (brief P4: no red X, just a wobble). */
export function wobble(scope: Scope, obj: Object3D, amount = 0.35): Promise<void> {
  const z0 = obj.rotation.z;
  return scope.tween({
    duration: 0.5,
    ease: ease.linear,
    update: (k) => {
      obj.rotation.z = z0 + Math.sin(k * Math.PI * 4) * amount * (1 - k);
    },
  });
}
