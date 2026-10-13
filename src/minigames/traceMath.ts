/**
 * Trace-the-Trail rules (brief §5.3) as pure functions, fully unit-tested. Coordinates are the
 * stroke box: 0–1, y up. Direction is enforced with a "grip": the place on the stroke where the
 * finger holds the trail. A touch takes hold only on Buzzy (the start dot, or where the child
 * stopped), and taking hold earns nothing. The grip then slides with the finger to the nearest
 * bit of trail a short way either side, forward only as far as the finger really moved along
 * the trail, and progress grows only while the grip moves forward past Buzzy. So walking a
 * stroke backwards, going the wrong way round a loop, starting in the middle or tapping along
 * it earns nothing. A stroke is done only when the trail reaches its end star.
 */
export type Pt = readonly [number, number];

export interface Polyline {
  pts: readonly Pt[];
  cum: number[]; // arc length at each point
  length: number;
}

export interface TraceConfig {
  /** Max distance from the stroke (box units) that still counts as on the path. */
  tolerance: number;
  /** Progress may not jump forward by more than this fraction of the stroke length. */
  maxJump: number;
  /** A stroke is done only this close to its end star and at `complete` coverage or more. */
  endReach: number;
  complete: number;
}

export interface TraceState {
  stroke: number; // index of the stroke being traced
  progress: number[]; // arc length covered, per stroke
  onPath: boolean; // the finger holds the current stroke
  done: boolean;
  grip: number | null; // arc length where the finger holds the current stroke
  dir: number; // which way the grip last slid: 1 forward, -1 back, 0 not known yet
  finger: Pt | null; // the previous pointer sample, null after a lift
}

export type TraceEvent = 'advanced' | 'offPath' | 'strokeDone' | 'letterDone' | null;

/** A point on a stroke: arc length `s` and its distance `d` from the finger. */
export interface Hit {
  s: number;
  d: number;
}

/** A stroke shorter than this is a dot (e.g. the two dots of ஈ): touching it completes it. */
export const DOT_LENGTH = 0.03;
/** Feed pointer samples at most this many tolerances apart (sub-sample longer moves). A sample
 * more than one tolerance from the previous one is a new touch, never a slide. */
export const SAMPLE_STEP = 0.5;
/** The grip slides at most this many tolerances per sample (and at most `maxJump` of the
 * stroke), so a later part of the trail that passes close by can never be grabbed. */
export const LOOK_AHEAD = 1.5;
/** A touch takes hold at most this many tolerances further along than Buzzy. */
export const HOLD_AHEAD = 1;
/** About the end star's radius (box units): a finger this close to the end has reached it. */
export const END_REACH = 0.05;

/** Choosing between nearby parts of the trail (loops, sharp turns): stay close, keep going. */
const STAY = 1;
const MOMENTUM = 1;
/** The grip slides forward at most this multiple of the finger's own motion along the trail. */
const PUSH = 3;
/** After taking hold a little ahead of Buzzy, he catches up at this multiple of finger speed. */
const CATCH_UP = 2;
const EPS = 1e-9;

/** Brief §5.3 defaults: 12 % of glyph height (ages 3–4) or 8 % ("older child"). A stroke needs
 * 85 % coverage AND the finger on its end star (END_REACH, at most a tolerance): on a long
 * Tamil stroke the last 15 % is a whole bar, which the child must trace too. */
export function traceConfig(glyphHeight: number, older: boolean): TraceConfig {
  const tol = glyphHeight * (older ? 0.08 : 0.12);
  return { tolerance: tol, maxJump: 0.15, endReach: Math.min(tol, END_REACH), complete: 0.85 };
}

/** Arc length at which a stroke counts as traced: near its end, never before 85 %. */
export function doneAt(pl: Polyline, cfg: TraceConfig): number {
  return pl.length - Math.min(cfg.endReach, (1 - cfg.complete) * pl.length);
}

/** Largest gap (box units) between consecutive pointer samples fed to `step`. */
export function sampleStep(cfg: TraceConfig): number {
  return cfg.tolerance * SAMPLE_STEP;
}

/** How far (arc length) the grip may slide per sample on this stroke. */
export function lookAhead(pl: Polyline, cfg: TraceConfig): number {
  const local = Math.min(cfg.maxJump * pl.length, LOOK_AHEAD * cfg.tolerance);
  return Math.max(sampleStep(cfg), local);
}

