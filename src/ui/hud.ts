import { iconButton, icons } from './icons';

export type HudMode = 'hidden' | 'garden' | 'activity';

/** Icon-only HUD (brief P1, P3: ≥ 64 CSS px targets). */
export class Hud {
  readonly el: HTMLElement;
  readonly home: HTMLButtonElement;
  readonly mute: HTMLButtonElement;
  readonly skip: HTMLButtonElement;
  readonly lang: HTMLButtonElement;
  readonly topRight: HTMLElement;
  onHome: () => void = () => {};
  onSkip: () => void = () => {};
  onMute: (muted: boolean) => void = () => {};
  onLang: () => void = () => {};
  private muted = false;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.dataset.mode = 'hidden';
    this.home = iconButton('btn-home', icons.home, 'Back to the garden');
    this.mute = iconButton('btn-mute', icons.soundOn, 'Sound on or off');
    this.skip = iconButton('btn-skip', icons.skip, 'Skip');
    this.skip.hidden = true;
    // Brief Phase 4: a big "A / அ" toggle on the garden HUD.
    this.lang = iconButton(
      'btn-lang',
      '<span class="l-en">A</span><span class="l-sep">/</span><span class="l-ta">அ</span>',
      'English or Tamil',
    );
    this.topRight = document.createElement('div');
    this.topRight.className = 'hud-tr';
    const topLeft = document.createElement('div');
    topLeft.className = 'hud-tl';
    topLeft.append(this.home, this.mute);
    this.topRight.append(this.lang);
    this.el.append(topLeft, this.topRight, this.skip);
    root.appendChild(this.el);

    const press = (b: HTMLButtonElement, fn: () => void): void => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.classList.remove('pressed');
        void b.offsetWidth;
        b.classList.add('pressed');
        fn();
      });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fn();
        }
      });
    };
    press(this.home, () => this.onHome());
    press(this.skip, () => this.onSkip());
    press(this.mute, () => this.setMuted(!this.muted, true));
    press(this.lang, () => this.onLang());
  }

  setMode(mode: HudMode): void {
    this.el.dataset.mode = mode;
    if (mode !== 'activity') this.showSkip(false);
  }

  showSkip(on: boolean): void {
    this.skip.hidden = !on;
  }

  setLang(lang: 'en' | 'ta'): void {
    this.lang.dataset.lang = lang;
  }

  setMuted(m: boolean, fromUser = false): void {
    this.muted = m;
    this.mute.innerHTML = m ? icons.soundOff : icons.soundOn;
    this.mute.setAttribute('aria-pressed', String(m));
    if (fromUser) this.onMute(m);
  }
}
