/**
 * Direction rules for Trace the Trail, checked on every stroke file the game ships (en + ta)
 * at both in-game tolerances, plus hand-made hard shapes: progress only grows while the finger
 * moves along a stroke from its start towards its end.
 */
import { describe, expect, it } from 'vitest';
import {
  createTrace,
  doneAt,
  liftFinger,
  lookAhead,
  pointAt,
  sampleStep,
  step,
  type Polyline,
  type Pt,
  type TraceConfig,
} from '../../src/minigames/traceMath';
import {
  configs,
  densify,
  feed,
  fingers,
  isDot,
  loadLetters,
  loopsBackToStart,
  middle,
  SHAPES,
  targetDrag,
  traceFrom,
  walk,
  type Letter,
} from './traceFixtures';

const LETTERS = loadLetters();

/**
 * "About nothing", in tolerances: next to nothing on the centre line. A finger wandering half
 * a tolerance off the line can pick up at most about a finger's width where a loop is smaller
 * than the tolerance itself (the whole loop is then "on the path").
 */
const CENTRE_MAX = 0.05;
const SLOPPY_MAX = 1.25;

/** Every (letter, tolerance, stroke) that is a line rather than a dot. */
function cases(
  letters: Letter[],
): { name: string; cfg: TraceConfig; pl: Polyline; i: number; lines: Polyline[] }[] {
  return letters.flatMap((l) =>
    configs(l).flatMap(({ label, cfg }) =>
      l.lines.flatMap((pl, i) =>
        isDot(pl)
          ? []
          : [{ name: `${l.name} ${label} stroke ${i + 1}`, cfg, pl, i, lines: l.lines }],
      ),
    ),
  );
}

/** Trace a whole letter in stroke order; dots are touched. */
function traceLetter(lines: Polyline[], cfg: TraceConfig, path: (pl: Polyline) => Pt[]) {
  const st = createTrace(lines.length);
  const events = lines.flatMap((pl) => feed(lines, st, isDot(pl) ? [pl.pts[0]!] : path(pl), cfg));
  return { st, events };
}

function expectNothing(got: number, cfg: TraceConfig, centre: boolean, what: string): void {
  const max = centre ? CENTRE_MAX : SLOPPY_MAX;
  expect(got / cfg.tolerance, what).toBeLessThanOrEqual(max);
}

describe.each([
  ['shipped letters', LETTERS],
  ['hard shapes', SHAPES],
])('forward tracing completes (%s)', (_, letters) => {
  for (const l of letters) {
    for (const { label, cfg } of configs(l)) {
      it(`${l.name} (${label}): every stroke, every kind of finger`, () => {
        for (const f of fingers(cfg.tolerance)) {
          const { st, events } = traceLetter(l.lines, cfg, (pl) =>
            walk(pl, 0, pl.length, cfg, f.off),
          );
          expect(st.done, `${l.name} ${f.label}: stuck on stroke ${st.stroke + 1}`).toBe(true);
          expect(events.filter((e) => e === 'strokeDone')).toHaveLength(l.lines.length - 1);
          expect(events.at(-1)).toBe('letterDone');
        }
      });
    }
  }
});

describe('the e2e drag (25 points per stroke, straight between them) completes', () => {
  // Shipped letters only: on a long stroke with a turn sharper than ~140° those straight
  // drags cut the corner by more than half the "older" tolerance (see the hard N shape).
  for (const l of LETTERS) {
    it.each(configs(l))(`${l.name} ($label)`, ({ cfg }) => {
      expect(traceLetter(l.lines, cfg, (pl) => targetDrag(pl, cfg)).st.done).toBe(true);
    });
  }
});

describe('a stroke is done only at its end star, never before', () => {
  it.each(cases(LETTERS))('$name', ({ cfg, pl, i, lines }) => {
    const at = doneAt(pl, cfg);
    expect(pl.length - at).toBeLessThanOrEqual(cfg.tolerance + 1e-9);
    const st = traceFrom(lines, i);
    feed(lines, st, walk(pl, 0, at - 0.25 * cfg.tolerance, cfg), cfg);
    expect(st.stroke, 'a finger short of the end star').toBe(i);
    feed(lines, st, walk(pl, at - 0.25 * cfg.tolerance, pl.length, cfg), cfg);
    expect(st.stroke).toBe(i + 1);
  });
});

