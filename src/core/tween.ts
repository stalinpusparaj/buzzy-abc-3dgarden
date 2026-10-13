/** Tiny in-house tween + timer system (brief §7.1). Everything is owned by a Scope. */
export type Ease = (t: number) => number;

const C1 = 1.70158;
const C3 = C1 + 1;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => 1 + C3 * Math.pow(t - 1, 3) + C1 * Math.pow(t - 1, 2),
} satisfies Record<string, Ease>;

export interface TweenOptions {
  duration: number; // seconds
  ease?: Ease;
  delay?: number;
  update: (k: number) => void; // eased progress 0..1
}

interface Job {
  elapsed: number;
  delay: number;
  duration: number;
  ease: Ease;
  update: ((k: number) => void) | null;
  resolve: () => void;
}

/**
 * A Scope owns tweens, timers and per-frame callbacks. Killing a scope drops everything it
 * owns; promises it handed out simply never resolve, so `async` sequences stop cleanly.
 */
export class Scope {
  alive = true;
  private jobs: Job[] = [];
  private frames = new Set<(dt: number) => void>();
  private children = new Set<Scope>();
  private killHooks: (() => void)[] = [];

  constructor(private readonly parent: Scope | null = null) {}

  tween(o: TweenOptions): Promise<void> {
    return new Promise((resolve) => {
      if (!this.alive) return;
      this.jobs.push({
        elapsed: 0,
        delay: o.delay ?? 0,
        duration: Math.max(o.duration, 0),
        ease: o.ease ?? ease.inOutCubic,
        update: o.update,
        resolve,
      });
    });
  }

  wait(seconds: number): Promise<void> {
    return this.tween({ duration: seconds, ease: ease.linear, update: () => {} });
  }

  /** Per-frame callback bound to this scope's lifetime. Returns an unsubscribe function. */
  onFrame(fn: (dt: number) => void): () => void {
    this.frames.add(fn);
    return () => this.frames.delete(fn);
  }

  /** Run `fn` when this scope is killed (e.g. resolve a race when an intro is skipped). */
  onKill(fn: () => void): void {
    if (this.alive) this.killHooks.push(fn);
  }

  child(): Scope {
    const s = new Scope(this);
    this.children.add(s);
    return s;
  }

  update(dt: number): void {
    if (!this.alive) return;
    const jobs = this.jobs;
    for (let i = jobs.length - 1; i >= 0; i--) {
      const j = jobs[i];
      if (!j) continue;
      if (j.delay > 0) {
        j.delay -= dt;
        if (j.delay > 0) continue;
        dt = -j.delay;
        j.delay = 0;
      }
      j.elapsed += dt;
      const t = j.duration === 0 ? 1 : Math.min(j.elapsed / j.duration, 1);
      j.update?.(j.ease(t));
      if (t >= 1) {
        jobs.splice(i, 1);
        j.resolve();
      }
    }
    for (const f of this.frames) f(dt);
    for (const c of this.children) c.update(dt);
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    this.jobs.length = 0;
    this.frames.clear();
    for (const c of this.children) c.kill();
    this.children.clear();
    this.parent?.children.delete(this);
    const hooks = this.killHooks;
    this.killHooks = [];
    hooks.forEach((h) => h());
  }
}

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
