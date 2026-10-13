import { Group, Plane, Vector3 } from 'three';
import { motion } from '../core/a11y';
import type { GamePointerEvent } from '../core/input';
import { palette } from '../core/theme';
import { loadStrokes } from '../data/strokes';
import type { LetterDef } from '../data/types';
import { outline } from '../entities/Glyph3D';
import { popIn } from '../entities/juice';
import { TracePlot } from '../entities/TracePlot';
import { Hint } from './hint';
import type { GameContext, MiniGame } from './MiniGame';
import { perch } from './perch';
import {
  createTrace,
  liftFinger,
  pointAt,
  polyline,
  sampleStep,
  step,
  traceConfig,
  type Polyline,
  type Pt,
  type TraceConfig,
  type TraceState,
} from './traceMath';

/** Buzzy's size while tracing (smaller than other games: she must not hide the guide). */
const BUZZY_SCALE = 0.38;
/** Buzzy hovers this high above the plot (local z). */
const HOVER = 0.8;

/**
 * Template B, Trace the Trail (brief §5.3). A follow-me sparkle shows each stroke from its
 * green start to its end star; chevrons point the way. Buzzy hovers beside the finger
 * (never over the guide) while it stays on the current stroke; covered parts fill with pollen.
 */
export class TraceTrail implements MiniGame {
  readonly id = 'traceTrail' as const;
  onComplete: () => void = () => {};
  private ctx: GameContext | null = null;
  private plot: TracePlot | null = null;
  private readonly tilt = new Group();
  private lines: Polyline[] = [];
  private cfg: TraceConfig | null = null;
  private st: TraceState | null = null;
  private hint: Hint | null = null;
  private last: Pt | null = null;
  private pulse = 0;
  private side: number | null = null;
  private readonly plane = new Plane();

  async enter(ctx: GameContext, letter: LetterDef): Promise<void> {
    this.ctx = ctx;
    const strokes = await loadStrokes(ctx.lang, letter.id);
    if (!ctx.scope.alive) return;
    const o = outline(ctx.lang, letter.glyph);
    if (!strokes || !o) {
      // TODO(content): no stroke file yet. Never block the child: count it as done.
      void ctx.scope.wait(0.5).then(() => this.onComplete());
      return;
    }
    this.lines = strokes.strokes.map((s) => polyline(s));
    const [w, h] = [o.bbox[2]! - o.bbox[0]!, o.bbox[3]! - o.bbox[1]!];
    const size = Math.max(w, h) / 0.9;
    this.cfg = traceConfig(h / size, ctx.older);
    this.st = createTrace(this.lines.length);
    const color =
      palette.petals[(letter.id.charCodeAt(letter.id.length - 1) + 2) % palette.petals.length] ??
      0xff8fa3;
    // A wide letter lies bigger on a wider plot (its stroke box stays the same).
    this.plot = new TracePlot(ctx.lang, letter.glyph, this.lines, color, [w / size, h / size]);
    // Lie the plot back like a garden bed seen from the close-up camera.
    this.tilt.rotation.x = -0.5;
    this.tilt.position.set(0, -0.2, 0);
    this.tilt.add(this.plot.root);
    ctx.stage.add(this.tilt);
    ctx.stage.updateMatrixWorld(true);
    this.hint = new Hint(() => this.showHint());
    ctx.setTargets(() => this.plot?.strokePoints(this.st?.stroke ?? 0) ?? []);
    void ctx.buzzy.setScale(BUZZY_SCALE);
    void ctx.buzzy.flyTo(this.buzzyPoint(), 1.0);
    void ctx.voice.say(letter.vo.intro, { glyph: letter.glyph, letterId: letter.id });
    this.demoSoon(1.2);
  }

  /** World position for Buzzy: hovering beside the current progress point, off the guide. */
  private buzzyPoint(): Vector3 {
    const plot = this.plot;
    const st = this.st;
    const pl = st ? this.lines[st.stroke] : undefined;
    if (!plot || !st || !pl) return this.ctx?.buzzy.position.clone() ?? new Vector3();
    const spot = perch(pointAt(pl, st.progress[st.stroke] ?? 0), plot.avoid(), this.side);
    this.side = spot.angle;
    return plot.root.localToWorld(plot.local(spot.pt[0], spot.pt[1], HOVER));
  }

