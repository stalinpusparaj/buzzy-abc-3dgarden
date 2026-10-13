import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { ease } from '../core/tween';
import { DOT_LENGTH, pointAt, type Polyline } from '../minigames/traceMath';
import { sparkTexture } from './guideTextures';

/** Stroke-box (u, v) plus height above the soil → plot-local position. */
export type ToLocal = (u: number, v: number, z: number) => Vector3;

const TRAIL = 12;
const GAP = 0.022; // box units between trail puffs
const APPEAR = 0.3;
const FADE = 0.45;
const HEAD = 1.0; // world size of the sparkle
// Plot-local heights: above the letter (~0.31), below the guide marks (0.5) and the middle of
// the start ball, so the ball shows through the sparkle as it pops up on the start dot.
const Z_HEAD = 0.45;
const Z_TRAIL = 0.42;

export interface DemoFrame {
  /** Arc length of the sparkle on the stroke while it runs, else null. */
  s: number | null;
  /** True on the one frame the run finishes. */
  done: boolean;
}

/**
 * "Follow me" (brief §5.3): a sparkle appears on the start, runs along the stroke to its end
 * leaving a short shrinking trail, then pops. Reduced motion: slower, shorter trail, no twinkle.
 * It glows UNDER the guide marks (render order below the chevrons, start marker and star), so
 * popping up on the start dot never hides the first chevrons beside it.
 */
export class TraceDemo {
  readonly root = new Group();
  private readonly head: Mesh;
  private readonly trail: InstancedMesh;
  private pl: Polyline | null = null;
  private from = 0;
  private t = 0;
  private travel = 0;
  private reduced = false;
  private scale = 1;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly sc = new Vector3();
  private readonly zAxis = new Vector3(0, 0, 1);

  constructor(private readonly toLocal: ToLocal) {
    const tex = sparkTexture();
    const mat = (color: number): MeshBasicMaterial =>
      new MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false });
    this.head = new Mesh(new PlaneGeometry(1, 1), mat(0xffffff));
    this.head.renderOrder = 1.5;
    this.trail = new InstancedMesh(new PlaneGeometry(1, 1), mat(0xffd23f), TRAIL);
    this.trail.renderOrder = 1;
    this.trail.frustumCulled = false;
    this.root.add(this.trail, this.head);
    this.stop();
  }

  get running(): boolean {
    return this.pl !== null;
  }

  /** Run along `pl` from arc length `from` (the child's progress) to its end; `scale` < 1
   * shrinks the sparkle on a short stroke so it does not cover the whole of it. */
  play(pl: Polyline, from: number, reduced: boolean, scale = 1): void {
    this.pl = pl;
    this.from = Math.min(from, pl.length);
    this.reduced = reduced;
    this.scale = scale;
    this.t = 0;
    const len = pl.length - this.from;
    this.travel = pl.length < DOT_LENGTH ? 0.9 : Math.min(2.5, Math.max(1.5, 0.9 + len * 0.9));
    if (reduced) this.travel *= 1.4;
    this.root.visible = true;
  }

  stop(): void {
    this.pl = null;
    this.root.visible = false;
    this.head.scale.setScalar(0.0001);
  }

  update(dt: number): DemoFrame {
    const pl = this.pl;
    if (!pl) return { s: null, done: false };
    this.t += dt;
    const t = this.t;
    const end = pl.length;
    const total = APPEAR + this.travel + FADE;
    if (t >= total) {
      this.stop();
      return { s: null, done: true };
    }
    // Head: grow on the start, run (eased), then pop away on the end.
    const run = Math.min(1, Math.max(0, (t - APPEAR) / this.travel));
    const s = this.from + (end - this.from) * ease.inOutSine(run);
    let k = 1;
    if (t < APPEAR) k = ease.outBack(t / APPEAR);
    else if (t > APPEAR + this.travel) k = 1 - (t - APPEAR - this.travel) / FADE;
    const twinkle = this.reduced ? 1 : 1 + 0.14 * Math.sin(t * 16);
    const [u, v] = pointAt(pl, s);
    this.head.position.copy(this.toLocal(u, v, Z_HEAD));
    this.head.scale.setScalar(Math.max(0.0001, HEAD * this.scale * k * twinkle));
    this.head.rotation.z = this.reduced ? 0 : t * 1.6;
    // Trail: puffs behind the head; after the end they slide into it and vanish.
    const tail = Math.max(0, t - APPEAR - this.travel) / FADE;
    const lead = s + tail * TRAIL * GAP;
    const count = this.reduced ? 5 : TRAIL;
    for (let i = 0; i < TRAIL; i++) {
      const si = lead - (i + 1) * GAP;
      const show = i < count && t > APPEAR && si >= this.from && si <= end && end >= DOT_LENGTH;
      const [x, y] = pointAt(pl, si);
      const size = show ? 0.62 * this.scale * (1 - i / count) : 0;
      this.m.compose(
        this.toLocal(x, y, Z_TRAIL),
        this.q.setFromAxisAngle(this.zAxis, i * 0.7),
        this.sc.setScalar(Math.max(size, 0.0001)),
      );
      this.trail.setMatrixAt(i, this.m);
    }
    this.trail.instanceMatrix.needsUpdate = true;
    return { s: t >= APPEAR && t <= APPEAR + this.travel ? s : null, done: false };
  }
}
