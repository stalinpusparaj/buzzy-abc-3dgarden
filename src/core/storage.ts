import type { Lang } from '../data/types';

/** Brief §7.3: everything we persist. Nothing personal, ever (brief §10). */
export interface SaveData {
  lang: Lang;
  bloomed: string[];
  introsSeen: string[];
  tolerance: 'little' | 'big';
  volume: { music: number; vo: number; sfx: number };
}

export const STORAGE_KEY = 'buzzyabc:v1';

export function defaults(): SaveData {
  return {
    lang: 'en',
    bloomed: [],
    introsSeen: [],
    tolerance: 'little',
    volume: { music: 0.35, vo: 1, sfx: 0.7 },
  };
}

function sanitize(raw: unknown): SaveData {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const vol = (v: unknown, fallback: number): number =>
    typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback;
  return {
    lang: r.lang === 'ta' ? 'ta' : 'en',
    bloomed: strings(r.bloomed),
    introsSeen: strings(r.introsSeen),
    tolerance: r.tolerance === 'big' ? 'big' : 'little',
    volume: {
      music: vol(r.volume?.music, d.volume.music),
      vo: vol(r.volume?.vo, d.volume.vo),
      sfx: vol(r.volume?.sfx, d.volume.sfx),
    },
  };
}

/**
 * localStorage with every call wrapped: private mode, quota errors or a blocked storage API
 * must never break the game. Falls back to in-memory state.
 */
export class Storage {
  private data: SaveData;

  constructor(
    private readonly backend: () => globalThis.Storage | null = () => window.localStorage,
  ) {
    this.data = this.read();
  }

  private read(): SaveData {
    try {
      const raw = this.backend()?.getItem(STORAGE_KEY);
      return sanitize(raw ? JSON.parse(raw) : null);
    } catch {
      return defaults();
    }
  }

  get(): Readonly<SaveData> {
    return this.data;
  }

  update(fn: (d: SaveData) => void): void {
    fn(this.data);
    try {
      this.backend()?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* in-memory only */
    }
  }

  addUnique(key: 'bloomed' | 'introsSeen', id: string): void {
    if (this.data[key].includes(id)) return;
    this.update((d) => d[key].push(id));
  }

  reset(): void {
    const keep = { lang: this.data.lang, volume: this.data.volume, tolerance: this.data.tolerance };
    this.data = { ...defaults(), ...keep };
    try {
      this.backend()?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* in-memory only */
    }
  }
}
