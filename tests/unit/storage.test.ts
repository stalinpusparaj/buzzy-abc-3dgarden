import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, Storage } from '../../src/core/storage';

function memoryBackend(): globalThis.Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

describe('Storage', () => {
  it('round-trips progress under the versioned key', () => {
    const backend = memoryBackend();
    const a = new Storage(() => backend);
    a.addUnique('bloomed', 'A');
    a.addUnique('bloomed', 'A');
    expect(JSON.parse(backend.getItem(STORAGE_KEY) ?? '{}').bloomed).toEqual(['A']);
    expect(new Storage(() => backend).get().bloomed).toEqual(['A']);
  });

  it('keeps working in memory when every storage call throws', () => {
    const boom = (): never => {
      throw new Error('SecurityError');
    };
    const s = new Storage(boom);
    s.addUnique('bloomed', 'B');
    s.update((d) => (d.lang = 'ta'));
    expect(s.get().bloomed).toEqual(['B']);
    expect(s.get().lang).toBe('ta');
  });

  it('sanitises corrupt or hostile data', () => {
    const backend = memoryBackend();
    backend.setItem(
      STORAGE_KEY,
      JSON.stringify({ lang: 'xx', bloomed: [1, 'A', null], volume: { music: 9 } }),
    );
    const s = new Storage(() => backend);
    expect(s.get().lang).toBe('en');
    expect(s.get().bloomed).toEqual(['A']);
    expect(s.get().volume.music).toBe(0.35);
    backend.setItem(STORAGE_KEY, '{not json');
    expect(new Storage(() => backend).get().bloomed).toEqual([]);
  });

  it('reset clears progress but keeps settings', () => {
    const s = new Storage(memoryBackend);
    s.update((d) => {
      d.lang = 'ta';
      d.bloomed.push('ta_a');
    });
    s.reset();
    expect(s.get().bloomed).toEqual([]);
    expect(s.get().lang).toBe('ta');
  });
});
