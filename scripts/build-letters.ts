/**
 * Fonts + 3D glyph pipeline (brief §7.3), run at build time.
 *  1. Reads every glyph the content uses (letters + distractors) per language.
 *  2. Extracts each outline from the self-hosted OFL font with opentype.js and writes a compact
 *     outline JSON (src/data/glyphs.{lang}.json) that the game extrudes with a bevel at runtime.
 *  3. Copies the subset web fonts (+ their OFL licence) into public/assets/fonts.
 * Every glyph must be ONE code point with a real glyph (no shaping engine needed); any
 * exception fails the build.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype, { type PathCommand } from 'opentype.js';

interface FontSpec {
  family: string;
  pkg: string;
  file: string;
  out: string;
}

export const FONTS: Record<'en' | 'ta', FontSpec> = {
  en: {
    family: 'Baloo 2',
    pkg: '@fontsource/baloo-2',
    file: 'baloo-2-latin-700-normal',
    out: 'baloo2-latin-700',
  },
  ta: {
    family: 'Baloo Thambi 2',
    pkg: '@fontsource/baloo-thambi-2',
    file: 'baloo-thambi-2-tamil-700-normal',
    out: 'baloothambi2-tamil-700',
  },
};

interface LetterLike {
  glyph: string;
  distractors: string[];
}

const r = (n: number | undefined): number => Math.round((n ?? 0) * 1000);

/** y is flipped so +y is up; units are 1/1000 em. */
function encode(cmds: PathCommand[]): string {
  return cmds
    .map((c) => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${r(c.x)},${-r(c.y)}`;
        case 'Q':
          return `Q${r(c.x1)},${-r(c.y1)},${r(c.x)},${-r(c.y)}`;
        case 'C':
          return `C${r(c.x1)},${-r(c.y1)},${r(c.x2)},${-r(c.y2)},${r(c.x)},${-r(c.y)}`;
        default:
          return 'Z';
      }
    })
    .join(' ');
}

function bbox(cmds: PathCommand[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of cmds) {
    for (const [x, y] of [
      [c.x, c.y],
      [c.x1, c.y1],
      [c.x2, c.y2],
    ]) {
      if (x === undefined || y === undefined) continue;
      x0 = Math.min(x0, r(x));
      x1 = Math.max(x1, r(x));
      y0 = Math.min(y0, -r(y));
      y1 = Math.max(y1, -r(y));
    }
  }
  return [x0, y0, x1, y1];
}

function build(lang: 'en' | 'ta'): void {
  const lettersPath = join('src', 'data', `letters.${lang}.json`);
  const spec = FONTS[lang];
  if (!existsSync(lettersPath)) {
    console.log(`build-letters: ${lang}: no letters yet`);
    const empty = { family: spec.family, weight: 700, units: 1000, glyphs: {} };
    writeFileSync(join('src', 'data', `glyphs.${lang}.json`), JSON.stringify(empty) + '\n');
    return;
  }
  const letters = JSON.parse(readFileSync(lettersPath, 'utf8')) as LetterLike[];
  const chars = [...new Set(letters.flatMap((l) => [l.glyph, ...l.distractors]))];
  const fontFile = join('node_modules', spec.pkg, 'files', `${spec.file}.woff`);
  const buf = readFileSync(fontFile);
  const font = opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  );
  const glyphs: Record<string, { d: string; bbox: [number, number, number, number] }> = {};
  const problems: string[] = [];
  for (const ch of chars) {
    const cps = [...ch];
    if (cps.length !== 1) problems.push(`${ch}: ${cps.length} code points (needs shaping)`);
    const g = font.charToGlyph(ch);
    if (g.index === 0) problems.push(`${ch}: missing from ${spec.family}`);
    const cmds = g.getPath(0, 0, 1).commands;
    glyphs[ch] = { d: encode(cmds), bbox: bbox(cmds) };
    console.log(
      `build-letters: ${lang} ${ch} U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase()} glyph #${g.index}, ${cmds.length} path commands`,
    );
  }
  if (problems.length) {
    console.error(`build-letters: glyph problems:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  const out = { family: spec.family, weight: 700, units: 1000, glyphs };
  writeFileSync(join('src', 'data', `glyphs.${lang}.json`), JSON.stringify(out) + '\n');

  const fontsDir = join('public', 'assets', 'fonts');
  mkdirSync(fontsDir, { recursive: true });
  copyFileSync(
    join('node_modules', spec.pkg, 'files', `${spec.file}.woff2`),
    join(fontsDir, `${spec.out}.woff2`),
  );
  copyFileSync(join('node_modules', spec.pkg, 'LICENSE'), join(fontsDir, `OFL-${spec.out}.txt`));
}

build('en');
build('ta');