export function polyline(pts: readonly Pt[]): Polyline {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    cum.push((cum[i - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { pts, cum, length: cum[cum.length - 1] ?? 0 };
}

export function pointAt(pl: Polyline, s: number): Pt {
  const t = Math.max(0, Math.min(s, pl.length));
  for (let i = 1; i < pl.pts.length; i++) {
    const s1 = pl.cum[i] ?? 0;
    if (t <= s1 || i === pl.pts.length - 1) {
      const s0 = pl.cum[i - 1] ?? 0;
      const a = pl.pts[i - 1] as Pt;
      const b = pl.pts[i] as Pt;
      const k = s1 > s0 ? (t - s0) / (s1 - s0) : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
  }
  return pl.pts[0] ?? [0, 0];
}

/** Nearest point of segment i (points i-1 → i) to p, limited to arc lengths [lo, hi]. */
function onSegment(pl: Polyline, i: number, p: Pt, lo: number, hi: number): Hit {
  const s0 = pl.cum[i - 1] ?? 0;
  const len = (pl.cum[i] ?? 0) - s0;
  const a = pl.pts[i - 1] as Pt;
  const b = pl.pts[i] as Pt;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let k = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len);
  k = Math.max((lo - s0) / len, Math.min((hi - s0) / len, k));
  return { s: s0 + len * k, d: Math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dy * k) };
}

/** Closest point on the part of the polyline whose arc length lies in [sMin, sMax]. */
export function closest(pl: Polyline, p: Pt, sMin: number, sMax: number): Hit | null {
  let best: Hit | null = null;
  for (let i = 1; i < pl.pts.length; i++) {
    const lo = Math.max(pl.cum[i - 1] ?? 0, sMin);
    const hi = Math.min(pl.cum[i] ?? 0, sMax);
    if (lo > hi || pl.cum[i] === pl.cum[i - 1]) continue;
    const h = onSegment(pl, i, p, lo, hi);
    if (!best || h.d < best.d) best = h;
  }
  return best;
}

/**
 * Every place where the finger's distance to the stroke has a local minimum (one per stretch of
 * trail beside the finger: two where a loop or sharp turn passes close), with arc length in
 * [from, to]. These are true minima of the whole stroke, unless `clip` first cuts the stroke to
 * the window: then a window edge the finger lies beyond counts too.
 */
export function nearestPlaces(pl: Polyline, p: Pt, from: number, to: number, clip = false): Hit[] {
  const lo = clip ? Math.max(0, from) : 0;
  const hi = clip ? Math.min(pl.length, to) : pl.length;
  const out: Hit[] = [];
  let prevAtEnd = false; // the previous segment's nearest point was its far end
  for (let i = 1; i < pl.pts.length; i++) {
    const a = Math.max(pl.cum[i - 1] ?? 0, lo);
    const b = Math.min(pl.cum[i] ?? 0, hi);
    if (pl.cum[i] === pl.cum[i - 1]) continue; // repeated point: same vertex
    if (a >= b) {
      prevAtEnd = false;
      continue;
    }
    const h = onSegment(pl, i, p, a, b);
    const atEnd = h.s >= b - EPS;
    // A minimum on a shared vertex counts once, and only if the trail rises on both sides.
    const keep = h.s <= a + EPS && a > lo ? prevAtEnd : !atEnd || b >= hi;
    if (keep && h.s >= from - EPS && h.s <= to + EPS) out.push(h);
    prevAtEnd = atEnd;
  }
  return out;
}

export function createTrace(count: number): TraceState {
  const progress = new Array<number>(count).fill(0);
  return { stroke: 0, progress, onPath: false, done: false, grip: null, dir: 0, finger: null };
}

/** The finger left the screen: the next touch must take hold on Buzzy again. */
export function liftFinger(st: TraceState): void {
  [st.grip, st.dir, st.finger, st.onPath] = [null, 0, null, false];
}

/** A new touch takes hold only on Buzzy: from a little behind him to a finger's width ahead. */
function takeHold(pl: Polyline, p: Pt, s0: number, look: number, tol: number): Hit | null {
  let best: Hit | null = null;
  let bestScore = Infinity;
  for (const h of nearestPlaces(pl, p, s0 - look, s0 + HOLD_AHEAD * tol)) {
    const score = h.d + STAY * Math.abs(h.s - s0);
    if (h.d <= tol && score < bestScore) [best, bestScore] = [h, score];
  }
  return best;
}

/** Unit vector from a to b (zero if they coincide). */
function unit(a: Pt, b: Pt): Pt {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return len > EPS ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len] : [0, 0];
}

/**
 * A forward slide from `from` to `to` counts only as far as the finger itself moved along the
 * trail, both where the grip lands and over the next finger's width from the grip (or from a
 * sharp corner the finger is cutting): so a finger crossing the inside of a small loop, or
 * moving against the trail, cannot sweep the grip round it.
 */
function pushed(pl: Polyline, p: Pt, from: number, to: number, move: Pt, tol: number): number {
  let base = from;
  let i = 1; // ends as the segment the grip would land on
  for (; i < pl.pts.length - 1 && ((pl.cum[i] ?? 0) < to || pl.cum[i] === pl.cum[i - 1]); i++) {
    const q = pl.pts[i] as Pt;
    const [t0, t1] = [unit(pl.pts[i - 1] as Pt, q), unit(q, pl.pts[i + 1] as Pt)];
    const sharp = t0[0] * t1[0] + t0[1] * t1[1] < 0; // a turn of more than 90°
    if (sharp && (pl.cum[i] ?? 0) > from && Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol) {
      base = pl.cum[i] ?? from;
    }
  }
  const here = unit(pl.pts[i - 1] as Pt, pl.pts[i] as Pt);
  const ahead = unit(pointAt(pl, base), pointAt(pl, Math.min(to, base + tol)));
  const dot = (t: Pt): number => move[0] * t[0] + move[1] * t[1];
  return Math.min(to, from + PUSH * Math.max(0, Math.min(dot(here), dot(ahead))));
}

/** Slide the grip to the best nearby bit of trail: close to the finger, near, same way on. */
function follow(pl: Polyline, p: Pt, st: TraceState, move: Pt, look: number, tol: number) {
  const grip = st.grip ?? 0;
  let best: Hit | null = null;
  let bestScore = Infinity;
  for (const h of nearestPlaces(pl, p, grip - look, grip + look, true)) {
    if (h.d > tol) continue;
    const s = h.s > grip ? pushed(pl, p, grip, h.s, move, tol) : h.s;
    const q = pointAt(pl, s);
    const d = s < h.s ? Math.hypot(p[0] - q[0], p[1] - q[1]) : h.d;
    const score = d + STAY * Math.abs(s - grip) - MOMENTUM * st.dir * (s - grip);
    if (score < bestScore) [best, bestScore] = [{ s, d }, score];
  }
  return best;
}

/**
 * Feed one pointer sample (at most `sampleStep(cfg)` from the previous one while dragging).
 * Progress only grows while the finger slides along the current stroke from Buzzy towards its
 * end, within tolerance; leaving the path pauses it, and the finger must come back to Buzzy.
 */
export function step(lines: Polyline[], st: TraceState, p: Pt, cfg: TraceConfig): TraceEvent {
  if (st.done) return null;
  const pl = lines[st.stroke];
  if (!pl) return null;
  const prev = st.finger;
  st.finger = p;
  const was = st.onPath;
  const tol = cfg.tolerance;
  if (pl.length < DOT_LENGTH) {
    const c = pl.pts[0] ?? [0, 0];
    if (Math.hypot(p[0] - c[0], p[1] - c[1]) <= tol) return finishStroke(lines, st, pl);
    st.onPath = false;
    return was ? 'offPath' : null;
  }
  const move: Pt | null = prev && [p[0] - prev[0], p[1] - prev[1]];
  if (!move || Math.hypot(move[0], move[1]) > tol) st.grip = null; // a new touch
  const s0 = st.progress[st.stroke] ?? 0;
  const look = lookAhead(pl, cfg);
  const from = st.grip;
  const hit =
    from === null || !move ? takeHold(pl, p, s0, look, tol) : follow(pl, p, st, move, look, tol);
  if (!hit) {
    [st.grip, st.dir, st.onPath] = [null, 0, false];
    return was ? 'offPath' : null;
  }
  [st.grip, st.onPath] = [hit.s, true];
  if (from === null) {
    st.dir = 0;
    return null; // taking hold never moves Buzzy
  }
  if (Math.abs(hit.s - from) > EPS) st.dir = Math.sign(hit.s - from);
  if (hit.s - from <= EPS || hit.s <= s0) return null;
  // Forward slide past Buzzy. If the hold was taken a little ahead of him, he catches up.
  const next = Math.min(hit.s, s0 + CATCH_UP * (hit.s - Math.max(from, s0)));
  st.progress[st.stroke] = next;
  if (next >= doneAt(pl, cfg) - EPS) return finishStroke(lines, st, pl);
  return 'advanced';
}

function finishStroke(lines: Polyline[], st: TraceState, pl: Polyline): TraceEvent {
  st.progress[st.stroke] = pl.length;
  st.stroke++;
  [st.grip, st.dir, st.onPath] = [null, 0, false];
  if (st.stroke >= lines.length) {
    st.done = true;
    return 'letterDone';
  }
  return 'strokeDone';
}

/** Overall completion 0..1 across all strokes. */
export function coverage(lines: Polyline[], st: TraceState): number {
  if (st.done) return 1;
  const total = lines.reduce((a, l) => a + l.length, 0);
  const done = lines.reduce((a, l, i) => a + Math.min(st.progress[i] ?? 0, l.length), 0);
  return total > 0 ? done / total : 0;
}
