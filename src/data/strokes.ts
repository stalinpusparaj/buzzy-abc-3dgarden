import type { Lang, StrokeDef } from './types';

/** Stroke files are lazy chunks: they load with their letter pack (brief §7.3). */
const files = import.meta.glob<{ default: StrokeDef }>('./strokes/*/*.json');

export async function loadStrokes(lang: Lang, id: string): Promise<StrokeDef | null> {
  const load = files[`./strokes/${lang}/${id}.json`];
  if (!load) return null;
  try {
    return (await load()).default;
  } catch {
    return null;
  }
}
