import type { Vector3 } from 'three';
import { Models } from './core/assets';
import { AudioEngine } from './core/audio';
import { Music } from './core/music';
import { CameraRig } from './core/cameraRig';
import { Input } from './core/input';
import { Loop } from './core/loop';
import { guessTier, isForced, Quality, refineTier } from './core/quality';
import { createRenderContext, type RenderContext } from './core/renderer';
import { StateMachine } from './core/stateMachine';
import { Storage } from './core/storage';
import { Sfx } from './core/sfx';
import { Scope } from './core/tween';
import { Voice } from './core/voice';
import lettersEn from './data/letters.en.json';
import lettersTa from './data/letters.ta.json';
import { loadFont } from './core/fonts';
import { decorateSaved } from './scenes/Bloom';
import type { Lang, LetterDef } from './data/types';
import { World } from './scenes/World';
import { Hud } from './ui/hud';

export type States = {
  start: void;
  garden: void;
  letter: { letterId: string };
  sing: void;
};

const LETTERS: Record<Lang, LetterDef[]> = {
  en: lettersEn as LetterDef[],
  ta: lettersTa as LetterDef[], // REVIEW(ta): content from brief §6.3
};

/** Everything a scene or mini-game needs, built once at boot. */
export class Game {
  readonly rc: RenderContext;
  readonly loop: Loop;
  readonly scope = new Scope();
  readonly input: Input;
  readonly rig: CameraRig;
  readonly world: World;
  readonly audio = new AudioEngine();
  readonly machine = new StateMachine<States>();
  readonly hud: Hud;
  readonly quality: Quality;
  readonly storage: Storage;
  readonly models = new Models();
  readonly sfx: Sfx;
  readonly voice: Voice;
  readonly music: Music;
  lang: Lang;
  /** Sing-along cue firings (song time vs cue time), for the timing test. */
  readonly cueLog: { id: string; expected: number; actual: number }[] = [];
  /** Duration of the last song the sing-along decoded (0 = no audio), for tests. */
  songDuration = 0;
  /** Test hooks: hints fired, and the world points the current activity wants touched. */
  hintCount = 0;
  private targetsFn: () => Vector3[] = () => [];
  private wrongFn: () => Vector3[] = () => [];
  /** Letters completed this session (brief P7 gentle stop). */
  session = { started: performance.now(), completed: 0, sleepyShown: false };

  constructor(host: HTMLElement, ui: HTMLElement) {
    const tier0 = guessTier(navigator as Navigator & { deviceMemory?: number }, location.search);
    this.rc = createRenderContext(host, tier0 !== 'low');
    const { renderer, scene, camera } = this.rc;
    this.storage = new Storage();
    this.lang = this.storage.get().lang;
    this.sfx = new Sfx(this.audio);
    this.music = new Music(this.audio);
    this.voice = new Voice(
      this.audio,
      () => this.lang,
      !new URLSearchParams(location.search).has('e2e'),
    );
    this.world = new World(scene, this.scope, camera);
    this.quality = new Quality(
      refineTier(tier0, renderer),
      this.rc,
      this.world.sun,
      scene,
      !isForced(location.search),
    );
    this.rig = new CameraRig(camera, this.scope);
    this.input = new Input(renderer.domElement, camera);
    this.input.setListener((e) => this.machine.pointer(e));
    this.hud = new Hud(ui);
    this.hud.setLang(this.lang);
    document.documentElement.lang = this.lang;
    this.hud.onHome = () => {
      if (this.machine.current !== 'garden') this.machine.go('garden', undefined);
    };
    this.hud.onMute = (m) => this.audio.setMuted(m);

    this.loop = new Loop(renderer, () => renderer.render(scene, camera));
    this.loop.add((dt) => {
      this.scope.update(dt);
      this.machine.update(dt);
      this.quality.sample(this.loop.frameMs, dt);
    });
    this.loop.onPauseChange((hidden) => this.audio.setHidden(hidden));
    this.applyVolumes();
    this.world.setLetters(this.letters());
    this.world.particles.cap = this.quality.particles;
    this.quality.onChange(() => (this.world.particles.cap = this.quality.particles));
  }

  /** Switch language: rebuild the buds + saved blooms, swap the music loop (brief Phase 4). */
  async setLang(lang: Lang): Promise<void> {
    if (lang === this.lang) return;
    this.lang = lang;
    this.storage.update((d) => (d.lang = lang));
    this.hud.setLang(lang);
    this.voice.stop();
    const font = loadFont(lang); // only bubbles need it; rebuild the garden right away
    this.world.setLetters(this.letters());
    decorateSaved(this);
    if (this.audio.unlocked) void this.music.start(lang);
    document.documentElement.lang = lang;
    if (this.machine.current === 'garden') this.machine.go('garden', undefined);
    await font;
  }

  setTargets(fn: () => Vector3[], wrong: () => Vector3[] = () => []): void {
    this.targetsFn = fn;
    this.wrongFn = wrong;
  }

  targets(): Vector3[] {
    return this.targetsFn();
  }

  wrongTargets(): Vector3[] {
    return this.wrongFn();
  }

  letters(lang: Lang = this.lang): LetterDef[] {
    return LETTERS[lang];
  }

  letter(id: string): LetterDef | undefined {
    return this.letters().find((l) => l.id === id);
  }

  applyVolumes(): void {
    const v = this.storage.get().volume;
    this.audio.setVolume('music', v.music);
    this.audio.setVolume('vo', v.vo);
    this.audio.setVolume('sfx', v.sfx);
  }

  get aspect(): number {
    const s = this.rc.size();
    return s.width / Math.max(1, s.height);
  }
}
