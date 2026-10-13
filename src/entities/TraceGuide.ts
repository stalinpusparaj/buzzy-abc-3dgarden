import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Texture,
} from 'three';
import { ownToon } from '../core/materials';
import { palette } from '../core/theme';
import type { Avoid } from '../minigames/perch';
import { DOT_LENGTH, pointAt, type Polyline, type Pt } from '../minigames/traceMath';
import { guideAvoid, makeMarks, Spots, starAt, STOP_R, type Mark } from './guideMarks';
import { lengthScale, startScale, tangent } from './guideScale';
import { arrowTexture, chevronTexture, ringTexture, starTexture } from './guideTextures';
import { TraceDemo, type ToLocal } from './TraceDemo';

// Box units (0–1 stroke box) unless noted. Marks shrink on short strokes and tight loops.
const ARROW_S = 0.115; // start arrow sits this far along the stroke
const CHEV = 0.5; // world size of a chevron sprite
const BALL_R = 0.06; // start ball + ring
const MARK_R = 0.035; // start arrow, end star
const DEMO_WIN = 0.2; // chevrons this far behind the follow-me sparkle glow...
const DEMO_AHEAD = 0.14; // ...and from this far ahead of it to there they win their spots
const WAVE_SPEED = 0.55; // idle "chasing lights", box units per second
// Plot-local heights: the letter top is ~0.31, pollen beads reach 0.48. The current
// stroke's marks float above both (a path that comes back over traced pollen still shows).
const Z_MARK = 0.5;
const WHITE = new Color(0xffffff);
const GLOW = new Color(0xffd23f);
const DIM = new Color(0xa89c8f);

export interface GuideFrame {
  /** Finger down and on the path: hide the start marker (the finger is there). */
  tracing: boolean;
  /** Hint / after-demo emphasis. */
  strong: boolean;
  reduced: boolean;
}

const win = (d: number, w: number): number => (d >= -0.02 && d <= w ? 1 - Math.max(0, d) / w : 0);

/**
 * The trace guide (brief §5.3): chevrons along the current stroke pointing the way to go,
 * a green start ball + arrow ("put your finger here, go this way"), a red-orange end star
 * ("stop here"), dim small chevrons for strokes still to come, and the follow-me sparkle.
 */
export class TraceGuide {
  readonly root = new Group();
  /** Ball + ring + arrow; sits on the child's progress point. Pop/squash this. */
  readonly start = new Group();
  private readonly ball: Mesh;
  private readonly badge: Mesh;
  private readonly ripple: Mesh;
  private readonly arrow: Mesh;
  private readonly star: Mesh;
  private readonly chevrons: InstancedMesh;
  private readonly marks: Mark[];
  private readonly spots = new Spots();
  private readonly shown: boolean[] = [];
  private readonly demo: TraceDemo;
  private stroke = 0;
  private progress = 0;
  private arrowS = ARROW_S;
  private k = 1; // start ball + arrow size
  private starK = 1; // end star size
  private starPt: Pt = [0, 0];
  private dot = false;
  private t = 0;
  private kick = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly sc = new Vector3();
  private readonly zAxis = new Vector3(0, 0, 1);
  private readonly col = new Color();

