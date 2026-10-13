/** Content types (brief §6.1). `src/data/schema.ts` validates JSON against the same shape with zod. */
import type { TemplateId } from '../minigames/registry';

export type { TemplateId };
export type Lang = 'en' | 'ta';

export interface LetterDef {
  id: string; // "A" | "ta_a"
  lang: Lang;
  glyph: string; // "A" | "அ"
  word: string; // "Apple" | "அணில்"
  wordRoman?: string; // reference only, never shown to kids
  objectModel: string; // "apple" → assets/models/apple.glb (placeholder primitive until Phase 6)
  template: TemplateId;
  distractors: string[]; // glyphs for Pollen Pop
  matchDistractors: string[]; // objectModel ids for Basket Match
  vo: { intro: string; isFor: string; sound: string }; // keys into vo-manifest
  songSlice?: { start: number; end: number }; // seconds within the full song
  _note?: string; // review notes, e.g. "REVIEW(ta)"
}

export interface StrokeDef {
  id: string;
  /** Polylines in a 0–1 box, y up (brief §5.3). */
  strokes: [number, number][][];
  placeholder?: boolean;
}

export interface Cue {
  id: string;
  t: number; // seconds
}
