import { Vector3 } from 'three';
import type { Pose } from '../core/cameraRig';
import type { Bud } from '../entities/Bud';

const OVERVIEW_POS = new Vector3(0, 27, 36);
const OVERVIEW_LOOK = new Vector3(0, -1.5, 0.5);

/**
 * Whole island framed in landscape 16:9 (~30° down tilt). Pulls back on narrower screens
 * (4:3 iPads) and moves in on wider phones (19.5:9) so buds stay big enough to tap (P3).
 */
export function overviewPose(aspect: number): Pose {
  const k = Math.min(1.5, Math.max(0.8, 16 / 9 / Math.max(aspect, 0.5)));
  const pos = OVERVIEW_LOOK.clone().add(OVERVIEW_POS.clone().sub(OVERVIEW_LOOK).multiplyScalar(k));
  return { pos, look: OVERVIEW_LOOK.clone() };
}

/** Horizontal unit vector from a bud toward the overview camera. */
export function towardViewer(p: Vector3): Vector3 {
  const v = OVERVIEW_POS.clone().sub(p);
  v.y = 0;
  return v.normalize();
}

/** Close-up rail for a bud (brief §4): in front of the bud, slightly above. */
export function budPose(bud: Bud): Pose {
  const head = bud.headWorld();
  const dir = towardViewer(head);
  return {
    pos: head
      .clone()
      .addScaledVector(dir, 15)
      .add(new Vector3(0, 4.5, 0)),
    look: head.clone().add(new Vector3(0, 0.6, 0)),
  };
}

/** Where Buzzy hovers beside a bud during its letter. */
export function buzzyBesideBud(bud: Bud): Vector3 {
  const head = bud.headWorld();
  const dir = towardViewer(head);
  const side = new Vector3(dir.z, 0, -dir.x);
  return head
    .addScaledVector(dir, 2.2)
    .addScaledVector(side, 4)
    .add(new Vector3(0, 0.4, 0));
}
