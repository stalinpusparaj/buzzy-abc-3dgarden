import type { Lang } from '../data/types';

/** Self-hosted OFL fonts (brief §7.3, §10.2). Copied into public/ by scripts/build-letters.ts. */
export const FONTS: Record<Lang, { family: string; file: string }> = {
  en: { family: 'Baloo 2', file: 'assets/fonts/baloo2-latin-700.woff2' },
  ta: { family: 'Baloo Thambi 2', file: 'assets/fonts/baloothambi2-tamil-700.woff2' },
};

export const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

const loaded = new Map<Lang, Promise<boolean>>();

/**
 * Canvas text (bubble glyphs) must wait for the real font, or Tamil renders in a fallback
 * (brief §5.2). Resolves false (never throws) if the font can't load.
 */
export function loadFont(lang: Lang): Promise<boolean> {
  let p = loaded.get(lang);
  if (!p) {
    const { family, file } = FONTS[lang];
    p = (async () => {
      if (typeof FontFace === 'undefined') return false;
      try {
        const face = new FontFace(family, `url(${assetUrl(file)})`, { weight: '700' });
        document.fonts.add(await face.load());
        return true;
      } catch {
        return false;
      }
    })();
    loaded.set(lang, p);
  }
  return p;
}

export function cssFont(lang: Lang, px: number): string {
  return `700 ${px}px "${FONTS[lang].family}", "${FONTS.en.family}", sans-serif`;
}
