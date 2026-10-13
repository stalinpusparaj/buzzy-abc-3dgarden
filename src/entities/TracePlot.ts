import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { motion } from '../core/a11y';
import { disposeObject } from '../core/dispose';
import { toon } from '../core/materials';
import { palette } from '../core/theme';
import { ease } from '../core/tween';
import type { Lang } from '../data/types';
import type { Avoid } from '../minigames/perch';
import { DOT_LENGTH, pointAt, type Polyline, type TraceState } from '../minigames/traceMath';
import { glyphGeometry } from './Glyph3D';
import { PLOT, plotUnit } from './guideScale';
import { TraceGuide, type GuideFrame } from './TraceGuide';

export { PLOT };

const SPACING = 0.03;
/** A touched dot (ஈ) fills with pollen: beads in rings this far out (box units)... */
const DOT_RINGS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.032, 6],
  [0.064, 12],
];
/** ...a little bigger than trail beads, popping in over this many seconds. */
const DOT_BEAD = 1.25;
const DOT_POP = 0.4;

interface Bead {
  stroke: number;
  s: number;
  pos: Vector3;
  size: number;
}

/**
 * The garden plot for Trace the Trail (brief §5.3): the glyph lies on it with the trace
 * guide on top (chevrons, start ball + arrow, end star, follow-me sparkle) and a glowing
 * pollen trail that fills as you trace.
 * Local x/y are the stroke box (centred), local +z is "up" out of the soil.
 */
export class TracePlot {
  readonly root = new Group();
  readonly guide: TraceGuide;
  /** World units per stroke-box unit. */
  readonly unit: number;
  private readonly beads: InstancedMesh;
  private readonly beadList: Bead[] = [];
  private readonly shown: boolean[] = [];
  private readonly pop: number[]; // seconds since each dot filled (-1: not yet)
  private readonly m = new Matrix4();
  private readonly sc = new Vector3();
  private readonly q = new Quaternion();

  constructor(
    lang: Lang,
    glyph: string,
    private readonly lines: Polyline[],
    color: number,
    extent: readonly [number, number] = [0.9, 0.9],
  ) {
    this.unit = plotUnit(extent[0], extent[1]);
    const soilW = Math.max(PLOT * 1.14, this.unit * extent[0] + PLOT * 0.24);
    const rim = new Mesh(
      new BoxGeometry(soilW + PLOT * 0.08, PLOT * 1.22, 0.3),
      toon(palette.grassDark),
    );
    rim.position.z = -0.2;
    const soil = new Mesh(new BoxGeometry(soilW, PLOT * 1.14, 0.3), toon(palette.soil));
    soil.position.z = -0.08;
    this.root.add(rim, soil);
    const g = glyphGeometry(lang, glyph);
    if (g) {
      const letter = new Mesh(g, [toon(color), toon(palette.glyphOutline)]);
      letter.scale.set(this.unit, this.unit, 1.2);
      letter.position.z = 0.12;
      this.root.add(letter);
    }
    lines.forEach((pl, stroke) => {
      if (pl.length < DOT_LENGTH) {
        const [u, v] = pl.pts[0] ?? [0.5, 0.5];
        for (const [r, n] of DOT_RINGS) {
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2 + r * 20;
            const pos = this.local(u + r * Math.cos(a), v + r * Math.sin(a), 0.32);
            this.beadList.push({ stroke, s: 0, pos, size: DOT_BEAD });
          }
        }
        return;
      }
      for (let s = 0; s <= pl.length + 1e-6; s += SPACING) {
        const [u, v] = pointAt(pl, s);
        this.beadList.push({ stroke, s, pos: this.local(u, v, 0.32), size: 1 });
      }
    });
    this.pop = lines.map(() => -1);
    this.beads = new InstancedMesh(
      new SphereGeometry(0.16, 8, 6),
      toon(palette.trail, 0x8a6a00),
      Math.max(1, this.beadList.length),
    );
    this.beadList.forEach((_, i) => this.beads.setMatrixAt(i, this.m.makeScale(0, 0, 0)));
    this.guide = new TraceGuide(lines, (u, v, z) => this.local(u, v, z));
    this.root.add(this.beads, this.guide.root);
  }

  /** The "put your finger here" marker (for squash/pop and Buzzy's pointing). */
  get startMarker(): Group {
    return this.guide.start;
  }

  /** Stroke-box (u, v) → plot-local position. */
  local(u: number, v: number, z = 0.4): Vector3 {
    return new Vector3((u - 0.5) * this.unit, (v - 0.5) * this.unit, z);
  }

  /** Plot-local point → stroke-box (u, v). */
  toBox(local: Vector3): [number, number] {
    return [local.x / this.unit + 0.5, local.y / this.unit + 0.5];
  }

  /** Make stroke `i` current: guide markers move there (hidden when all are done). */
  setStroke(i: number): void {
    this.guide.setStroke(i);
  }

  /** Grow pollen beads along every covered part of every stroke; a touched dot fills up. */
  setProgress(st: TraceState): void {
    this.beadList.forEach((b, i) => {
      // Strokes not started yet stay bare (even their very first bead).
      const p = st.progress[b.stroke] ?? 0;
      const covered = b.stroke < st.stroke || st.done || (p > 0 && b.s <= p + 1e-6);
      if (covered && b.size !== 1 && this.pop[b.stroke] === -1) this.pop[b.stroke] = 0;
      this.shown[i] = covered;
      this.place(i, covered ? this.popScale(b.stroke) : 0);
    });
    this.beads.instanceMatrix.needsUpdate = true;
    if (!st.done) this.guide.setProgress(st.progress[st.stroke] ?? 0);
  }

  /** A filling dot pops in (overshoots a little); everything else is full size. */
  private popScale(stroke: number): number {
    const t = this.pop[stroke] ?? -1;
    if (t < 0 || t >= DOT_POP || motion.reduced) return 1;
    return Math.max(0.0001, ease.outBack(t / DOT_POP));
  }

  private place(i: number, k: number): void {
    const b = this.beadList[i];
    if (b) this.beads.setMatrixAt(i, this.m.compose(b.pos, this.q, this.sc.setScalar(k * b.size)));
  }

  /** Per frame: animate the guide and filling dots. True when a follow-me run just ended. */
  update(dt: number, f: GuideFrame): boolean {
    this.pop.forEach((t, stroke) => {
      if (t < 0 || t >= DOT_POP) return;
      this.pop[stroke] = Math.min(DOT_POP, t + dt);
      const k = this.popScale(stroke);
      this.beadList.forEach((b, i) => {
        if (b.stroke === stroke && this.shown[i]) this.place(i, k);
      });
      this.beads.instanceMatrix.needsUpdate = true;
    });
    return this.guide.update(dt, f);
  }

  playDemo(reduced: boolean): void {
    this.guide.playDemo(reduced);
  }

  stopDemo(): void {
    this.guide.stopDemo();
  }

  /** Guide marks (stroke box) Buzzy must not cover. */
  avoid(): Avoid[] {
    return this.guide.avoid();
  }

  /** World positions spaced along a stroke (for e2e drags and the finish sparkle). */
  strokePoints(i: number, n = 24): Vector3[] {
    const pl = this.lines[i];
    if (!pl) return [];
    return Array.from({ length: n + 1 }, (_, k) => {
      const [u, v] = pointAt(pl, (pl.length * k) / n);
      return this.root.localToWorld(this.local(u, v, 0.3));
    });
  }

  dispose(): void {
    disposeObject(this.root);
  }
}