describe('walking a stroke backwards earns nothing', () => {
  const all = [...cases(LETTERS), ...cases(SHAPES.filter((s) => s.name !== 'retrace'))];
  it.each(all)('$name: end → start', ({ cfg, pl, i, lines }) => {
    for (const f of fingers(cfg.tolerance)) {
      const centre = f.label === 'on the line';
      const st = traceFrom(lines, i);
      feed(lines, st, walk(pl, pl.length, 0, cfg, f.off), cfg);
      expectNothing(st.progress[i]!, cfg, centre, `${f.label}, from the end`);
      // Touching the start dot first, then walking back from the end: still nothing.
      const st2 = traceFrom(lines, i);
      feed(lines, st2, [pointAt(pl, 0), ...walk(pl, pl.length, 0, cfg, f.off)], cfg);
      expectNothing(st2.progress[i]!, cfg, centre, `${f.label}, start dot then from the end`);
    }
    // Backwards from anywhere along the stroke, and on past the start.
    for (let from = 0.05; from <= 1; from += 0.05) {
      const st = traceFrom(lines, i);
      feed(lines, st, walk(pl, from * pl.length, -2 * cfg.tolerance, cfg), cfg);
      expect(st.progress[i], `from ${Math.round(from * 100)} %`).toBe(0);
    }
  });

  it.each(all)(
    '$name: the finger turning back keeps progress but adds none',
    ({ cfg, pl, i, lines }) => {
      const st = traceFrom(lines, i);
      feed(lines, st, walk(pl, 0, 0.6 * pl.length, cfg), cfg);
      const reached = st.progress[i]!;
      expect(reached / pl.length).toBeGreaterThan(0.55);
      feed(lines, st, walk(pl, 0.6 * pl.length, 0, cfg), cfg);
      expect(st.progress[i]).toBe(reached);
    },
  );
});

describe('going the wrong way round a loop at the start earns nothing', () => {
  const loops = [...cases(LETTERS), ...cases(SHAPES)].flatMap((c) =>
    loopsBackToStart(c.pl, c.cfg).map((back) => ({ ...c, back })),
  );

  it('finds the starting loops: உ and the hand-made ones', () => {
    const names = new Set(loops.map((c) => c.name.split(' ')[0]));
    for (const n of ['ta/ta_u', 'loop-cw', 'small-loop-cw', 'small-loop-ccw']) {
      expect(names).toContain(n);
    }
  });

  it.each(loops)(
    '$name: from the start dot round the loop backwards',
    ({ cfg, pl, i, lines, back }) => {
      for (const f of fingers(cfg.tolerance)) {
        const st = traceFrom(lines, i);
        // Down on the start dot, round the loop the other way, and once more for luck.
        const lap = walk(pl, back, 0, cfg, f.off);
        feed(lines, st, densify([pointAt(pl, 0), ...lap, ...lap], sampleStep(cfg)), cfg);
        expectNothing(st.progress[i]!, cfg, f.label === 'on the line', f.label);
      }
    },
  );

  it.each(cases(LETTERS))('$name: leaving the start dot backwards', ({ cfg, pl, i, lines }) => {
    const [a, b] = [pointAt(pl, 0), pointAt(pl, 0.02)];
    const t = [(b[0] - a[0]) / 0.02, (b[1] - a[1]) / 0.02];
    const away: Pt = [a[0] - 3 * cfg.tolerance * t[0]!, a[1] - 3 * cfg.tolerance * t[1]!];
    const st = traceFrom(lines, i);
    feed(lines, st, densify([a, away], sampleStep(cfg)), cfg);
    expect(st.progress[i]).toBe(0);
  });
});

