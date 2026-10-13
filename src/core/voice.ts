import voManifest from '../data/vo-manifest.json';
import type { Lang } from '../data/types';
import type { AudioEngine } from './audio';
import { assetUrl } from './fonts';

interface VoEntry {
  en: string;
  ta: string;
  textEn: string;
  textTa: string;
}

const MANIFEST = voManifest as Record<string, VoEntry>;
export type VoVars = Record<string, string>;

export function fill(text: string, vars: VoVars): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

/**
 * Voice-over (brief §6.4, §8). Lookup order: a per-letter recording `{letterId}_{id}`, then
 * the shared `{id}` recording, then speechSynthesis (en-IN / ta-IN). If there is no Tamil
 * voice, `onNoVoice` fires so the game pulses the glyph + chimes instead.
 * Everything is queued: VO and sung lines never overlap. Nothing ever blocks gameplay:
 * every line resolves, even if audio or TTS silently fails.
 */
export class Voice {
  onNoVoice: (() => void) | null = null;
  private queue: Promise<void> = Promise.resolve();
  private generation = 0;
  private stopCurrent: (() => void) | null = null;

  constructor(
    private readonly audio: AudioEngine,
    private readonly lang: () => Lang,
    private readonly tts = typeof speechSynthesis !== 'undefined',
  ) {}

  /** iOS: speechSynthesis must be primed inside a user gesture. */
  unlock(): void {
    if (!this.tts) return;
    try {
      speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    } catch {
      /* ignore */
    }
  }

  /** Queue a line. `interrupt` drops anything queued or playing first. */
  say(id: string, vars: VoVars = {}, interrupt = false): Promise<void> {
    if (interrupt) this.stop();
    return this.enqueue(() => this.speak(id, vars));
  }

  /** Queue an arbitrary clip (e.g. the sung line for a letter) on the VO bus. */
  clip(buffer: AudioBuffer, offset: number, duration: number): Promise<void> {
    return this.enqueue(() => this.playBuffer(buffer, offset, duration));
  }

  stop(): void {
    this.generation++;
    this.queue = Promise.resolve();
    this.stopCurrent?.();
    this.stopCurrent = null;
    if (this.tts) speechSynthesis.cancel();
  }

  text(id: string, vars: VoVars = {}): string {
    const e = MANIFEST[`${vars.letterId}_${id}`] ?? MANIFEST[id];
    if (!e) return '';
    return fill(this.lang() === 'ta' ? e.textTa : e.textEn, vars);
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const gen = this.generation;
    const run = this.queue.then(() => (gen === this.generation ? task() : undefined));
    this.queue = run.catch(() => {});
    return this.queue;
  }

  private async speak(id: string, vars: VoVars): Promise<void> {
    const lang = this.lang();
    const entry = MANIFEST[`${vars.letterId}_${id}`] ?? MANIFEST[id];
    if (!entry) return;
    const file = entry[lang];
    if (file) {
      const buf = await this.audio.load(assetUrl(file));
      if (buf) return this.playBuffer(buf, 0, buf.duration);
    }
    const text = fill(lang === 'ta' ? entry.textTa : entry.textEn, vars);
    if (text) await this.speakTts(text, lang);
  }

  private async playBuffer(buf: AudioBuffer, offset: number, duration: number): Promise<void> {
    const v = this.audio.play(buf, 'vo', { offset, duration });
    if (!v) return;
    this.audio.duck(true);
    this.stopCurrent = () => v.stop();
    await Promise.race([v.ended, sleep((duration + 0.5) * 1000)]);
    this.audio.duck(false);
  }

  private pickVoice(lang: Lang): SpeechSynthesisVoice | null {
    const all = speechSynthesis.getVoices();
    const want = lang === 'ta' ? ['ta-IN', 'ta'] : ['en-IN', 'en-GB', 'en-US', 'en'];
    for (const w of want) {
      const v = all.find((x) => x.lang.replace('_', '-').toLowerCase().startsWith(w.toLowerCase()));
      if (v) return v;
    }
    return null;
  }

  private async speakTts(text: string, lang: Lang): Promise<void> {
    if (!this.tts || this.audio.isMuted) return;
    const voice = this.pickVoice(lang);
    if (!voice) {
      if (lang === 'ta') this.onNoVoice?.();
      return sleep(600);
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.85; // ~20 % slower than adult speech (ASSET_PROMPTS §2)
    u.pitch = 1.15;
    u.volume = this.audio.getVolume('vo');
    const done = new Promise<void>((r) => {
      u.onend = () => r();
      u.onerror = () => r();
    });
    this.audio.duck(true);
    this.stopCurrent = () => speechSynthesis.cancel();
    speechSynthesis.speak(u);
    await Promise.race([done, sleep(800 + text.length * 110)]);
    this.audio.duck(false);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
