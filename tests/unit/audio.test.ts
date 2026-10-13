import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AudioEngine } from '../../src/core/audio';

/** Minimal AudioContext stand-in: records suspend/resume and gain targets. */
class FakeParam {
  value = 1;
  setTargetAtTime(v: number): void {
    this.value = v;
  }
}
class FakeGain {
  gain = new FakeParam();
  connect(): void {}
}
class FakeContext {
  static last: FakeContext | null = null;
  state: string = 'suspended';
  currentTime = 0;
  destination = {};
  resumes = 0;
  suspends = 0;
  gains: FakeGain[] = [];
  constructor() {
    FakeContext.last = this;
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  resume(): Promise<void> {
    this.resumes++;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspends++;
    this.state = 'suspended';
    return Promise.resolve();
  }
}

const listeners = new Map<string, (() => void)[]>();
const fire = (type: string): void => listeners.get(type)?.forEach((l) => l());

beforeEach(() => {
  listeners.clear();
  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: FakeContext,
    addEventListener: (t: string, l: () => void) =>
      listeners.set(t, [...(listeners.get(t) ?? []), l]),
  };
});
afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('AudioEngine (brief §8)', () => {
  it('creates and resumes the context on the start gesture', () => {
    const a = new AudioEngine();
    a.unlock();
    expect(FakeContext.last?.state).toBe('running');
  });

  it('suspends while hidden and resumes when visible again', () => {
    const a = new AudioEngine();
    a.unlock();
    const ctx = FakeContext.last!;
    a.setHidden(true);
    expect(ctx.state).toBe('suspended');
    a.setHidden(false);
    expect(ctx.state).toBe('running');
  });

  it('iOS: if the system suspends audio, the next touch resumes it', () => {
    const a = new AudioEngine();
    a.unlock();
    const ctx = FakeContext.last!;
    ctx.state = 'interrupted'; // what Safari reports after a call / Siri / backgrounding
    fire('touchend');
    expect(ctx.state).toBe('running');
  });

  it('does not resume on touch while the tab is hidden', () => {
    const a = new AudioEngine();
    a.unlock();
    const ctx = FakeContext.last!;
    a.setHidden(true);
    const before = ctx.resumes;
    fire('pointerdown');
    expect(ctx.resumes).toBe(before);
  });

  it('ducks music to 0.12 while VO plays, scaled by the parent volume', () => {
    const a = new AudioEngine();
    a.unlock();
    const music = FakeContext.last!.gains[1]!; // [master, music, vo, sfx]
    expect(music.gain.value).toBeCloseTo(0.35);
    a.duck(true);
    expect(music.gain.value).toBeCloseTo(0.12);
    a.duck(false);
    expect(music.gain.value).toBeCloseTo(0.35);
    a.setVolume('music', 0.175);
    a.duck(true);
    expect(music.gain.value).toBeCloseTo(0.06);
  });
});
