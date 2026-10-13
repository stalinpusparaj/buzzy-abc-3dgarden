import { describe, expect, it } from 'vitest';
import { clampDt, MAX_DT } from '../../src/core/loop';
import { ease, Scope } from '../../src/core/tween';

describe('easing', () => {
  it('every ease starts at 0 and ends at 1', () => {
    for (const [name, fn] of Object.entries(ease)) {
      expect(fn(0), name).toBeCloseTo(0, 6);
      expect(fn(1), name).toBeCloseTo(1, 6);
    }
  });
  it('outBack overshoots (squash-and-stretch juice)', () => {
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map(ease.outBack))).toBeGreaterThan(1);
  });
});

describe('clampDt', () => {
  it('clamps long frames to 1/20 s', () => {
    expect(clampDt(1000)).toBe(MAX_DT);
    expect(clampDt(16)).toBeCloseTo(0.016);
    expect(clampDt(-5)).toBe(0);
    expect(clampDt(Number.NaN)).toBe(0);
  });
});

describe('Scope', () => {
  it('runs a tween to completion and resolves', async () => {
    const s = new Scope();
    const seen: number[] = [];
    const done = s.tween({ duration: 0.1, ease: ease.linear, update: (k) => seen.push(k) });
    for (let i = 0; i < 10; i++) s.update(0.02);
    await done;
    expect(seen.at(-1)).toBe(1);
  });
  it('honours delay', () => {
    const s = new Scope();
    let v = -1;
    void s.tween({ duration: 0.1, delay: 0.1, ease: ease.linear, update: (k) => (v = k) });
    s.update(0.05);
    expect(v).toBe(-1);
    s.update(0.1);
    expect(v).toBeCloseTo(0.5);
  });
  it('kill stops tweens, frames and children', () => {
    const s = new Scope();
    const c = s.child();
    let frames = 0;
    let v = 0;
    c.onFrame(() => frames++);
    void s.tween({ duration: 1, update: (k) => (v = k) });
    s.update(0.1);
    s.kill();
    s.update(0.5);
    expect(frames).toBe(1);
    expect(v).toBeLessThan(0.5);
    expect(c.alive).toBe(false);
  });
});