describe('progress must start at the start dot', () => {
  it.each(cases(LETTERS))(
    '$name: touching the end or the middle first does nothing',
    ({ cfg, pl, i, lines }) => {
      const st = traceFrom(lines, i);
      expect(step(lines, st, pointAt(pl, pl.length), cfg)).toBe(null);
      expect(step(lines, st, pointAt(pl, pl.length / 2), cfg)).toBe(null);
      expect(st.onPath).toBe(false);
      for (const f of fingers(cfg.tolerance)) {
        const st2 = traceFrom(lines, i);
        feed(lines, st2, walk(pl, middle(pl, cfg), pl.length, cfg, f.off), cfg);
        expectNothing(st2.progress[i]!, cfg, f.label === 'on the line', `${f.label}: middle → end`);
      }
      // ...but starting again at the start dot works.
      const st3 = traceFrom(lines, i);
      feed(
        lines,
        st3,
        [...walk(pl, pl.length / 2, pl.length, cfg), ...walk(pl, 0, pl.length, cfg)],
        cfg,
      );
      expect(st3.stroke).toBe(i + 1);
    },
  );

  const crossings = cases(LETTERS).flatMap((c) =>
    loopsBackToStart(c.pl, c.cfg)
      .filter((back) => back > c.pl.length / 2)
      .map((back) => ({ ...c, back })),
  );

  it('finds the strokes that run back over their start dot: அ and ஆ', () => {
    const names = new Set(crossings.map((c) => c.name.split(' ')[0]));
    for (const n of ['ta/ta_a', 'ta/ta_aa']) expect(names).toContain(n);
  });

  it.each(crossings)(
    '$name: a walk from the middle over the start dot counts only from the start dot on',
    ({ cfg, pl, i, lines, back }) => {
      // How far the stroke runs on from its start dot along the ink of the crossing pass.
      let shared = 0;
      const apart = (t: number): number => {
        const [a, b] = [pointAt(pl, t), pointAt(pl, back + t)];
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
      };
      while (back + shared < pl.length && apart(shared) <= cfg.tolerance / 2) shared += 0.005;
      for (const f of fingers(cfg.tolerance)) {
        const st = traceFrom(lines, i);
        feed(lines, st, walk(pl, pl.length / 2, pl.length, cfg, f.off), cfg);
        expect(st.progress[i]!, f.label).toBeLessThanOrEqual(shared + cfg.tolerance);
      }
    },
  );

  it.each(cases(LETTERS))(
    '$name: tapping along the trail earns nothing',
    ({ cfg, pl, i, lines }) => {
      const lifted = traceFrom(lines, i);
      const jumpy = traceFrom(lines, i);
      for (let s = 0; s <= pl.length; s += 0.4 * cfg.tolerance) {
        step(lines, lifted, pointAt(pl, s), cfg);
        liftFinger(lifted);
      }
      for (let s = 0; s <= pl.length; s += 1.2 * cfg.tolerance)
        step(lines, jumpy, pointAt(pl, s), cfg);
      expect(lifted.progress[i]).toBe(0);
      expect(jumpy.progress[i]).toBe(0);
    },
  );
});

describe('jumps, pauses and dots', () => {
  it.each(cases(LETTERS))(
    '$name: a jump ahead is ignored; carry on from Buzzy',
    ({ cfg, pl, i, lines }) => {
      const st = traceFrom(lines, i);
      feed(lines, st, walk(pl, 0, 0.3 * pl.length, cfg), cfg);
      const mid = st.progress[i]!;
      // Lift and put the finger down further on, then drag to the end: nothing.
      liftFinger(st);
      feed(lines, st, walk(pl, mid + lookAhead(pl, cfg) + cfg.tolerance, pl.length, cfg), cfg);
      expect(st.progress[i]).toBe(mid);
      // Back to Buzzy and on to the end: done.
      liftFinger(st);
      feed(lines, st, walk(pl, mid, pl.length, cfg), cfg);
      expect(st.stroke).toBe(i + 1);
    },
  );

  it('look-ahead stays local: at most 1.5 tolerances and 15 % of the stroke', () => {
    for (const { cfg, pl } of cases(LETTERS)) {
      const look = lookAhead(pl, cfg);
      expect(look).toBeLessThanOrEqual(1.5 * cfg.tolerance + 1e-12);
      expect(look).toBeLessThanOrEqual(Math.max(0.15 * pl.length, sampleStep(cfg)) + 1e-12);
      expect(sampleStep(cfg)).toBeCloseTo(cfg.tolerance / 2);
    }
  });

  it('dots (ஈ) complete on a touch, in stroke order only', () => {
    const ii = LETTERS.find((l) => l.name === 'ta/ta_ii');
    expect(ii).toBeDefined();
    const lines = ii!.lines;
    const cfg = configs(ii!)[0]!.cfg;
    const dots = lines.map((pl, k) => [pl, k] as const).filter(([pl]) => isDot(pl));
    expect(dots.length).toBeGreaterThan(0);
    const st = createTrace(lines.length);
    const [firstDot, at] = dots[0]!;
    expect(step(lines, st, firstDot.pts[0]!, cfg)).toBe(null); // not its turn yet
    for (let k = 0; k < at; k++) feed(lines, st, walk(lines[k]!, 0, lines[k]!.length, cfg), cfg);
    expect(st.stroke).toBe(at);
    const p = firstDot.pts[0]!;
    const off: Pt = [p[0] + 0.5 * cfg.tolerance, p[1]];
    expect(step(lines, st, off, cfg)).toBe(at === lines.length - 1 ? 'letterDone' : 'strokeDone');
  });
});
