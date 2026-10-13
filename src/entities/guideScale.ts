import { pointAt, type Polyline } from '../minigames/traceMath';

/**
 * How big the trace guide's marks may be at a spot on a stroke (box units, brief §5.3). The
 * Tamil letters start in a tiny loop (the "eye" of அ ஆ இ உ ஊ, about 0.1 across) and ஊ has
 * strokes only 0.2 long: full-size marks there would hide the very loop or stroke the child
 * has to follow, so they shrink to fit.
 */
const R_FULL = 0.15; // turning radius at and above which marks are full size
const LEN_FULL = 0.42; // stroke length at and above which the start/end marks are full size
const CURL_ARC = 0.25; // how far ahead of the start the loop is measured
export const K_MIN = 0.55;
export const CHEV_K_MIN = 0.72;

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/** Heading (radians) of the stroke at arc length `s`. */
export function tangent(pl: Polyline, s: number): number {
  const a = pointAt(pl, s - 0.015);
  const b = pointAt(pl, s + 0.015);
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

/** Mean turning radius of the stroke between arc lengths a and b (Infinity when straight). */
export function turnRadius(pl: Polyline, a: number, b: number): number {
  const lo = clamp(a, 0, pl.length);
  const hi = clamp(b, 0, pl.length);
  if (hi - lo < 0.03) return Infinity;
  const n = 10;
  let turn = 0;
  let prev = tangent(pl, lo);
  for (let i = 1; i <= n; i++) {
    const h = tangent(pl, lo + ((hi - lo) * i) / n);
    let d = Math.abs(h - prev) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    turn += d;
    prev = h;
  }
  return turn > 1e-6 ? (hi - lo) / turn : Infinity;
}

/** Start and end marks of a short stroke shrink so ball → arrow → star all show. */
export function lengthScale(pl: Polyline): number {
  return clamp(pl.length / LEN_FULL, K_MIN, 1);
}

/** Start ball + arrow at arc length `s`: smaller on a short stroke or before a tight loop. */
export function startScale(pl: Polyline, s: number): number {
  const curl = clamp(turnRadius(pl, s, s + CURL_ARC) / R_FULL, K_MIN, 1);
  return Math.min(lengthScale(pl), curl);
}

/** A chevron at arc length `s`: a little smaller where the trail turns tightly. */
export function chevronScale(pl: Polyline, s: number): number {
  return clamp(turnRadius(pl, s - 0.08, s + 0.08) / R_FULL, CHEV_K_MIN, 1);
}

/** World units per stroke-box unit on the plot, for a letter as tall as it is wide or taller. */
export const PLOT = 6.4;
/** A wide letter (அ ஆ ஈ உ ஊ) lies bigger, up to this wide (world) and no taller than a tall
 * one, so its small loops leave room for the guide marks; the plot grows sideways to hold it. */
const WIDE_MAX = 7.6;

/** World units per stroke-box unit for a letter `w` × `h` box units big (larger side 0.9). */
export function plotUnit(w: number, h: number): number {
  const wide = Math.min(WIDE_MAX / Math.max(w, 1e-3), (PLOT * 0.9) / Math.max(h, 1e-3));
  return Math.max(PLOT, wide);
}
