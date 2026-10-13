/**
 * Trace-the-Trail rules (brief §5.3) as pure functions, fully unit-tested.
 * Coordinates are the stroke box: 0–1, y up.
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
  /** A stroke is complete at this coverage. */
  complete: number;
}

export interface TraceState {
  stroke: number; // index of the stroke being traced
  progress: number[]; // arc length covered, per stroke
  onPath: boolean;
  done: boolean;
}

export type TraceEvent = 'advanced' | 'offPath' | 'strokeDone' | 'letterDone' | null;

/** Brief §5.3 defaults: 12 % of glyph height (ages 3–4) or 8 % ("older child"). */
export function traceConfig(glyphHeight: number, older: boolean): TraceConfig {
  return { tolerance: glyphHeight * (older ? 0.08 : 0.12), maxJump: 0.15, complete: 0.85 };
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

/** Closest point on the part of the polyline whose arc length lies in [sMin, sMax]. */
export function closest(
  pl: Polyline,
  p: Pt,
  sMin: number,
  sMax: number,
): { s: number; d: number } | null {
  let best: { s: number; d: number } | null = null;
  for (let i = 1; i < pl.pts.length; i++) {
    const s0 = pl.cum[i - 1] ?? 0;
    const s1 = pl.cum[i] ?? 0;
    const lo = Math.max(s0, sMin);
    const hi = Math.min(s1, sMax);
    if (lo > hi || s1 === s0) continue;
    const a = pl.pts[i - 1] as Pt;
    const b = pl.pts[i] as Pt;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const segLen = s1 - s0;
    let k = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (segLen * segLen);
    k = Math.max((lo - s0) / segLen, Math.min((hi - s0) / segLen, k));
    const x = a[0] + dx * k;
    const y = a[1] + dy * k;
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (!best || d < best.d) best = { s: s0 + segLen * k, d };
  }
  return best;
}

export function createTrace(count: number): TraceState {
  return { stroke: 0, progress: new Array<number>(count).fill(0), onPath: false, done: false };
}

/**
 * Feed one pointer position. Progress only advances forward, only while within tolerance,
 * and never by more than `maxJump` of the stroke at once (no tapping the end to cheat).
 */
export function step(lines: Polyline[], st: TraceState, p: Pt, cfg: TraceConfig): TraceEvent {
  if (st.done) return null;
  const pl = lines[st.stroke];
  if (!pl) return null;
  const s0 = st.progress[st.stroke] ?? 0;
  const hit = closest(pl, p, Math.max(0, s0 - cfg.tolerance), s0 + cfg.maxJump * pl.length);
  if (!hit || hit.d > cfg.tolerance) {
    const was = st.onPath;
    st.onPath = false;
    return was ? 'offPath' : null;
  }
  st.onPath = true;
  if (hit.s <= s0) return null;
  st.progress[st.stroke] = hit.s;
  if (hit.s >= cfg.complete * pl.length) {
    st.progress[st.stroke] = pl.length;
    st.stroke++;
    st.onPath = false;
    if (st.stroke >= lines.length) {
      st.done = true;
      return 'letterDone';
    }
    return 'strokeDone';
  }
  return 'advanced';
}

/** Overall completion 0..1 across all strokes. */
export function coverage(lines: Polyline[], st: TraceState): number {
  const total = lines.reduce((a, l) => a + l.length, 0);
  const done = lines.reduce((a, l, i) => a + Math.min(st.progress[i] ?? 0, l.length), 0);
  return total > 0 ? done / total : 0;
}
