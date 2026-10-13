import type { Avoid } from '../minigames/perch';
import { closest, DOT_LENGTH, pointAt, type Polyline, type Pt } from '../minigames/traceMath';
import { chevronScale, lengthScale, tangent } from './guideScale';

// Box units (0–1 stroke box).
export const SPACING = 0.062; // between chevrons
const END_GAP = 0.075; // no chevron under the end star
const CHEV_R = 0.026; // box radius a chevron keeps clear of its neighbours on the same pass
const CHEV_SEP = 0.04; // ...and of every other pass (sprites never pile up where passes meet)

const STAR_CLEAR = 0.12; // the end star keeps this far off strokes still to come...
const STAR_PULL = 0.07; // ...sliding back along its own stroke at most this far
/** Preview chevrons of strokes still to come keep this far from the end star: nothing seems to
 * carry on past "stop here". */
export const STOP_R = 0.15;

/** Distance from `p` to a stroke (a dot is its point). */
function distTo(pl: Polyline, p: Pt): number {
  const c = pl.pts[0] ?? p;
  return closest(pl, p, 0, pl.length)?.d ?? Math.hypot(p[0] - c[0], p[1] - c[1]);
}

/**
 * Arc length of stroke `i`'s end star: its end, or a little before it where the end touches a
 * stroke still to come (the bar of அ ஆ ends on the stem's edge; the first stroke of இ ends
 * where its outer arch starts), so the star sits on its own ink, as clear of that stroke as
 * it can get. The finger still has to reach the star: a stroke is done at most END_REACH
 * (0.05) before its end.
 */
export function starAt(lines: readonly Polyline[], i: number): number {
  const pl = lines[i];
  if (!pl) return 0;
  const later = lines.slice(i + 1);
  const room = (s: number): number =>
    Math.min(STAR_CLEAR, ...later.map((l) => distTo(l, pointAt(pl, s))));
  let best = pl.length;
  for (let s = pl.length; s >= pl.length - STAR_PULL && room(best) < STAR_CLEAR; s -= 0.005) {
    if (room(s) > room(best) + 1e-9) best = Math.max(0, s);
  }
  return best;
}

/** A chevron spot on a stroke: arc length, position, heading and size (smaller in tight turns). */
export interface Mark {
  stroke: number;
  s: number;
  pos: Pt;
  angle: number;
  size: number;
}

/** Chevron spots every SPACING along every stroke (none on dots, none under the end star). */
export function makeMarks(lines: readonly Polyline[]): Mark[] {
  const marks: Mark[] = [];
  lines.forEach((pl, stroke) => {
    if (pl.length < DOT_LENGTH) return;
    const last = pl.length - END_GAP * lengthScale(pl) + 1e-6;
    for (let s = SPACING * 0.5; s <= last; s += SPACING) {
      const size = chevronScale(pl, s);
      marks.push({ stroke, s, pos: pointAt(pl, s), angle: tangent(pl, s), size });
    }
  });
  return marks;
}

/** A claimed spot. `near` keeps neighbours on the same pass apart, `far` everything else. */
interface Spot {
  pt: Pt;
  near: number;
  far: number;
  stroke: number;
  s: number;
}

/** The guide's spots for one frame: first come, first served, nothing overlaps. */
export class Spots {
  private readonly taken: Spot[] = [];

  clear(): void {
    this.taken.length = 0;
  }

  /** Is `p` clear of everything placed so far? Claims the spot if so. */
  claim(p: Pt, near: number, far = near, stroke = -1, s = 0): boolean {
    for (const o of this.taken) {
      const same = stroke >= 0 && o.stroke === stroke && Math.abs(o.s - s) < 1.6 * SPACING;
      const r = same ? near + o.near : far + o.far;
      if (Math.hypot(p[0] - o.pt[0], p[1] - o.pt[1]) < r) return false;
    }
    this.taken.push({ pt: p, near, far, stroke, s });
    return true;
  }

  /** Claim a chevron (`k` < 1 for the small dim chevrons of strokes still to come). */
  mark(mk: Mark, k: number): boolean {
    return this.claim(mk.pos, CHEV_R * k * mk.size, CHEV_SEP * k * mk.size, mk.stroke, mk.s);
  }
}

/**
 * Where Buzzy must not hover: the start marker, the end star, the trail still to trace (the
 * next stretch most of all) and, a little, the strokes still to come.
 */
export function guideAvoid(
  lines: readonly Polyline[],
  stroke: number,
  progress: number,
  arrowS: number,
): Avoid[] {
  const pl = lines[stroke];
  if (!pl) return [];
  const out: Avoid[] = [
    { pt: pointAt(pl, progress), w: 3, r: 0.16 },
    { pt: pointAt(pl, progress + arrowS), w: 2, r: 0.13 },
    { pt: pointAt(pl, starAt(lines, stroke)), w: 3, r: 0.16 },
  ];
  for (let s = progress + 0.05; s < pl.length; s += 0.05) {
    out.push({ pt: pointAt(pl, s), w: s - progress < 0.6 ? 1 : 0.5, r: 0.14 });
  }
  lines.forEach((l, i) => {
    if (i <= stroke) return;
    for (let s = 0; s <= l.length; s += 0.08) out.push({ pt: pointAt(l, s), w: 0.25, r: 0.12 });
  });
  return out;
}
