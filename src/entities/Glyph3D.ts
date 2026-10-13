import {
  ExtrudeGeometry,
  Group,
  Mesh,
  ShapePath,
  type BufferGeometry,
  type MeshToonMaterial,
} from 'three';
import { markShared } from '../core/dispose';
import { glyphBox, parseOutline, type GlyphOutline } from '../core/glyphBox';
import { toon } from '../core/materials';
import { palette } from '../core/theme';
import glyphsEn from '../data/glyphs.en.json';
import glyphsTa from '../data/glyphs.ta.json';
import type { Lang } from '../data/types';

const OUTLINES: Record<Lang, Record<string, GlyphOutline>> = {
  en: glyphsEn.glyphs as Record<string, GlyphOutline>,
  ta: glyphsTa.glyphs as Record<string, GlyphOutline>,
};

export function outline(lang: Lang, glyph: string): GlyphOutline | undefined {
  return OUTLINES[lang][glyph];
}

/** Outline → three.js ShapePath in "box units": the stroke box becomes [-0.5, 0.5]². */
export function glyphPath(o: GlyphOutline): ShapePath {
  const { cx, cy, size } = glyphBox(o);
  const X = (v: number): number => (v - cx) / size;
  const Y = (v: number): number => (v - cy) / size;
  const path = new ShapePath();
  for (const { op, n } of parseOutline(o.d)) {
    const v = (i: number): number => n[i] ?? 0;
    if (op === 'M') path.moveTo(X(v(0)), Y(v(1)));
    else if (op === 'L') path.lineTo(X(v(0)), Y(v(1)));
    else if (op === 'Q') path.quadraticCurveTo(X(v(0)), Y(v(1)), X(v(2)), Y(v(3)));
    else if (op === 'C') path.bezierCurveTo(X(v(0)), Y(v(1)), X(v(2)), Y(v(3)), X(v(4)), Y(v(5)));
  }
  return path;
}

const geoCache = new Map<string, BufferGeometry>();

/** Extruded glyph with a rounded bevel (brief §7.3), cached and shared. Depth along +z. */
export function glyphGeometry(lang: Lang, glyph: string): BufferGeometry | null {
  const key = `${lang}:${glyph}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const o = outline(lang, glyph);
  if (!o) return null;
  const shapes = glyphPath(o).toShapes();
  const g = new ExtrudeGeometry(shapes, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.022,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.translate(0, 0, -0.06);
  g.computeVertexNormals();
  geoCache.set(key, markShared(g));
  return g;
}

/**
 * A chunky 3D letter: bright face, darker sides. `height` is the box size in world units, so
 * the glyph itself is ~0.9 × height on its longer axis.
 */
export function createGlyph(lang: Lang, glyph: string, color: number, height: number): Group {
  const root = new Group();
  root.name = `glyph-${glyph}`;
  const g = glyphGeometry(lang, glyph);
  if (g) {
    const mats: MeshToonMaterial[] = [toon(color), toon(palette.glyphOutline)];
    const mesh = new Mesh(g, mats);
    mesh.scale.setScalar(height);
    root.add(mesh);
  }
  return root;
}
