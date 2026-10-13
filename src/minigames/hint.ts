/**
 * Brief P4: after 2 misses or 6 s without progress, show the answer (pulse + Buzzy points).
 * Fires again on every further 2 misses / 6 idle seconds.
 */
export class Hint {
  private misses = 0;
  private idle = 0;

  constructor(
    private readonly fire: () => void,
    private readonly idleSeconds = 6,
    private readonly missLimit = 2,
  ) {}

  miss(): void {
    this.idle = 0;
    if (++this.misses >= this.missLimit) {
      this.misses = 0;
      this.fire();
    }
  }

  /** Any real progress resets both counters. */
  progress(): void {
    this.misses = 0;
    this.idle = 0;
  }

  update(dt: number): void {
    this.idle += dt;
    if (this.idle >= this.idleSeconds) {
      this.idle = 0;
      this.fire();
    }
  }
}
