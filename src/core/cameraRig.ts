import { Vector3, type PerspectiveCamera } from 'three';
import { motion } from './a11y';
import { ease, type Scope } from './tween';

export interface Pose {
  pos: Vector3;
  look: Vector3;
}

/**
 * Guided camera (brief P6): no free orbit or zoom. The camera only moves by tweening between
 * poses or following a rail, so a child can never get lost.
 */
export class CameraRig {
  private readonly pos = new Vector3();
  private readonly look = new Vector3();
  private move: Scope;

  constructor(
    readonly camera: PerspectiveCamera,
    private readonly scope: Scope,
  ) {
    this.move = scope.child();
  }

  current(): Pose {
    return { pos: this.pos.clone(), look: this.look.clone() };
  }

  set(p: Pose): void {
    this.move.kill();
    this.move = this.scope.child();
    this.pos.copy(p.pos);
    this.look.copy(p.look);
    this.apply();
  }

  /** Tween to a pose (brief §4: 1.0 s, easeInOutCubic; halved for reduced motion). */
  moveTo(p: Pose, duration = 1.0): Promise<void> {
    this.move.kill();
    this.move = this.scope.child();
    const fromPos = this.pos.clone();
    const fromLook = this.look.clone();
    return this.move.tween({
      duration: duration * motion.cameraScale,
      ease: ease.inOutCubic,
      update: (k) => {
        this.pos.lerpVectors(fromPos, p.pos, k);
        this.look.lerpVectors(fromLook, p.look, k);
        this.apply();
      },
    });
  }

  /** Drive the camera directly every frame (sing-along rail). Cancels any tween. */
  follow(p: Pose): void {
    this.move.kill();
    this.move = this.scope.child();
    this.pos.copy(p.pos);
    this.look.copy(p.look);
    this.apply();
  }

  private apply(): void {
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
