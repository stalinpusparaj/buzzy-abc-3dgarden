import { describe, expect, it } from 'vitest';
import {
  closest,
  coverage,
  createTrace,
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

  it('strokes must be done in order', () => {
    const st = createTrace(3);
    for (const p of walk(2, 0, 1)) step(lines, st, p, cfg); // the crossbar first: ignored
    expect(st.progress[2]).toBe(0);
    expect(st.stroke).toBe(0);
  });

  it('a stroke completes at 85 % coverage and the letter after the last stroke', () => {
    const st = createTrace(3);
    const events: string[] = [];
    for (let i = 0; i < 3; i++) {
      for (const p of walk(i, 0, 0.88)) {
        const e = step(lines, st, p, cfg);
        if (e === 'strokeDone' || e === 'letterDone') events.push(e);
      }
    }
    expect(events).toEqual(['strokeDone', 'strokeDone', 'letterDone']);
    expect(st.done).toBe(true);
    expect(coverage(lines, st)).toBe(1);
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
