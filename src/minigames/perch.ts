import type { Pt } from './traceMath';

/** A guide mark Buzzy should not hover over: `w` = how bad covering it is, `r` = keep-out. */
export interface Avoid {
  pt: Pt;
  w: number;
  r: number;
}

const SIDES = 16;
/** Besides `r`, Buzzy may hover a little closer or further out to find a gap in a busy letter
 * (இ is trail almost everywhere); each step away from `r` costs a little. */
const REACH = [1, 0.8, 1.3];
const REACH_COST = 1.5;

const turn = (a: number, b: number): number => {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};

/**
 * Where Buzzy hovers while a child traces (stroke-box units, v up): about `r` away from the
 * progress point, on the side that covers the fewest guide marks still to come, preferring
 * "up" (the hand comes from below) and the side she is already on (no jitter). She flies
 * above the plot, so on screen she looks `lift` higher than her spot: overlaps use that.
 */
export function perch(
  p: Pt,
  avoid: readonly Avoid[],
  prev: number | null,
  r = 0.19,
  lift = 0.04,
): { angle: number; pt: Pt } {
  let best: { angle: number; pt: Pt } = { angle: Math.PI / 2, pt: [p[0], p[1] + r] };
  let bestCost = Infinity;
  for (let j = 0; j < REACH.length * SIDES; j++) {
    const a = ((j % SIDES) / SIDES) * Math.PI * 2;
    const rr = r * (REACH[Math.floor(j / SIDES)] ?? 1);
    const c: Pt = [p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr];
    let cost = REACH_COST * Math.abs(rr - r);
    for (const q of avoid) {
      const d = Math.hypot(c[0] - q.pt[0], c[1] + lift - q.pt[1]);
      if (d < q.r) cost += (q.w * (q.r - d)) / q.r;
    }
    // Stay over the plot (a little above the top edge is fine: she flies).
    cost += 40 * Math.max(0, -0.02 - c[0], c[0] - 1.02, -0.02 - c[1], c[1] - 1.12);
    cost += 0.25 * (1 - Math.sin(a));
    if (prev !== null) cost += (0.3 * turn(a, prev)) / Math.PI;
    if (cost < bestCost) {
      bestCost = cost;
      best = { angle: a, pt: c };
    }
  }
  return best;
}
