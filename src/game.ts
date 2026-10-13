import { AudioEngine } from './core/audio';
import { CameraRig } from './core/cameraRig';
import { Input } from './core/input';
import { Loop } from './core/loop';
import { guessTier, isForced, Quality, refineTier } from './core/quality';
import { createRenderContext, type RenderContext } from './core/renderer';
import { StateMachine } from './core/stateMachine';
import { Storage } from './core/storage';
import { Scope } from './core/tween';
import lettersEn from './data/letters.en.json';
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
  ta: [],
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
  lang: Lang;
  /** Letters completed this session (brief P7 gentle stop). */
  session = { started: performance.now(), completed: 0, sleepyShown: false };

  constructor(host: HTMLElement, ui: HTMLElement) {
    const tier0 = guessTier(navigator as Navigator & { deviceMemory?: number }, location.search);
    this.rc = createRenderContext(host, tier0 !== 'low');
    const { renderer, scene, camera } = this.rc;
    this.storage = new Storage();
    this.lang = this.storage.get().lang;
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
