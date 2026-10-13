/**
 * Web Audio wrapper (brief §8): music / VO / SFX buses, ducking, iOS unlock + resume,
 * pause on hidden. No library: this is all the game needs.
 */
export type Bus = 'music' | 'vo' | 'sfx';

export const DEFAULT_VOLUME: Record<Bus, number> = { music: 0.35, vo: 1, sfx: 0.7 };
const DUCKED_MUSIC = 0.12;

export interface Voice {
  stop(): void;
  ended: Promise<void>;
  startedAt: number; // ctx time
}

type Ctor = typeof AudioContext;

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buses = new Map<Bus, GainNode>();
  private readonly volume: Record<Bus, number> = { ...DEFAULT_VOLUME };
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private ducks = 0;
  private muted = false;
  private hidden = false;

  /** Must run inside the first user gesture ("tap to start"). Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const w = window as Window & { webkitAudioContext?: Ctor };
      const C = window.AudioContext ?? w.webkitAudioContext;
      if (!C) return;
      const ctx = new C();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      for (const bus of ['music', 'vo', 'sfx'] as const) {
        const g = ctx.createGain();
        g.connect(this.master);
        this.buses.set(bus, g);
      }
      this.applyGains(0);
      // iOS Safari can suspend the context at any time (calls, Siri, backgrounding):
      // resume again on the next touch.
      const resume = (): void => this.resume();
      window.addEventListener('touchend', resume, { passive: true });
      window.addEventListener('pointerdown', resume, { passive: true });
    }
    this.resume();
  }

  private resume(): void {
    if (this.ctx && this.ctx.state !== 'running' && !this.hidden)
      void this.ctx.resume().catch(() => {});
  }

  /** Brief §8: pause all audio while the tab is hidden. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend().catch(() => {});
    else this.resume();
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  now(): number {
    return this.ctx?.currentTime ?? performance.now() / 1000;
  }

  setVolume(bus: Bus, v: number): void {
    this.volume[bus] = Math.max(0, Math.min(1, v));
    this.applyGains(0.05);
  }

  getVolume(bus: Bus): number {
    return this.volume[bus];
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGains(0.05);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Music ducks to 0.12 (scaled by the parent's music volume) while VO plays. */
  duck(on: boolean): void {
    this.ducks = Math.max(0, this.ducks + (on ? 1 : -1));
    this.applyGains(0.15);
  }

  private applyGains(ramp: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, Math.max(ramp, 0.001));
    const musicK = this.ducks > 0 ? DUCKED_MUSIC / DEFAULT_VOLUME.music : 1;
    for (const [bus, g] of this.buses) {
      const v = this.volume[bus] * (bus === 'music' ? musicK : 1);
      g.gain.setTargetAtTime(v, t, Math.max(ramp, 0.001));
    }
  }

  /** Fetch + decode once; resolves null (never throws) so missing audio never blocks play. */
  load(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => this.decode(data))
        .catch(() => null);
      this.buffers.set(url, p);
    }
    return p;
  }

  private async decode(data: ArrayBuffer): Promise<AudioBuffer | null> {
    if (!this.ctx) {
      // Decoding needs a context; an OfflineAudioContext works before the user gesture.
      const off = new OfflineAudioContext(1, 1, 44100);
      return off.decodeAudioData(data);
    }
    return this.ctx.decodeAudioData(data);
  }

  play(
    buffer: AudioBuffer,
    bus: Bus,
    opts: { offset?: number; duration?: number; loop?: boolean; when?: number } = {},
  ): Voice | null {
    const ctx = this.ctx;
    const out = this.buses.get(bus);
    if (!ctx || !out) return null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = opts.loop ?? false;
    src.connect(out);
    const when = opts.when ?? ctx.currentTime;
    let resolve: () => void = () => {};
    const ended = new Promise<void>((r) => (resolve = r));
    src.onended = () => resolve();
    if (opts.loop) src.start(when, opts.offset ?? 0);
    else src.start(when, opts.offset ?? 0, opts.duration);
    return {
      startedAt: when,
      ended,
      stop: () => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
        resolve();
      },
    };
  }
}
