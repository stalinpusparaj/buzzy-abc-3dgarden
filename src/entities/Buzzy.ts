import { CatmullRomCurve3, Group, Vector3, type Camera, type Mesh, type Object3D } from 'three';
import { ease, lerp, type Scope } from '../core/tween';
import { createBlobShadow } from './BlobShadow';
import { buildBuzzy, type BuzzyParts } from './buzzyModel';
import { sphereCollider } from './colliders';

const tmp = new Vector3();
const tmp2 = new Vector3();

function angleLerp(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/**
 * Buzzy (placeholder until Phase 6). Animations from brief §4: idle bob, fly-to with banking,
 * celebrate, point, yawn; wings flap at ~12 Hz and the pupils track the camera.
 */
export class Buzzy {
  readonly root = new Group(); // world position + yaw
  readonly shadow: Mesh;
  readonly collider: Mesh;
  private readonly rig = new Group(); // bob, jump, bank, lean, spin
  private readonly parts: BuzzyParts;
  private move: Scope;
  private act: Scope;
  private t = 0;
  private yaw = 0;
  private bank = 0;
  private jump = 0;
  private lean = new Vector3();
  private blinkIn = 2.5;
  private faceTarget: Vector3 | null = null;
  private eyesBusy = false;
  private followTarget: Vector3 | null = null;
  private baseScale: number;
  flying = false;
  sleepy = false;
  groundY = 0;

  constructor(
    private readonly scope: Scope,
    private readonly camera: Camera,
    scale = 1,
  ) {
    this.parts = buildBuzzy();
    const p = this.parts;
    p.body.add(p.eyes, p.pupils, p.wingL, p.wingR);
    this.rig.add(p.body);
    this.root.add(this.rig);
    this.root.scale.setScalar(scale);
    this.baseScale = scale;
    this.root.name = 'buzzy';
    this.shadow = createBlobShadow(1.8 * scale);
    this.collider = sphereCollider(this.root, 1.5, 0);
    this.move = scope.child();
    this.act = scope.child();
    scope.onFrame((dt) => this.update(dt));
  }

  get position(): Vector3 {
    return this.root.position;
  }

  /** Attach to a parent scene (shadow lives in world space, beside Buzzy). */
  addTo(parent: Object3D): void {
    parent.add(this.root, this.shadow);
  }

  teleport(p: Vector3): void {
    this.followTarget = null;
    this.move.kill();
    this.move = this.scope.child();
    this.flying = false;
    this.root.position.copy(p);
  }

  /** Smoothly hover after a moving target every frame (trace: follow the finger). */
  follow(target: Vector3 | null): void {
    if (target) {
      this.move.kill();
      this.move = this.scope.child();
      this.flying = false;
    }
    this.followTarget = target ? target.clone() : null;
  }

  /** Shrink/grow (mini-games use a smaller Buzzy so she never hides the play area). */
  setScale(k: number, duration = 0.5): Promise<void> {
    const from = this.root.scale.x;
    const to = this.baseScale * k;
    return this.scope.tween({
      duration,
      update: (e) => this.root.scale.setScalar(from + (to - from) * e),
    });
  }

  lookAt(target: Vector3 | null): void {
    this.faceTarget = target ? target.clone() : null;
  }

  /** Arc along a CatmullRom curve, banking into turns (brief §4: 1.2 s). */
  flyTo(target: Vector3, duration = 1.2): Promise<void> {
    this.followTarget = null;
    this.move.kill();
    this.move = this.scope.child();
    const from = this.root.position.clone();
    const dist = from.distanceTo(target);
    if (dist < 0.05) return Promise.resolve();
    const mid = from.clone().lerp(target, 0.5);
    mid.y = Math.max(from.y, target.y) + 0.8 + dist * 0.12;
    const curve = new CatmullRomCurve3([from, mid, target.clone()]);
    this.flying = true;
    let lastYaw = this.yaw;
    return this.move
      .tween({
        duration,
        ease: ease.inOutSine,
        update: (k) => {
          curve.getPointAt(k, this.root.position);
          const tan = curve.getTangentAt(Math.min(k, 0.999), tmp);
          if (Math.hypot(tan.x, tan.z) > 0.15) {
            const want = Math.atan2(tan.x, tan.z);
            this.yaw = angleLerp(this.yaw, want, 0.25);
          }
          const turn = angleLerp(0, this.yaw - lastYaw, 1);
          lastYaw = this.yaw;
          this.bank = lerp(this.bank, Math.max(-0.6, Math.min(0.6, -turn * 12)), 0.2);
        },
      })
      .then(() => {
        this.flying = false;
      });
  }

  /** 360° spin plus a small jump. */
  celebrate(): Promise<void> {
    this.act.kill();
    this.act = this.scope.child();
    return this.act
      .tween({
        duration: 0.9,
        ease: ease.outCubic,
        update: (k) => {
          this.rig.rotation.y = k * Math.PI * 2;
          this.jump = Math.sin(k * Math.PI) * 0.9;
        },
      })
      .then(() => {
        this.rig.rotation.y = 0;
      });
  }

  /** Lean toward a hint target, hold, return. */
  async point(target: Vector3): Promise<void> {
    this.act.kill();
    const s = (this.act = this.scope.child());
    this.lookAt(target);
    const dir = tmp2.copy(target).sub(this.root.position).normalize();
    const want = new Vector3(Math.max(-0.5, Math.min(0.5, dir.y * 0.6)) + 0.35, 0, 0);
    await s.tween({
      duration: 0.25,
      ease: ease.outBack,
      update: (k) => this.lean.copy(want).multiplyScalar(k),
    });
    await s.wait(1.1);
    await s.tween({ duration: 0.3, update: (k) => this.lean.copy(want).multiplyScalar(1 - k) });
    this.lookAt(null);
  }

  /** Big stretch, eyes close, settle (brief P7). */
  async yawn(): Promise<void> {
    this.act.kill();
    const s = (this.act = this.scope.child());
    const eyes = this.parts.eyes;
    this.eyesBusy = true;
    await s.tween({
      duration: 0.8,
      ease: ease.inOutSine,
      update: (k) => {
        this.rig.scale.set(1 - 0.08 * k, 1 + 0.15 * k, 1 - 0.08 * k);
        eyes.scale.y = 1 - 0.85 * k;
        this.lean.x = -0.3 * k;
      },
    });
    await s.wait(0.9);
    await s.tween({
      duration: 0.6,
      update: (k) => {
        this.rig.scale.set(0.92 + 0.08 * k, 1.15 - 0.15 * k, 0.92 + 0.08 * k);
        eyes.scale.y = 0.15 + (this.sleepy ? 0.35 : 0.85) * k;
        this.lean.x = -0.3 * (1 - k);
      },
    });
    this.eyesBusy = false;
  }

  private update(dt: number): void {
    this.t += dt;
    const p = this.parts;
    // Wings ~12 Hz.
    const flap = Math.sin(this.t * Math.PI * 2 * 12) * 0.6;
    p.wingL.rotation.z = -flap;
    p.wingR.rotation.z = flap;
    // Idle bob ±0.15 at 0.8 Hz, plus any jump.
    this.rig.position.y = Math.sin(this.t * Math.PI * 2 * 0.8) * 0.15 + this.jump;
    if (this.followTarget && !this.flying) {
      this.root.position.lerp(this.followTarget, Math.min(1, dt * 10));
    }
    if (!this.flying) this.bank = lerp(this.bank, 0, Math.min(1, dt * 6));
    // Face the camera (or a target) when not flying.
    if (!this.flying) {
      const target = this.faceTarget ?? this.camera.position;
      const want = Math.atan2(target.x - this.root.position.x, target.z - this.root.position.z);
      this.yaw = angleLerp(this.yaw, want, Math.min(1, dt * 4));
    }
    this.root.rotation.set(0, this.yaw, 0);
    this.rig.rotation.x = this.lean.x;
    this.rig.rotation.z = this.bank;
    this.trackEyes();
    this.blink(dt);
    // Blob shadow follows on the ground, fading with height.
    const h = Math.max(0, this.root.position.y - this.groundY);
    this.shadow.position.set(this.root.position.x, this.groundY + 0.06, this.root.position.z);
    this.shadow.scale.setScalar(this.root.scale.x * 1.8 * Math.max(0.45, 1 - h * 0.08));
  }

  private trackEyes(): void {
    const local = this.parts.body.worldToLocal(tmp.copy(this.camera.position));
    local.normalize();
    this.parts.pupils.position.set(local.x * 0.06, local.y * 0.05, 0);
  }

  private blink(dt: number): void {
    this.blinkIn -= dt;
    const eyes = this.parts.eyes;
    if (this.eyesBusy) return; // a yawn owns the eyes
    if (this.blinkIn < 0.12) eyes.scale.y = this.blinkIn > 0 ? 0.1 : 1;
    if (this.blinkIn <= 0) {
      this.blinkIn = 2.5 + Math.random() * 3;
    }
    if (this.blinkIn > 0.12) eyes.scale.y = this.sleepy ? 0.5 : 1;
    this.parts.pupils.visible = eyes.scale.y > 0.3;
  }
}
