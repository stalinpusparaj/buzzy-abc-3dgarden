/**
 * Build-time content validation (brief §6.1, §7.3). Fails the build on:
 *  - schema errors in letters / strokes / cues / VO manifest / i18n
 *  - a letter whose template needs data it lacks (strokes, distractors, match objects)
 *  - glyphs missing from the generated outlines (re-run build-letters)
 *  - i18n incompleteness: any shared VO id or parent-zone string missing in either language
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import {
  CuesSchema,
  LetterSchema,
  REQUIRED_VO,
  StrokeSchema,
  VoManifestSchema,
} from '../src/data/schema';

const DATA = join('src', 'data');
const errors: string[] = [];
const err = (m: string): void => void errors.push(m);
const read = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

function check<T>(schema: z.ZodType<T>, value: unknown, where: string): T | null {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  for (const i of r.error.issues) err(`${where}: ${i.path.join('.') || '(root)'}: ${i.message}`);
  return null;
}

const vo = check(VoManifestSchema, read(join(DATA, 'vo-manifest.json')), 'vo-manifest.json') ?? {};
for (const id of REQUIRED_VO) {
  const e = vo[id];
  if (!e) err(`vo-manifest.json: missing required id "${id}"`);
  else {
    if (!e.textEn.trim()) err(`vo-manifest.json: "${id}" has no English text`);
    if (!e.textTa.trim()) err(`vo-manifest.json: "${id}" has no Tamil text`);
  }
}

const allModels = new Set<string>();
const byLang: Record<string, z.infer<typeof LetterSchema>[]> = {};
for (const lang of ['en', 'ta'] as const) {
  const file = join(DATA, `letters.${lang}.json`);
  const raw = read(file);
  if (!Array.isArray(raw)) {
    err(`${file}: must be an array`);
    continue;
  }
  const letters = raw
    .map((l, i) => check(LetterSchema, l, `${file}[${i}]`))
    .filter((l) => l !== null);
  byLang[lang] = letters;
  const glyphs = (read(join(DATA, `glyphs.${lang}.json`)) as { glyphs: Record<string, unknown> })
    .glyphs;
  const ids = new Set<string>();
  for (const l of letters) {
    const where = `${file} ${l.id}`;
    if (ids.has(l.id)) err(`${where}: duplicate id`);
    ids.add(l.id);
    if (l.lang !== lang) err(`${where}: lang "${l.lang}" in the ${lang} file`);
    allModels.add(l.objectModel);
    for (const g of [l.glyph, ...l.distractors]) {
      if (!glyphs[g]) err(`${where}: glyph "${g}" has no outline (run npm run build-letters)`);
    }
    if (l.template === 'pollenPop' && l.distractors.length < 1)
      err(`${where}: pollenPop needs distractors`);
    if (l.distractors.includes(l.glyph)) err(`${where}: a distractor equals the target glyph`);
    if (l.template === 'basketMatch' && l.matchDistractors.length < 2)
      err(`${where}: basketMatch needs 2 matchDistractors`);
    if (l.template === 'traceTrail' && !existsSync(join(DATA, 'strokes', lang, `${l.id}.json`))) {
      err(`${where}: traceTrail needs src/data/strokes/${lang}/${l.id}.json`);
    }
    // Per-letter VO must exist for the letter's own language.
    for (const key of [l.vo.isFor, l.vo.sound, l.vo.intro]) {
      const e = vo[key];
      if (!e) err(`${where}: VO id "${key}" missing from vo-manifest.json`);
      else if (!(lang === 'en' ? e.textEn : e.textTa).trim() && !e[lang])
        err(`${where}: VO "${key}" has no ${lang} text or file`);
    }
  }
}
for (const lang of ['en', 'ta'] as const) {
  for (const l of byLang[lang] ?? []) {
    for (const m of l.matchDistractors) {
      if (!(byLang[lang] ?? []).some((x) => x.objectModel === m)) {
        err(
          `letters.${lang}.json ${l.id}: matchDistractor "${m}" is not an object of another ${lang} letter`,
        );
      }
    }
  }
}

for (const lang of ['en', 'ta'] as const) {
  const dir = join(DATA, 'strokes', lang);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const s = check(StrokeSchema, read(join(dir, f)), `strokes/${lang}/${f}`);
    if (s && `${s.id}.json` !== f)
      err(`strokes/${lang}/${f}: id "${s.id}" does not match the file name`);
  }
  const cues = check(CuesSchema, read(join(DATA, `cues.${lang}.json`)), `cues.${lang}.json`) ?? [];
  const known = new Set((byLang[lang] ?? []).map((l) => l.id));
  for (const c of cues) if (!known.has(c.id)) err(`cues.${lang}.json: unknown letter "${c.id}"`);
  for (let i = 1; i < cues.length; i++) {
    if ((cues[i]?.t ?? 0) < (cues[i - 1]?.t ?? 0))
      err(`cues.${lang}.json: cue times must increase`);
  }
}

const i18n = read(join(DATA, 'i18n.json')) as {
  strings: Record<string, { en?: string; ta?: string }>;
};
for (const [k, v] of Object.entries(i18n.strings)) {
  if (!v.en?.trim()) err(`i18n.json: "${k}" missing English`);
  if (!v.ta?.trim()) err(`i18n.json: "${k}" missing Tamil`);
}

if (errors.length) {
  console.error(`validate-data: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `validate-data: OK (${Object.values(byLang).flat().length} letters, ${Object.keys(vo).length} VO ids, ${allModels.size} object models)`,
);
