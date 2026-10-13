import audioManifest from '../data/audio.json';
import type { AudioEngine } from './audio';
import { assetUrl } from './fonts';

export type SfxName = 'pop' | 'boop' | 'chime' | 'buzz' | 'whoosh' | 'bloom' | 'celebrate';

const SPRITE = audioManifest.sfx.sprite as Record<SfxName, [number, number]>;

/** One audio sprite for all SFX (brief §8). Silent until loaded; never throws. */
export class Sfx {
  private buffer: AudioBuffer | null = null;

  constructor(private readonly audio: AudioEngine) {}

  async load(): Promise<void> {
    this.buffer = await this.audio.load(assetUrl(audioManifest.sfx.file));
  }

  play(name: SfxName): void {
    const slot = SPRITE[name];
    if (!this.buffer || !slot) return;
    this.audio.play(this.buffer, 'sfx', { offset: slot[0], duration: slot[1] });
  }
}
