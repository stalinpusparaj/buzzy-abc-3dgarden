import { describe, expect, it } from 'vitest';
import { guideAvoid, makeMarks, SPACING, Spots, starAt } from '../../src/entities/guideMarks';
import {
  chevronScale,
  K_MIN,
  lengthScale,
  PLOT,
  plotUnit,
  startScale,
} from '../../src/entities/guideScale';
import {
  closest,
  doneAt,
  pointAt,
  polyline,
  type Polyline,
  type Pt,
} from '../../src/minigames/traceMath';
import { configs, loadLetters } from './traceFixtures';

const LETTERS = loadLetters();
const strokes = (name: string) => LETTERS.find((l) => l.name === name)!.lines;
const circle = (r: number, turns = 1): Pt[] =>
  Array.from({ length: 61 }, (_, k) => {
    const a = Math.PI / 2 - (k / 60) * turns * Math.PI * 2; // clockwise from the top
    return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)] as Pt;
  });

describe('trace guide marks fit the stroke (brief §5.3)', () => {
  it('full size on a long straight stroke or a wide curve', () => {
    const line = polyline([
      [0.1, 0.5],
      [0.9, 0.5],
    ]);
    expect(startScale(line, 0)).toBe(1);
    expect(chevronScale(line, 0.4)).toBe(1);
    expect(startScale(polyline(circle(0.35, 0.5)), 0)).toBe(1);
  });

  it('the start ball + arrow shrink before a tight loop (the eye of அ ஆ இ உ)', () => {
    expect(startScale(polyline(circle(0.09)), 0)).toBeLessThan(0.7);
    for (const name of ['ta/ta_a', 'ta/ta_aa', 'ta/ta_i', 'ta/ta_u']) {
      const k = startScale(strokes(name)[0]!, 0);
      expect(k, name).toBeLessThan(0.8);
      expect(k, name).toBeGreaterThanOrEqual(K_MIN);
    }
  });

  it('short strokes (the bar and leg of ஊ) get smaller start and end marks', () => {
    const uu = strokes('ta/ta_uu');
    expect(lengthScale(uu[2]!)).toBeLessThan(0.6);
    expect(lengthScale(uu[3]!)).toBeLessThan(0.6);
    expect(lengthScale(uu[0]!)).toBe(1);
  });

  it('chevrons of different passes never overlap; neighbours on one pass sit SPACING apart', () => {
    const spots = new Spots();
    const marks = makeMarks([
      polyline([
        [0.1, 0.5],
        [0.9, 0.5],
      ]),
      polyline([
        [0.1, 0.55],
        [0.9, 0.55],
      ]),
    ]);
    const first = marks.filter((m) => m.stroke === 0);
    expect(first.every((m) => spots.mark(m, 1))).toBe(true);
    expect(first[1]!.s - first[0]!.s).toBeCloseTo(SPACING);
    // The second pass runs only 0.05 away: none of its chevrons fit.
    expect(marks.filter((m) => m.stroke === 1).some((m) => spots.mark(m, 1))).toBe(false);
  });

  it('Buzzy keeps off the trail still to trace, and off the end star', () => {
    const pl = strokes('ta/ta_i')[0]!;
    const avoid = guideAvoid([pl], 0, 0.3, 0.1);
    for (const s of [0.5, 1, 1.5, pl.length]) {
      const p = pointAt(pl, s);
      expect(avoid.some((a) => Math.hypot(a.pt[0] - p[0], a.pt[1] - p[1]) < 0.03)).toBe(true);
    }
    // Trail already traced is free to hover over.
    const behind = pointAt(pl, 0.1);
    expect(avoid.some((a) => Math.hypot(a.pt[0] - behind[0], a.pt[1] - behind[1]) < 0.03)).toBe(
      false,
    );
  });
});

describe('the end star sits on its own stroke, clear of strokes still to come', () => {
  const gap = (pl: Polyline, p: Pt): number => closest(pl, p, 0, pl.length)?.d ?? Infinity;

  it('slides back off the next stroke: அ ஆ bar off the stem, இ off its outer arch', () => {
    for (const [name, next] of [
      ['ta/ta_a', 1],
      ['ta/ta_aa', 1],
      ['ta/ta_i', 2],
    ] as const) {
      const lines = strokes(name);
      const pl = lines[0]!;
      const s = starAt(lines, 0);
      expect(pl.length - s, name).toBeGreaterThan(0.04);
      const later = lines[next]!;
      expect(gap(later, pointAt(pl, s)), name).toBeGreaterThan(gap(later, pointAt(pl, pl.length)));
    }
    // The bar of அ ஆ: the whole star (radius ~0.05) is off the stem's band (half-width ~0.05).
    expect(
      gap(strokes('ta/ta_a')[1]!, pointAt(strokes('ta/ta_a')[0]!, starAt(strokes('ta/ta_a'), 0))),
    ).toBeGreaterThanOrEqual(0.1);
  });

  it('never far back (the finger reaches it to finish) and never nearer a later stroke', () => {
    for (const l of LETTERS) {
      l.lines.forEach((pl, i) => {
        const s = starAt(l.lines, i);
        const what = `${l.name} stroke ${i + 1}`;
        expect(s, what).toBeLessThanOrEqual(pl.length);
        expect(pl.length - s, what).toBeLessThanOrEqual(0.07 + 1e-9);
        for (const { cfg } of configs(l)) {
          // The point where the stroke counts as done lies under the star (radius ~0.05).
          expect(Math.abs(doneAt(pl, cfg) - s), what).toBeLessThanOrEqual(0.05 + 1e-9);
        }
        for (const later of l.lines.slice(i + 1)) {
          const end = pointAt(pl, pl.length);
          if (later.length > 0.03) {
            expect(gap(later, pointAt(pl, s)) + 1e-9, what).toBeGreaterThanOrEqual(
              Math.min(0.12, gap(later, end)),
            );
          }
        }
      });
    }
  });

  it('stays on the very end where nothing still to come is near (every English stroke)', () => {
    for (const l of LETTERS.filter((x) => x.name.startsWith('en/'))) {
      l.lines.forEach((pl, i) => expect(starAt(l.lines, i), l.name).toBe(pl.length));
    }
    // ஊ: walking the bar's star back would bring it nearer the leg, so it stays put.
    const uu = strokes('ta/ta_uu');
    expect(starAt(uu, 2)).toBe(uu[2]!.length);
  });
});

describe('a wide letter lies bigger on a wider plot', () => {
  it('a letter as tall as it is wide, or taller, keeps the standard size', () => {
    expect(plotUnit(0.9, 0.9)).toBe(PLOT);
    expect(plotUnit(0.63, 0.9)).toBe(PLOT);
  });

  it('a wide one grows, never wider than 7.6 world or taller than a tall letter', () => {
    for (const h of [0.371, 0.567, 0.65, 0.726, 0.85]) {
      const u = plotUnit(0.9, h);
      expect(u).toBeGreaterThan(PLOT);
      expect(u * 0.9).toBeLessThanOrEqual(7.6 + 1e-9);
      expect(u * h).toBeLessThanOrEqual(PLOT * 0.9 + 1e-9);
    }
    expect(plotUnit(0.9, 0.371) / PLOT).toBeGreaterThan(1.3); // ஊ
  });
});
