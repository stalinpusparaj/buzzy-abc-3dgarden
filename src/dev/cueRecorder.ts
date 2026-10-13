import { AudioEngine } from '../core/audio';
import { assetUrl } from '../core/fonts';
import audioManifest from '../data/audio.json';
import lettersEn from '../data/letters.en.json';
import lettersTa from '../data/letters.ta.json';
import { CuesSchema } from '../data/schema';
import type { Cue, Lang, LetterDef } from '../data/types';
import { buildCues } from './cueMath';

const LETTERS: Record<Lang, LetterDef[]> = {
  en: lettersEn as LetterDef[],
  ta: lettersTa as LetterDef[],
};

/**
 * Dev-only Cue Recorder (brief §5.6) at /?dev=cues[&lang=ta].
 * Play the song and press 1–6 (or the letter's key) as each letter is sung. Export validates
 * the result against the same zod schema the build uses, then copies the JSON.
 * Times come from the AudioContext clock, exactly like the sing-along's cue scheduler.
 */
export function startCueRecorder(root: HTMLElement): void {
  let lang: Lang = new URLSearchParams(location.search).get('lang') === 'ta' ? 'ta' : 'en';
  const audio = new AudioEngine();
  let presses: Cue[] = [];
  let started = -1;
  let stopSong: (() => void) | null = null;

  root.innerHTML = `
    <div id="cue-recorder" class="devtool">
      <div class="panel">
        <strong>Cue recorder (dev only)</strong>
        <label>Language <select id="cr-lang"><option value="en">English</option><option value="ta">தமிழ்</option></select></label>
        <p>Press <b>Play</b>, then tap <b>1–6</b> (or the letter key) as each letter is sung. First press per letter counts.</p>
        <div class="row"><button id="cr-play">Play</button><button id="cr-stop">Stop</button><button id="cr-export">Export JSON</button></div>
        <div class="keys" id="cr-keys"></div>
        <p>Song time: <b id="cr-time">0.00</b> s</p>
        <textarea id="cr-out" rows="10"></textarea>
        <span id="cr-msg"></span>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector(sel) as T;
  const langSel = $<HTMLSelectElement>('#cr-lang');
  const keys = $<HTMLElement>('#cr-keys');
  const time = $<HTMLElement>('#cr-time');
  const out = $<HTMLTextAreaElement>('#cr-out');
  const msg = $<HTMLElement>('#cr-msg');

  const letters = (): LetterDef[] => LETTERS[lang].slice(0, 9);
  const renderKeys = (): void => {
    const hit = new Set(presses.map((p) => p.id));
    keys.innerHTML = letters()
      .map(
        (l, i) =>
          `<div class="key${hit.has(l.id) ? ' hit' : ''}">${l.glyph}<small>${i + 1}</small></div>`,
      )
      .join('');
  };
  const now = (): number => (started < 0 ? 0 : audio.now() - started);

  langSel.value = lang;
  langSel.onchange = () => {
    lang = langSel.value === 'ta' ? 'ta' : 'en';
    presses = [];
    renderKeys();
  };
  $<HTMLButtonElement>('#cr-play').onclick = async () => {
    audio.unlock();
    stopSong?.();
    const buf = await audio.load(assetUrl(audioManifest.song[lang]));
    if (!buf) {
      msg.textContent = 'Could not load the song file.';
      return;
    }
    presses = [];
    renderKeys();
    const v = audio.play(buf, 'vo');
    started = v?.startedAt ?? audio.now();
    stopSong = () => v?.stop();
  };
  $<HTMLButtonElement>('#cr-stop').onclick = () => {
    stopSong?.();
    stopSong = null;
    started = -1;
  };
  window.addEventListener('keydown', (e) => {
    if (started < 0 || e.target instanceof HTMLTextAreaElement) return;
    const n = Number(e.key);
    const l =
      Number.isInteger(n) && n >= 1
        ? letters()[n - 1]
        : letters().find((x) => x.glyph.toLowerCase() === e.key.toLowerCase());
    if (!l) return;
    presses.push({ id: l.id, t: now() });
    renderKeys();
  });
  $<HTMLButtonElement>('#cr-export').onclick = () => {
    const cues = buildCues(
      presses,
      LETTERS[lang].map((l) => l.id),
    );
    const ok = CuesSchema.safeParse(cues).success;
    const json = JSON.stringify(cues, null, 2);
    out.value = json;
    msg.className = ok ? 'ok' : 'bad';
    msg.textContent = ok ? `Valid. Save as src/data/cues.${lang}.json` : 'Invalid cue data';
    void navigator.clipboard?.writeText(json).catch(() => {});
  };
  const tick = (): void => {
    time.textContent = now().toFixed(2);
    requestAnimationFrame(tick);
  };
  renderKeys();
  tick();
}
