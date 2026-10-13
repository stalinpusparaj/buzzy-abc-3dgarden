import { Group, Plane, Vector3 } from 'three';
import type { GamePointerEvent } from '../core/input';
import { palette } from '../core/theme';
import { loadStrokes } from '../data/strokes';
import type { LetterDef } from '../data/types';
import { outline } from '../entities/Glyph3D';
import { squash } from '../entities/juice';
import { TracePlot } from '../entities/TracePlot';
import { Hint } from './hint';
import type { GameContext, MiniGame } from './MiniGame';
import {
  createTrace,
  pointAt,
  polyline,
  step,
  traceConfig,
  type Polyline,
  type Pt,
  type TraceConfig,
  type TraceState,
} from './traceMath';

/**
 * Template B, Trace the Trail (brief §5.3). Buzzy sits on the start dot and follows the
 * finger only while it stays on the current stroke; covered parts fill with pollen.
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
    const size = Math.max(o.bbox[2]! - o.bbox[0]!, o.bbox[3]! - o.bbox[1]!) / 0.9;
    this.cfg = traceConfig((o.bbox[3]! - o.bbox[1]!) / size, ctx.older);
    this.st = createTrace(this.lines.length);
    const color =
      palette.petals[(letter.id.charCodeAt(letter.id.length - 1) + 2) % palette.petals.length] ??
      0xff8fa3;
    this.plot = new TracePlot(ctx.lang, letter.glyph, this.lines, color);
    // Lie the plot back like a garden bed seen from the close-up camera.
    this.tilt.rotation.x = -0.5;
    this.tilt.position.set(0, -0.2, 0);
    this.tilt.add(this.plot.root);
    ctx.stage.add(this.tilt);
    ctx.stage.updateMatrixWorld(true);
    this.hint = new Hint(() => this.showHint());
    ctx.setTargets(() => this.plot?.strokePoints(this.st?.stroke ?? 0) ?? []);
    void ctx.buzzy.flyTo(this.buzzyPoint(), 1.0);
    void ctx.voice.say(letter.vo.intro, { glyph: letter.glyph, letterId: letter.id });
  }

  /** World position for Buzzy: on the trail at the current progress. */
  private buzzyPoint(): Vector3 {
    const plot = this.plot;
    const st = this.st;
    const pl = st ? this.lines[st.stroke] : undefined;
    if (!plot || !st || !pl) return this.ctx?.buzzy.position.clone() ?? new Vector3();
    const [u, v] = pointAt(pl, st.progress[st.stroke] ?? 0);
    return plot.root.localToWorld(plot.local(u, v, 1.1));
  }

  update(dt: number): void {
    if (!this.plot || !this.st) return;
    this.hint?.update(dt);
    this.pulse = Math.max(0, this.pulse - dt);
    const k =
      1 +
      (this.pulse > 0 || !this.st.onPath ? 0.25 * Math.abs(Math.sin(performance.now() / 160)) : 0);
    this.plot.startDot.scale.setScalar(k);
  }

  onPointer(e: GamePointerEvent): void {
    const ctx = this.ctx;
    const plot = this.plot;
    const st = this.st;
    const cfg = this.cfg;
    if (!ctx || !plot || !st || !cfg || st.done) return;
    if (e.type === 'up' || e.type === 'cancel') {
      this.last = null;
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
      Math.ceil(Math.hypot(p[0] - from[0], p[1] - from[1]) / (cfg.tolerance / 2)),
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
      void squash(ctx.scope, plot.startDot, 0.3);
      void ctx.buzzy.flyTo(this.buzzyPoint(), 0.6);
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
    void ctx.buzzy.point(plot.startDot.getWorldPosition(new Vector3()));
  }

  exit(): void {
    this.plot?.dispose();
    this.tilt.removeFromParent();
    this.plot = null;
    this.ctx = null;
  }
}
