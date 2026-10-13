import type { Cue } from '../data/types';

/**
 * Turn raw key presses into cue JSON (brief §5.6): first press per letter wins, sorted by
 * time, rounded to 10 ms, unknown ids dropped.
 */
export function buildCues(presses: Cue[], letterIds: string[]): Cue[] {
  const known = new Set(letterIds);
  const first = new Map<string, number>();
  for (const p of presses) {
    if (!known.has(p.id) || first.has(p.id) || !Number.isFinite(p.t) || p.t < 0) continue;
    first.set(p.id, Math.round(p.t * 100) / 100);
  }
  return [...first.entries()].map(([id, t]) => ({ id, t })).sort((a, b) => a.t - b.t);
}
