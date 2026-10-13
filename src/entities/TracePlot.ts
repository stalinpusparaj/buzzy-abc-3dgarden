import {
  BoxGeometry,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { disposeObject } from '../core/dispose';
import { ownToon, toon } from '../core/materials';
import { palette } from '../core/theme';
import type { Lang } from '../data/types';
import { pointAt, type Polyline, type TraceState } from '../minigames/traceMath';
import { glyphGeometry } from './Glyph3D';

/** World units per stroke-box unit. */
export const PLOT = 6.4;
const SPACING = 0.03;

interface Bead {
  stroke: number;
  s: number;
  pos: Vector3;
}

/**
 * The garden plot for Trace the Trail (brief §5.3): the glyph lies on it with a dotted
 * guide, a green start dot + arrow, and a glowing pollen trail that fills as you trace.
 * Local x/y are the stroke box (centred), local +z is "up" out of the soil.
 */
export class TracePlot {
  readonly root = new Group();
  readonly startDot: Mesh;
  private readonly arrow: Mesh;
  private readonly beads: InstancedMesh;
  private readonly beadList: Bead[] = [];
  private readonly m = new Matrix4();

  constructor(
    lang: Lang,
    glyph: string,
    private readonly lines: Polyline[],
    color: number,
  ) {
    const rim = new Mesh(new BoxGeometry(PLOT * 1.22, PLOT * 1.22, 0.3), toon(palette.grassDark));
    rim.position.z = -0.2;
    const soil = new Mesh(new BoxGeometry(PLOT * 1.14, PLOT * 1.14, 0.3), toon(palette.soil));
    soil.position.z = -0.08;
    this.root.add(rim, soil);
    const g = glyphGeometry(lang, glyph);
    if (g) {
      const letter = new Mesh(g, [toon(color), toon(palette.glyphOutline)]);
      letter.scale.set(PLOT, PLOT, 1.2);
      letter.position.z = 0.12;
      this.root.add(letter);
    }
    lines.forEach((pl, stroke) => {
      for (let s = 0; s <= pl.length + 1e-6; s += SPACING) {
        const [u, v] = pointAt(pl, s);
        this.beadList.push({ stroke, s, pos: this.local(u, v, 0.32) });
      }
    });
    const n = this.beadList.length;
    const dots = new InstancedMesh(new SphereGeometry(0.07, 6, 4), toon(0xffffff), n);
    this.beads = new InstancedMesh(
      new SphereGeometry(0.16, 8, 6),
      toon(palette.trail, 0x8a6a00),
      n,
    );
    this.beadList.forEach((b, i) => {
      dots.setMatrixAt(i, this.m.makeTranslation(b.pos));
      this.beads.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    });
    this.root.add(dots, this.beads);
    this.startDot = new Mesh(new SphereGeometry(0.32, 16, 10), ownToon(palette.startDot));
    this.arrow = new Mesh(new ConeGeometry(0.2, 0.45, 12), ownToon(palette.startDot));
    this.root.add(this.startDot, this.arrow);
    this.setStroke(0);
  }

  /** Stroke-box (u, v) → plot-local position. */
  local(u: number, v: number, z = 0.4): Vector3 {
    return new Vector3((u - 0.5) * PLOT, (v - 0.5) * PLOT, z);
  }

  /** Plot-local point → stroke-box (u, v). */
  toBox(local: Vector3): [number, number] {
    return [local.x / PLOT + 0.5, local.y / PLOT + 0.5];
  }

  /** Move the start dot + arrow to the beginning of stroke `i` (hidden when done). */
  setStroke(i: number): void {
    const pl = this.lines[i];
    this.startDot.visible = this.arrow.visible = !!pl;
    if (!pl) return;
    const a = pointAt(pl, 0);
    const b = pointAt(pl, Math.min(pl.length, 0.12));
    this.startDot.position.copy(this.local(a[0], a[1], 0.45));
    const dir = new Vector3(b[0] - a[0], b[1] - a[1], 0).normalize();
    this.arrow.position.copy(this.local(a[0], a[1], 0.45)).addScaledVector(dir, 0.75);
    this.arrow.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
  }

  /** Grow pollen beads along every covered part of every stroke. */
  setProgress(st: TraceState): void {
    this.beadList.forEach((b, i) => {
      const covered = b.s <= (st.progress[b.stroke] ?? 0) + 1e-6;
      this.beads.setMatrixAt(
        i,
        covered ? this.m.makeTranslation(b.pos) : this.m.makeScale(0, 0, 0),
      );
    });
    this.beads.instanceMatrix.needsUpdate = true;
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