  constructor(
    private readonly lines: Polyline[],
    private readonly toLocal: ToLocal,
  ) {
    this.marks = makeMarks(lines);
    this.chevrons = new InstancedMesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ map: chevronTexture(), transparent: true, depthWrite: false }),
      Math.max(1, this.marks.length),
    );
    this.chevrons.renderOrder = 2;
    this.chevrons.frustumCulled = false;
    this.chevrons.setColorAt(0, WHITE);
    const ring = ringTexture();
    this.badge = this.sprite(ring, 0.95, 3);
    this.badge.position.z = Z_MARK;
    this.ripple = this.sprite(ring, 0.95, 3);
    this.ripple.position.z = Z_MARK - 0.01;
    this.ball = new Mesh(new SphereGeometry(0.3, 16, 10), ownToon(palette.startDot));
    this.ball.position.z = 0.5;
    this.arrow = this.sprite(arrowTexture('#3ccf4e'), 0.8, 4);
    this.star = this.sprite(starTexture('#ff5a36'), 0.8, 4);
    this.start.add(this.ripple, this.badge, this.ball, this.arrow);
    this.demo = new TraceDemo(toLocal);
    this.root.add(this.chevrons, this.star, this.start, this.demo.root);
    this.setStroke(0);
    this.layoutChevrons({ tracing: false, strong: false, reduced: true }, null);
  }

  private sprite(map: Texture, size: number, order: number): Mesh {
    const mat = new MeshBasicMaterial({ map, transparent: true, depthWrite: false });
    const mesh = new Mesh(new PlaneGeometry(size, size), mat);
    mesh.renderOrder = order;
    return mesh;
  }

  private get line(): Polyline | undefined {
    return this.lines[this.stroke];
  }

  /** Make stroke `i` current (past the last stroke: hide the markers). */
  setStroke(i: number): void {
    this.stroke = i;
    this.progress = 0;
    this.demo.stop();
    const pl = this.line;
    this.start.visible = this.star.visible = !!pl;
    if (!pl) return;
    this.dot = pl.length < DOT_LENGTH;
    this.ball.visible = this.arrow.visible = this.star.visible = !this.dot;
    // A dot is just a green target ring: touch it.
    (this.badge.material as MeshBasicMaterial).color.set(this.dot ? palette.startDot : 0xffffff);
    this.starK = this.dot ? 1 : lengthScale(pl);
    this.starPt = pointAt(pl, this.dot ? 0 : starAt(this.lines, i));
    this.star.position.copy(this.toLocal(this.starPt[0], this.starPt[1], Z_MARK));
    this.fit(pl);
  }

  /** The child's progress (arc length) on the current stroke: the start marker follows it. */
  setProgress(s: number): void {
    const pl = this.line;
    if (s === this.progress || !pl) return;
    this.progress = s;
    this.fit(pl);
  }

  /** Before a tight loop (the eye of அ ஆ உ) or on a short stroke the ball and arrow shrink. */
  private fit(pl: Polyline): void {
    this.k = this.dot ? 1 : startScale(pl, this.progress);
    this.arrowS = Math.min(ARROW_S * this.k, pl.length * 0.4);
    this.placeStart(0);
  }

  private placeStart(nudge: number): void {
    const pl = this.line;
    if (!pl) return;
    const [u, v] = pointAt(pl, this.progress);
    this.start.position.copy(this.toLocal(u, v, 0));
    if (this.dot) return;
    const s = Math.min(pl.length, this.progress + this.arrowS + nudge * this.k);
    const [au, av] = pointAt(pl, s);
    this.arrow.position.copy(this.toLocal(au, av, Z_MARK + 0.02)).sub(this.start.position);
    this.arrow.rotation.z = tangent(pl, s);
    this.arrow.scale.setScalar(this.k);
  }

  playDemo(reduced: boolean): void {
    const pl = this.line;
    if (pl) this.demo.play(pl, this.progress, reduced, this.dot ? 1 : lengthScale(pl));
  }

  stopDemo(): void {
    this.demo.stop();
  }

  /** Where Buzzy must not hover (stroke box): the marks and the trail still to trace. */
  avoid(): Avoid[] {
    return guideAvoid(this.lines, this.stroke, this.progress, this.arrowS);
  }

  /** Animate markers + chevrons. Returns true on the frame a follow-me run ends. */
  update(dt: number, f: GuideFrame): boolean {
    this.t += dt;
    const t = this.t;
    const run = this.demo.update(dt);
    const pl = this.line;
    this.start.visible = !!pl && !f.tracing;
    // Start: the ball breathes (fast bounce when emphasised), a ring ripples outward.
    const k = f.reduced
      ? 1 + 0.08 * (0.5 + 0.5 * Math.sin(t * 2.4))
      : 1 + (f.strong ? 0.3 : 0.13) * Math.abs(Math.sin(t * (f.strong ? 6.5 : 3.4)));
    this.ball.scale.setScalar(k * this.k);
    this.badge.scale.setScalar((this.dot ? 1.25 * k : 1) * this.k);
    const period = f.reduced ? 2.6 : f.strong ? 0.8 : 1.5;
    const ph = (t % period) / period;
    const rip = (this.dot ? 1.25 : 1) * this.k;
    this.ripple.scale.setScalar(rip * (1 + ph * (f.reduced ? 0.45 : 1.1)));
    (this.ripple.material as MeshBasicMaterial).opacity = (f.reduced ? 0.5 : 0.9) * (1 - ph);
    // The arrow nudges forward: "this way".
    if (!this.dot) this.placeStart(f.reduced ? 0 : 0.03 * Math.max(0, Math.sin(t * 5)));
    // The star wobbles ("stop here") and bounces when the sparkle lands on it.
    if (run.done) this.kick = 0.5;
    this.kick = Math.max(0, this.kick - dt);
    const bounce = (f.reduced ? 0.15 : 0.45) * Math.sin((this.kick / 0.5) * Math.PI);
    this.star.rotation.z = f.reduced ? 0 : Math.sin(t * 2.2) * 0.18;
    const wobble = f.reduced ? 1 : 1 + 0.07 * Math.sin(t * 4.4);
    this.star.scale.setScalar((wobble + bounce) * this.starK);
    this.layoutChevrons(f, run.s);
    return run.done;
  }

  private layoutChevrons(f: GuideFrame, demoS: number | null): void {
    const pl = this.line;
    const spots = this.spots;
    spots.clear();
    this.shown.length = 0;
    if (pl && this.start.visible) {
      spots.claim(pointAt(pl, this.progress), BALL_R * this.k);
      if (!this.dot) spots.claim(pointAt(pl, this.progress + this.arrowS), MARK_R * this.k);
    }
    if (pl && !this.dot) spots.claim(this.starPt, MARK_R * this.starK);
    // Current stroke in tracing order: where the path crosses or comes back on itself, the
    // part to trace first wins the spot (no pile-ups of arrows pointing two ways). While the
    // follow-me sparkle runs, the stretch around it wins first: it shows the way it is going.
    const from = this.progress + (this.start.visible ? this.arrowS + 0.035 * this.k : 0.012);
    const mine = (mk: Mark): boolean => mk.stroke === this.stroke && mk.s >= from;
    if (demoS !== null) {
      this.marks.forEach((mk, i) => {
        const d = demoS - mk.s;
        if (mine(mk) && d >= -DEMO_AHEAD && d <= DEMO_WIN) this.shown[i] = spots.mark(mk, 1);
      });
    }
    this.marks.forEach((mk, i) => {
      if (mine(mk) && this.shown[i] === undefined) this.shown[i] = spots.mark(mk, 1);
    });
    // Strokes still to come stay clear of the end star: nothing seems to carry on past it.
    const [su, sv] = this.starPt;
    const stop = (mk: Mark): boolean =>
      !this.dot && Math.hypot(mk.pos[0] - su, mk.pos[1] - sv) < STOP_R;
    this.marks.forEach((mk, i) => {
      if (mk.stroke > this.stroke && !stop(mk)) this.shown[i] = spots.mark(mk, 0.7);
    });
    let n = 0;
    const put = (mk: Mark, size: number, z: number): void => {
      const [u, v] = mk.pos;
      this.m.compose(
        this.toLocal(u, v, z),
        this.q.setFromAxisAngle(this.zAxis, mk.angle),
        this.sc.setScalar(size * mk.size),
      );
      this.chevrons.setMatrixAt(n, this.m);
      this.chevrons.setColorAt(n, this.col);
      n++;
    };
    // Strokes still to come: small and dim, drawn first (underneath).
    this.col.copy(DIM);
    this.marks.forEach((mk, i) => {
      if (mk.stroke > this.stroke && this.shown[i]) put(mk, CHEV * 0.62, 0.36);
    });
    this.marks.forEach((mk, i) => {
      if (mk.stroke !== this.stroke || !this.shown[i]) return;
      let h = 0;
      if (demoS !== null) h = win(demoS - mk.s, DEMO_WIN);
      else if (pl && !f.reduced && !f.tracing) {
        const cycle = (pl.length - this.progress) / WAVE_SPEED + 0.9;
        h = 0.85 * win(this.progress + (this.t % cycle) * WAVE_SPEED - mk.s, 0.14);
      }
      this.col.copy(WHITE).lerp(GLOW, h);
      put(mk, CHEV * (1 + 0.3 * h), Z_MARK);
    });
    this.chevrons.count = n;
    this.chevrons.instanceMatrix.needsUpdate = true;
    if (this.chevrons.instanceColor) this.chevrons.instanceColor.needsUpdate = true;
  }
}
