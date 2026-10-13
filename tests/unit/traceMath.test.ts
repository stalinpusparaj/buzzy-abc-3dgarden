import { describe, expect, it } from 'vitest';
import {
  closest,
  coverage,
  createTrace,
  doneAt,
  END_REACH,
  nearestPlaces,
  pointAt,
  polyline,
  step,
  traceConfig,
  type Pt,
} from '../../src/minigames/traceMath';

// Brief §5.3 example: English A.
const A: Pt[][] = [
  [
    [0.5, 0.95],
    [0.08, 0.05],
  ],
  [
    [0.5, 0.95],
    [0.92, 0.05],
  ],
  [
    [0.25, 0.4],
    [0.75, 0.4],
  ],
];
const cfg = traceConfig(0.9, false);
const lines = A.map(polyline);

/** Points along a stroke from fraction a to b, optionally offset sideways. */
function walk(i: number, a: number, b: number, n = 30, off: Pt = [0, 0]): Pt[] {
  const pl = lines[i]!;
  return Array.from({ length: n + 1 }, (_, k) => {
    const p = pointAt(pl, pl.length * (a + ((b - a) * k) / n));
    return [p[0] + off[0], p[1] + off[1]] as Pt;
  });
}

describe('polyline helpers', () => {
  it('measures length and interpolates', () => {
    const pl = polyline([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(pl.length).toBeCloseTo(2);
    expect(pointAt(pl, 1.5)).toEqual([1, 0.5]);
  });
  it('closest respects the arc-length window', () => {
    const pl = polyline([
      [0, 0],
      [1, 0],
    ]);
    expect(closest(pl, [0.9, 0.1], 0, 0.5)?.s).toBeCloseTo(0.5);
  });
  it('nearestPlaces finds each stretch of trail beside the finger, never a window edge', () => {
    // A hairpin: up x = 0.4, across, down x = 0.6. A finger between the legs is beside both.
    const pl = polyline([
      [0.4, 0],
      [0.4, 1],
      [0.6, 1],
      [0.6, 0],
    ]);
    const places = nearestPlaces(pl, [0.5, 0.5], 0, pl.length);
    const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
    expect(places.map((h) => h.s)).toEqual([0.5, 1.1, 1.7].map((x) => expect.closeTo(x)));
    expect(places.map((h) => h.d).every((d, k) => near(d, [0.1, 0.5, 0.1][k]!))).toBe(true);
    // Windowed: true minima only, unless clipped (then the window edge counts).
    expect(nearestPlaces(pl, [0.5, 0.5], 0, 0.3)).toEqual([]);
    expect(nearestPlaces(pl, [0.5, 0.5], 0, 0.3, true).map((h) => h.s)).toEqual([0.3]);
  });
});

describe('trace rules', () => {
  it('tolerance is 12 % / 8 % of glyph height', () => {
    expect(traceConfig(1, false).tolerance).toBeCloseTo(0.12);
    expect(traceConfig(1, true).tolerance).toBeCloseTo(0.08);
  });

  it('on-path movement advances progress', () => {
    const st = createTrace(3);
    for (const p of walk(0, 0, 0.5)) step(lines, st, p, cfg);
    expect(st.progress[0]! / lines[0]!.length).toBeGreaterThan(0.45);
    expect(st.onPath).toBe(true);
  });

  it('off-path pauses without losing progress', () => {
    const st = createTrace(3);
    for (const p of walk(0, 0, 0.4)) step(lines, st, p, cfg);
    const before = st.progress[0];
    expect(step(lines, st, [0.95, 0.95], cfg)).toBe('offPath');
    expect(st.onPath).toBe(false);
    for (const p of walk(0, 0.4, 0.7, 10, [0.3, 0])) step(lines, st, p, cfg);
    expect(st.progress[0]).toBe(before);
  });

  it('still counts slightly off-centre fingers (within tolerance)', () => {
    const st = createTrace(3);
    for (const p of walk(0, 0, 0.6, 30, [0.06, 0])) step(lines, st, p, cfg);
    expect(st.progress[0]! / lines[0]!.length).toBeGreaterThan(0.5);
  });

  it('is forward-only', () => {
    const st = createTrace(3);
    for (const p of walk(0, 0, 0.6)) step(lines, st, p, cfg);
    const high = st.progress[0];
    for (const p of walk(0, 0.6, 0.1)) step(lines, st, p, cfg);
    expect(st.progress[0]).toBe(high);
  });

  it('jump guard: touching the end of the stroke does nothing', () => {
    const st = createTrace(3);
    expect(step(lines, st, pointAt(lines[0]!, lines[0]!.length * 0.95), cfg)).toBe(null);
    expect(st.progress[0]).toBe(0);
    for (const p of walk(0, 0, 0.3)) step(lines, st, p, cfg);
    const mid = st.progress[0]!;
    step(lines, st, pointAt(lines[0]!, lines[0]!.length * 0.8), cfg);
    expect(st.progress[0]).toBe(mid);
  });

  it('taking hold earns nothing; a touch just ahead of Buzzy then catches up', () => {
    const st = createTrace(3);
    const pl = lines[0]!;
    expect(step(lines, st, pointAt(pl, 0.5 * cfg.tolerance), cfg)).toBe(null);
    expect(st.onPath).toBe(true);
    expect(st.progress[0]).toBe(0);
    for (const p of walk(0, (0.5 * cfg.tolerance) / pl.length, 0.5)) step(lines, st, p, cfg);
    expect(st.progress[0]! / pl.length).toBeCloseTo(0.5);
  });

  it('after leaving the path the finger must come back to Buzzy', () => {
    const st = createTrace(3);
    for (const p of walk(0, 0, 0.4)) step(lines, st, p, cfg);
    const before = st.progress[0]!;
    expect(step(lines, st, [0.95, 0.95], cfg)).toBe('offPath');
    for (const p of walk(0, 0.6, 0.9)) step(lines, st, p, cfg); // back on, but further along
    expect(st.progress[0]).toBe(before);
    for (const p of walk(0, 0.4, 1)) step(lines, st, p, cfg); // from Buzzy: fine
    expect(st.stroke).toBe(1);
  });

  it('strokes must be done in order', () => {
    const st = createTrace(3);
    for (const p of walk(2, 0, 1)) step(lines, st, p, cfg); // the crossbar first: ignored
    expect(st.progress[2]).toBe(0);
    expect(st.stroke).toBe(0);
  });

  it('a stroke completes at its end star (within a tolerance), the letter after the last', () => {
    const st = createTrace(3);
    const events: string[] = [];
    for (let i = 0; i < 3; i++) {
      const len = lines[i]!.length;
      const at = doneAt(lines[i]!, cfg) / len;
      expect(at).toBeGreaterThanOrEqual(0.85);
      expect(1 - at).toBeLessThanOrEqual(cfg.tolerance / len + 1e-9);
      // Stopping short of that leaves the stroke open...
      const short = at - (0.3 * cfg.tolerance) / len;
      for (const p of walk(i, 0, short)) step(lines, st, p, cfg);
      expect(st.stroke).toBe(i);
      // ...carrying on to it (still short of the very end) finishes it.
      for (const p of walk(i, short, at + 0.01, 10)) {
        const e = step(lines, st, p, cfg);
        if (e === 'strokeDone' || e === 'letterDone') events.push(e);
      }
    }
    expect(events).toEqual(['strokeDone', 'strokeDone', 'letterDone']);
    expect(st.done).toBe(true);
    expect(coverage(lines, st)).toBe(1);
  });

  it('a long stroke is not done at 85 %: the child must reach the end star', () => {
    // A Tamil-like stroke 2.4 long: its last 15 % (0.36) is a whole bar.
    const long = [
      polyline([
        [0.1, 0.1],
        [0.9, 0.1],
        [0.9, 0.9],
        [0.1, 0.9],
      ]),
    ];
    const pl = long[0]!;
    const st = createTrace(1);
    const along = (a: number, b: number): Pt[] =>
      Array.from({ length: 121 }, (_, k) => pointAt(pl, a + ((b - a) * k) / 120));
    for (const p of along(0, 0.9 * pl.length)) step(long, st, p, cfg);
    expect(st.done).toBe(false);
    expect(st.progress[0]! / pl.length).toBeGreaterThan(0.89);
    // Done with the finger on the end star: at most a tolerance (and END_REACH) from the end.
    expect(doneAt(pl, cfg)).toBeCloseTo(pl.length - Math.min(cfg.tolerance, END_REACH));
    for (const p of along(0.9 * pl.length, pl.length)) step(long, st, p, cfg);
    expect(st.done).toBe(true);
  });

  it('a short stroke still needs 85 % coverage', () => {
    const pl = polyline([
      [0.4, 0.5],
      [0.6, 0.5],
    ]);
    expect(doneAt(pl, cfg)).toBeCloseTo(0.85 * pl.length);
  });

  it('a dot stroke completes when touched within tolerance (e.g. the dots of ஈ)', () => {
    const dotLines = [
      polyline([
        [0.2, 0.2],
        [0.2, 0.8],
      ]),
      polyline([
        [0.6, 0.5],
        [0.6, 0.5],
      ]),
    ];
    const st = createTrace(2);
    expect(step(dotLines, st, [0.6, 0.5], cfg)).toBe(null); // stroke order still applies
    for (let k = 0; k <= 30; k++) step(dotLines, st, [0.2, 0.2 + (0.6 * k) / 30], cfg);
    expect(st.stroke).toBe(1);
    expect(step(dotLines, st, [0.9, 0.9], cfg)).toBe(null);
    expect(step(dotLines, st, [0.62, 0.52], cfg)).toBe('letterDone');
  });
});
