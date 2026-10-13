/**
 * zod schemas for all content (brief §6.1). Imported only by scripts/ and tests/ so zod never
 * ships to players; `type` checks below keep it in lock-step with src/data/types.ts.
 */
import { z } from 'zod';
import { TEMPLATE_IDS } from '../minigames/registry';
import type { Cue, LetterDef, StrokeDef } from './types';

export const LetterSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_]+$/, 'ASCII ids only (e.g. "ta_a")'),
    lang: z.enum(['en', 'ta']),
    glyph: z.string().min(1),
    word: z.string().min(1),
    wordRoman: z.string().optional(),
    objectModel: z.string().regex(/^[a-z0-9_]+$/),
    template: z.enum(TEMPLATE_IDS),
    distractors: z.array(z.string().min(1)),
    matchDistractors: z.array(z.string().regex(/^[a-z0-9_]+$/)),
    vo: z.object({ intro: z.string(), isFor: z.string(), sound: z.string() }),
    songSlice: z.object({ start: z.number().min(0), end: z.number().min(0) }).optional(),
    _note: z.string().optional(),
  })
  .strict();

const Point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

export const StrokeSchema = z
  .object({
    id: z.string(),
    strokes: z.array(z.array(Point).min(2)).min(1),
    placeholder: z.boolean().optional(),
  })
  .strict();

export const CueSchema = z.object({ id: z.string(), t: z.number().min(0) }).strict();
export const CuesSchema = z.array(CueSchema);

const VoFile = z.string().regex(/^$|^assets\/audio\/.+\.(mp3|ogg|m4a|wav)$/);

export const VoEntrySchema = z
  .object({
    en: VoFile,
    ta: VoFile,
    textEn: z.string(),
    textTa: z.string(),
    _note: z.string().optional(),
  })
  .strict();

export const VoManifestSchema = z.record(z.string(), VoEntrySchema);

/** Shared VO ids the brief requires in BOTH languages (§6.4). Per-letter ids are added from data. */
export const REQUIRED_VO = [
  'tap_to_start',
  'welcome',
  'pick_flower',
  'pp_instruction',
  'tt_instruction',
  'bm_instruction',
  'great_1',
  'great_2',
  'great_3',
  'try_again',
  'look_here',
  'letter_is_for',
  'sing_intro',
  'sleepy',
  'parent_gate_hint',
  'thats_a',
] as const;

// Compile-time proof that the zod shapes and the runtime types agree.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _letter: Same<z.infer<typeof LetterSchema>, LetterDef> = true;
const _stroke: Same<z.infer<typeof StrokeSchema>, StrokeDef> = true;
const _cue: Same<z.infer<typeof CueSchema>, Cue> = true;
void _letter;
void _stroke;
void _cue;
