/** Shared helpers for the tracing tests: the shipped stroke files, fingers and test shapes. */
import { readdirSync, readFileSync } from 'node:fs';
import {
  createTrace,
  DOT_LENGTH,
  pointAt,
  polyline,
  sampleStep,
  step,
  traceConfig,
  type Polyline,
  type Pt,
  type TraceConfig,
  type TraceEvent,
  type TraceState,
} from '../../src/minigames/traceMath';

export interface Letter {
  name: string; // e.g. "ta/ta_u"
  lines: Polyline[];
  /** Glyph height in stroke-box units, worked out the way TraceTrail does it. */
  height: number;
}

const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

/** Every stroke file shipped with the game (en + ta), with its glyph's real height. */
export function loadLetters(): Letter[] {
  const out: Letter[] = [];
  for (const lang of ['en', 'ta']) {
    const letters = json<{ id: string; glyph: string }[]>(`src/data/letters.${lang}.json`);
    const glyphOf = new Map(letters.map((l) => [l.id, l.glyph]));
    const boxes = json<{ glyphs: Record<string, { bbox: number[] }> }>(
      `src/data/glyphs.${lang}.json`,
    ).glyphs;
    const dir = `src/data/strokes/${lang}`;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const id = f.replace('.json', '');
      const [x0 = 0, y0 = 0, x1 = 1, y1 = 1] = boxes[glyphOf.get(id) ?? '']?.bbox ?? [];
      const height = (0.9 * (y1 - y0)) / Math.max(x1 - x0, y1 - y0);
      const def = json<{ strokes: Pt[][] }>(`${dir}/${f}`);
      out.push({ name: `${lang}/${id}`, lines: def.strokes.map(polyline), height });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** A loop that starts at its top, goes once round and leaves towards `exit`. */
function loop(cx: number, cy: number, r: number, exit: Pt, clockwise: boolean): Pt[] {
  const sign = clockwise ? -1 : 1;
  return [
    ...Array.from({ length: 17 }, (_, k): Pt => {
      const t = Math.PI / 2 + (sign * 2 * Math.PI * k) / 16;
      return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
    }),
    exit,
  ];
}

/** Hand-made strokes for the hard cases: sharp turns, hairpins, a retrace and small loops. */
export const SHAPES: Letter[] = (
  [
    [
      'V',
      0.9,
      [
        [0.15, 0.9],
        [0.5, 0.1],
        [0.85, 0.9],
      ],
    ],
    [
      'N',
      0.9,
      [
        [0.2, 0.1],
        [0.2, 0.9],
        [0.8, 0.1],
        [0.8, 0.9],
      ],
    ],
    [
      'Z',
      0.9,
      [
        [0.15, 0.85],
        [0.85, 0.85],
        [0.15, 0.15],
        [0.85, 0.15],
      ],
    ],
    [
      'W',
      0.9,
      [
        [0.1, 0.85],
        [0.3, 0.15],
        [0.5, 0.7],
        [0.7, 0.15],
        [0.9, 0.85],
      ],
    ],
    [
      'hairpin',
      0.9,
      [
        [0.3, 0.1],
        [0.3, 0.75],
        [0.36, 0.85],
        [0.49, 0.85],
        [0.55, 0.75],
        [0.55, 0.1],
      ],
    ],
    [
      'retrace',
      0.9,
      [
        [0.3, 0.1],
        [0.3, 0.8],
        [0.3, 0.1],
      ],
    ],
    ['loop-cw', 0.6, loop(0.3, 0.6, 0.12, [0.8, 0.75], true)],
    ['small-loop-cw', 0.6, loop(0.3, 0.6, 0.06, [0.8, 0.65], true)],
    ['small-loop-ccw', 0.6, loop(0.7, 0.6, 0.06, [0.2, 0.65], false)],
  ] as [string, number, Pt[]][]
).map(([name, height, pts]) => ({ name, height, lines: [polyline(pts)] }));

/** The in-game tolerances for a letter: ages 3–4 and "older child". */
export function configs(l: Letter): { label: string; cfg: TraceConfig }[] {
  return [false, true].map((older) => ({
    label: older ? 'older' : 'young',
    cfg: traceConfig(l.height, older),
  }));
}

export const isDot = (pl: Polyline): boolean => pl.length < DOT_LENGTH;

/** Sideways finger offset (box units) as a function of arc length. */
export type Offset = (s: number) => number;

/** Ways a child's finger strays from the centre line, all within the tolerance. */
export function fingers(tol: number): { label: string; off: Offset }[] {
  return [
    { label: 'on the line', off: () => 0 },
    { label: 'wobbling', off: (s) => 0.5 * tol * Math.sin((2 * Math.PI * s) / (4 * tol)) },
    { label: 'to the left', off: () => 0.5 * tol },
    { label: 'to the right', off: () => -0.5 * tol },
  ];
}

/** Unit normal of the stroke at arc length s (left of the drawing direction). */
function normalAt(pl: Polyline, s: number): Pt {
  const a = pointAt(pl, s - 0.01);
  const b = pointAt(pl, s + 0.01);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
}

/** Insert points so no two consecutive samples are more than `max` apart (like TraceTrail). */
export function densify(path: readonly Pt[], max: number): Pt[] {
  const out: Pt[] = [];
  path.forEach((p, i) => {
    const q = path[i - 1];
    const n = q ? Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / max) : 0;
    for (let k = 1; q && k < n; k++) {
      out.push([q[0] + ((p[0] - q[0]) * k) / n, q[1] + ((p[1] - q[1]) * k) / n]);
    }
    out.push(p);
  });
  return out;
}

/** Finger samples walking a stroke from arc length a to b (b < a walks it backwards). */
export function walk(pl: Polyline, a: number, b: number, cfg: TraceConfig, off?: Offset): Pt[] {
  const gap = sampleStep(cfg);
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / (gap / 2)));
  const pts = Array.from({ length: n + 1 }, (_, k): Pt => {
    const s = a + ((b - a) * k) / n;
    const p = pointAt(pl, s);
    const nrm = normalAt(pl, s);
    const o = off ? off(s) : 0;
    return [p[0] + nrm[0] * o, p[1] + nrm[1] * o];
  });
  return densify(pts, gap);
}

