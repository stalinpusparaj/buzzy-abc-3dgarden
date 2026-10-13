import { icons } from './icons';

/**
 * Loading → tap-to-start. The big play button is the first user gesture, which unlocks
 * audio on iOS (brief §8). No text for kids; the partner line is for grown-ups.
 */
export class LoadingScreen {
  readonly el: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly start: HTMLButtonElement;

  constructor(root: HTMLElement, partnerName: string | null) {
    this.el = document.createElement('div');
    this.el.id = 'loading';
    this.el.innerHTML = `
      <div class="ld-bee">${icons.bee}</div>
      <div class="ld-bar"><i></i></div>
      <button id="start-btn" class="start-btn" type="button" aria-label="Play" hidden>${icons.play}<span class="start-finger">${icons.finger}</span></button>
      ${partnerName ? `<p class="ld-partner"></p>` : ''}`;
    root.appendChild(this.el);
    const p = this.el.querySelector('.ld-partner');
    if (p && partnerName) p.textContent = `presented by ${partnerName}`;
    this.bar = this.el.querySelector('.ld-bar i') as HTMLElement;
    this.start = this.el.querySelector('#start-btn') as HTMLButtonElement;
  }

  progress(k: number): void {
    this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`;
  }

  /** Resolves on the first tap of the play button (pointerdown: no 300 ms click delay). */
  waitForStart(): Promise<void> {
    this.el.classList.add('ready');
    this.start.hidden = false;
    return new Promise((resolve) => {
      const go = (e: Event): void => {
        e.preventDefault();
        this.start.removeEventListener('pointerdown', go);
        this.start.removeEventListener('keydown', key);
        resolve();
      };
      const key = (e: KeyboardEvent): void => {
        if (e.key === 'Enter' || e.key === ' ') go(e);
      };
      this.start.addEventListener('pointerdown', go);
      this.start.addEventListener('keydown', key);
    });
  }

  hide(): void {
    this.el.classList.add('gone');
    window.setTimeout(() => this.el.remove(), 500);
  }
}
