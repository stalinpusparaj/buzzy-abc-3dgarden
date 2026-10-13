/** Outline as written by scripts/build-letters.ts: SVG-like commands in 1/1000 em, y up. */
export interface GlyphOutline {
  d: string;
  bbox: number[]; // [x0, y0, x1, y1], validated at build time
}

/**
 * The square box that stroke files are authored in (brief §5.3: 0–1, y up). It is centred on
 * the glyph's bounds with 5 % padding, so the glyph spans 0.05–0.95 on its longer axis.
 */
export function glyphBox(o: GlyphOutline): { cx: number; cy: number; size: number } {
  const [x0 = 0, y0 = 0, x1 = 1, y1 = 1] = o.bbox;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size: Math.max(x1 - x0, y1 - y0) / 0.9 };
}

/** Parse the compact command string into numeric commands. */
export function parseOutline(d: string): { op: string; n: number[] }[] {
  return d
    .split(' ')
    .filter(Boolean)
    .map((tok) => ({
      op: tok[0] ?? 'Z',
      n: tok.length > 1 ? tok.slice(1).split(',').map(Number) : [],
    }));
}