  /** Show the current stroke with the follow-me sparkle (unless the child is already on it). */
  private demoSoon(delay: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const stroke = this.st?.stroke;
    void ctx.scope.wait(delay).then(() => {
      const st = this.st;
      if (!st || st.done || st.stroke !== stroke || (st.onPath && ctx.input.isDown)) return;
      this.plot?.playDemo(motion.reduced);
    });
  }

  update(dt: number): void {
    const ctx = this.ctx;
    if (!this.plot || !this.st || !ctx) return;
    this.hint?.update(dt);
    this.pulse = Math.max(0, this.pulse - dt);
    const tracing = this.st.onPath && ctx.input.isDown;
    const f = { tracing, strong: this.pulse > 0, reduced: motion.reduced };
    // After each follow-me run, the start ball bounces: "now you!"
    if (this.plot.update(dt, f)) this.pulse = Math.max(this.pulse, 1.8);
  }

  onPointer(e: GamePointerEvent): void {
    const ctx = this.ctx;
    const plot = this.plot;
    const st = this.st;
    const cfg = this.cfg;
    if (!ctx || !plot || !st || !cfg || st.done) return;
    if (e.type === 'up' || e.type === 'cancel') {
      // The finger left the screen: the next touch must take hold on Buzzy again.
      this.last = null;
      liftFinger(st);
      return;
    }
    if (e.type === 'move' && !ctx.input.isDown) return;
    plot.root.updateMatrixWorld();
    const n = new Vector3(0, 0, 1).transformDirection(plot.root.matrixWorld);
    this.plane.setFromNormalAndCoplanarPoint(n, plot.root.localToWorld(new Vector3(0, 0, 0.3)));
    const hit = ctx.input.planePoint(e, this.plane, new Vector3());
    if (!hit) return;
    const p = plot.toBox(plot.root.worldToLocal(hit));
    // Sub-sample long moves so fast fingers don't trip the jump guard.
    const from = this.last ?? p;
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(p[0] - from[0], p[1] - from[1]) / sampleStep(cfg)),
    );
    for (let i = 1; i <= steps; i++) {
      const q: Pt = [
        from[0] + ((p[0] - from[0]) * i) / steps,
        from[1] + ((p[1] - from[1]) * i) / steps,
      ];
      this.handle(step(this.lines, st, q, cfg));
      if (st.done) break;
    }
    this.last = p;
  }

  private handle(ev: ReturnType<typeof step>): void {
    const ctx = this.ctx;
    const plot = this.plot;
    const st = this.st;
    if (!ctx || !plot || !st || !ev) return;
    if (ev === 'offPath') {
      this.hint?.miss();
      ctx.buzzy.follow(this.buzzyPoint());
      return;
    }
    this.hint?.progress();
    plot.setProgress(st);
    plot.stopDemo();
    if (ev === 'advanced') {
      ctx.buzzy.follow(this.buzzyPoint());
      return;
    }
    // Stroke or letter finished.
    ctx.sfx.play('chime');
    const end = plot.strokePoints(st.stroke - 1).at(-1);
    if (end) ctx.particles.burst(end, 30);
    plot.setStroke(st.stroke);
    if (ev === 'strokeDone') {
      this.side = null;
      void popIn(ctx.scope, plot.startMarker, 1, 0.45, 0.15);
      void ctx.buzzy.flyTo(this.buzzyPoint(), 0.6);
      this.demoSoon(0.7);
      return;
    }
    for (let i = 0; i < this.lines.length; i++) {
      for (const p of plot.strokePoints(i, 4)) ctx.particles.burst(p, 6);
    }
    void ctx.scope.wait(1.0).then(() => this.onComplete());
  }

  private showHint(): void {
    const ctx = this.ctx;
    const plot = this.plot;
    if (!ctx || !plot || this.st?.done) return;
    ctx.onHint();
    this.pulse = 2.5;
    plot.playDemo(motion.reduced);
    void ctx.buzzy.point(plot.startMarker.getWorldPosition(new Vector3()));
  }

  exit(): void {
    this.plot?.dispose();
    this.tilt.removeFromParent();
    this.plot = null;
    this.ctx = null;
  }
}
