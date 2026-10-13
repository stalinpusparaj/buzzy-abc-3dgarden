import type { WebGLRenderer } from 'three';

/** Largest simulation step (brief §7.3): a long frame never teleports anything. */
export const MAX_DT = 1 / 20;

export function clampDt(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs / 1000, MAX_DT);
}

export type Tick = (dt: number) => void;

/**
 * Drives `renderer.setAnimationLoop`. Pauses everything while the tab is hidden and tells
 * listeners (audio) so they can pause too.
 */
export class Loop {
  private ticks: Tick[] = [];
  private last = -1;
  private running = false;
  private pauseListeners = new Set<(paused: boolean) => void>();
  /** Real frame time in ms of the last frame (for quality probes / perf overlay). */
  frameMs = 16.7;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly render: () => void,
  ) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else this.start();
      this.pauseListeners.forEach((l) => l(document.hidden));
    });
  }

  add(t: Tick): () => void {
    this.ticks.push(t);
    return () => {
      this.ticks = this.ticks.filter((x) => x !== t);
    };
  }

  onPauseChange(l: (paused: boolean) => void): void {
    this.pauseListeners.add(l);
  }

  start(): void {
    if (this.running || document.hidden) return;
    this.running = true;
    this.last = -1;
    this.renderer.setAnimationLoop(this.frame);
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private frame = (now: number): void => {
    const delta = this.last < 0 ? 0 : now - this.last;
    this.last = now;
    if (delta > 0) this.frameMs = delta;
    const dt = clampDt(delta);
    for (const t of this.ticks) t(dt);
    this.render();
  };
}
