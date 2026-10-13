import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface PackLetter {
  id: string;
  lang: 'en' | 'ta';
  objectModel: string;
  vo: { intro: string; isFor: string; sound: string };
}
type VoManifest = Record<string, { en?: string; ta?: string }>;

const size = (p: string): number => (existsSync(p) ? statSync(p).size : 0);

/** Bytes per letter pack: model GLB + its VO files + its stroke file (brief §7.4). */
export function letterPackFiles(dist: string): { id: string; lang: string; bytes: number }[] {
  const out: { id: string; lang: string; bytes: number }[] = [];
  const voPath = join('src', 'data', 'vo-manifest.json');
  const vo: VoManifest = existsSync(voPath)
    ? (JSON.parse(readFileSync(voPath, 'utf8')) as VoManifest)
    : {};
  for (const lang of ['en', 'ta'] as const) {
    const p = join('src', 'data', `letters.${lang}.json`);
    if (!existsSync(p)) continue;
    for (const l of JSON.parse(readFileSync(p, 'utf8')) as PackLetter[]) {
      let bytes = size(join(dist, 'assets', 'models', `${l.objectModel}.glb`));
      for (const key of [l.vo.isFor, l.vo.sound]) {
        const file = vo[key]?.[lang];
        if (file) bytes += size(join(dist, file));
      }
      bytes += size(join('src', 'data', 'strokes', lang, `${l.id}.json`));
      out.push({ id: l.id, lang, bytes });
    }
  }
  return out;
}
