import audioManifest from '../data/audio.json';
import type { Lang } from '../data/types';
import type { AudioEngine, Voice } from './audio';
import { assetUrl } from './fonts';

/**
 * Background loop: the instrumental of the song, one per language (brief §8). Lives on the
 * music bus, so it ducks under VO automatically. Stops during the sing-along.
 */
export class Music {
  private voice: Voice | null = null;
  private lang: Lang | null = null;
  private wanted = false;

  constructor(private readonly audio: AudioEngine) {}

  async start(lang: Lang): Promise<void> {
    this.wanted = true;
    if (this.voice && this.lang === lang) return;
    this.stop();
    this.wanted = true;
    this.lang = lang;
    const buf = await this.audio.load(assetUrl(audioManifest.music[lang]));
    if (!buf || !this.wanted || this.lang !== lang || this.voice) return;
    this.voice = this.audio.play(buf, 'music', { loop: true });
  }

  stop(): void {
    this.wanted = false;
    this.voice?.stop();
    this.voice = null;
  }
}