/** A drag through 25 evenly spaced points of a stroke, as the e2e helpers do it. */
export function targetDrag(pl: Polyline, cfg: TraceConfig): Pt[] {
  const pts = Array.from({ length: 25 }, (_, k) => pointAt(pl, (pl.length * k) / 24));
  return densify(pts, sampleStep(cfg));
}

/** A fresh trace whose current stroke is `i` (the earlier ones counted as done). */
export function traceFrom(lines: Polyline[], i: number): TraceState {
  const st = createTrace(lines.length);
  st.stroke = i;
  return st;
}

/** Feed samples; returns the events that happened. */
export function feed(lines: Polyline[], st: TraceState, pts: Pt[], cfg: TraceConfig): TraceEvent[] {
  return pts.map((p) => step(lines, st, p, cfg)).filter((e) => e !== null);
}

/**
 * Arc lengths where a stroke comes back past its own start dot (a loop round the start):
 * walking the stroke backwards from there to the start goes the wrong way round the loop.
 */
export function loopsBackToStart(pl: Polyline, cfg: TraceConfig): number[] {
  const start = pointAt(pl, 0);
  const dist = (s: number): number => {
    const p = pointAt(pl, s);
    return Math.hypot(p[0] - start[0], p[1] - start[1]);
  };
  const out: number[] = [];
  const ds = 0.005;
  for (let s = 3 * cfg.tolerance; s < pl.length; s += ds) {
    const d = dist(s);
    if (d < cfg.tolerance && d <= dist(s - ds) && d <= dist(s + ds)) out.push(s);
  }
  return out;
}

/**
 * A walk "from the middle" starts half way along, or, when the second half of the stroke runs
 * back over its own start dot (the bar of அ ஆ passes over the eye where stroke 1 starts), just
 * past that crossing: a finger sliding over the start dot takes hold there, as it should.
 */
export function middle(pl: Polyline, cfg: TraceConfig): number {
  const start = pointAt(pl, 0);
  const back = loopsBackToStart(pl, cfg).filter((b) => b > pl.length / 2);
  let s = Math.max(pl.length / 2, ...back);
  const near = (t: number): boolean => {
    const p = pointAt(pl, t);
    return Math.hypot(p[0] - start[0], p[1] - start[1]) <= 2 * cfg.tolerance;
  };
  while (back.length && s < pl.length && near(s)) s += 0.005;
  return s;
}
