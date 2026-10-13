/** prefers-reduced-motion (brief §11): halve camera moves, no shake, fewer particles. */
const query =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export const motion = {
  get reduced(): boolean {
    return query?.matches ?? false;
  },
  /** Multiply camera-move durations and distances by this. */
  get cameraScale(): number {
    return this.reduced ? 0.5 : 1;
  },
  get particleScale(): number {
    return this.reduced ? 0.4 : 1;
  },
};
