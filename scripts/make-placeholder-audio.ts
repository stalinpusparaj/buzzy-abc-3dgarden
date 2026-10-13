/**
 * Generates PLACEHOLDER audio, all synthesised from scratch (no samples, no third-party
 * material): the SFX sprite, a background loop and a dummy sing-along song with a bell on
 * every cue. Real recordings replace these in Phase 6 by editing src/data/audio.json only.
 *   npx tsx scripts/make-placeholder-audio.ts
 * Uses ffmpeg (if installed) to encode MP3; otherwise keeps WAV.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mulberry32 } from '../src/core/random';

const SR = 22050;
const OUT = join('public', 'assets', 'audio');
const TAU = Math.PI * 2;

type Buf = Float32Array;
const len = (s: number): number => Math.round(s * SR);
const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

function mixInto(dst: Buf, src: Buf, at: number, gain = 1): void {
  const o = len(at);
  for (let i = 0; i < src.length && o + i < dst.length; i++)
    dst[o + i] = (dst[o + i] ?? 0) + (src[i] ?? 0) * gain;
}

function tone(
  dur: number,
  f: (t: number) => number,
  env: (t: number) => number,
  shape: (p: number) => number = Math.sin,
): Buf {
  const b = new Float32Array(len(dur));
  let phase = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    phase += (TAU * f(t)) / SR;
    b[i] = shape(phase) * env(t);
  }
  return b;
}

const decay =
  (k: number, attack = 0.005) =>
  (t: number) =>
    Math.min(1, t / attack) * Math.exp(-t * k);
const tri = (p: number): number => (2 / Math.PI) * Math.asin(Math.sin(p));

/** Karplus-Strong pluck: a soft ukulele-ish note. */
function pluck(freq: number, dur: number, seed: number): Buf {
  const rnd = mulberry32(seed);
  const n = Math.max(2, Math.round(SR / freq));
  const ring = Array.from({ length: n }, () => rnd() * 2 - 1);
  const b = new Float32Array(len(dur));
  for (let i = 0; i < b.length; i++) {
    const a = ring[i % n] ?? 0;
    const c = ring[(i + 1) % n] ?? 0;
    ring[i % n] = 0.5 * (a + c) * 0.994;
    b[i] = a * Math.min(1, (b.length - i) / 400);
  }
  return b;
}

function bell(freq: number, dur = 1.2): Buf {
  const b = tone(dur, () => freq, decay(4));
  mixInto(
    b,
    tone(dur, () => freq * 2.76, decay(7)),
    0,
    0.35,
  );
  mixInto(
    b,
    tone(dur, () => freq * 5.4, decay(11)),
    0,
    0.15,
  );
  return b;
}

function noise(dur: number, env: (t: number) => number, seed: number): Buf {
  const rnd = mulberry32(seed);
  const b = new Float32Array(len(dur));
  let lp = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const k = 0.05 + 0.25 * Math.sin((Math.PI * t) / dur);
    lp += (rnd() * 2 - 1 - lp) * k;
    b[i] = lp * env(t);
  }
  return b;
}

function sfx(): { buf: Buf; sprite: Record<string, [number, number]> } {
  const parts: [string, Buf][] = [
    ['pop', tone(0.14, (t) => 950 - t * 4500, decay(28))],
    [
      'boop',
      tone(
        0.28,
        (t) => 260 - t * 120,
        (t) => Math.min(1, t / 0.02) * Math.exp(-t * 9) * 0.8,
        tri,
      ),
    ],
    ['chime', bell(midi(84), 1.0)],
    [
      'buzz',
      tone(
        0.45,
        (t) => 170 + Math.sin(t * TAU * 9) * 12,
        (t) => Math.sin((Math.PI * t) / 0.45) * 0.35,
        tri,
      ),
    ],
    ['whoosh', noise(0.55, (t) => Math.sin((Math.PI * t) / 0.55) * 1.2, 11)],
    ['bloom', arpeggio([72, 76, 79, 84], 0.11, 0.9)],
    ['celebrate', arpeggio([72, 76, 79, 84, 88, 91], 0.08, 1.1)],
  ];
  const gap = 0.12;
  const total = parts.reduce((s, [, b]) => s + b.length / SR + gap, 0);
  const buf = new Float32Array(len(total));
  const sprite: Record<string, [number, number]> = {};
  let at = 0;
  for (const [name, b] of parts) {
    mixInto(buf, b, at, 0.9);
    sprite[name] = [Number(at.toFixed(3)), Number((b.length / SR).toFixed(3))];
    at += b.length / SR + gap;
  }
  return { buf, sprite };
}

function arpeggio(notes: number[], step: number, dur: number): Buf {
  const b = new Float32Array(len(dur));
  notes.forEach((n, i) => mixInto(b, bell(midi(n), dur - i * step), i * step, 0.5));
  return b;
}

const CHORDS = [
  [60, 64, 67],
  [55, 59, 62],
  [57, 60, 64],
  [53, 57, 60],
];
const PENTA = [72, 74, 76, 79, 81];

/** 100 bpm ukulele strum + glockenspiel, 8 bars. Original, seeded, deliberately plain. */
function music(seed: number, bars = 8): Buf {
  const beat = 60 / 100;
  const buf = new Float32Array(len(bars * 4 * beat + 1));
  const rnd = mulberry32(seed);
  for (let bar = 0; bar < bars; bar++) {
    const chord = CHORDS[bar % CHORDS.length] ?? CHORDS[0]!;
    for (let b = 0; b < 4; b++) {
      const t = (bar * 4 + b) * beat;
      chord.forEach((n, i) =>
        mixInto(buf, pluck(midi(n), beat * 1.6, bar * 31 + b * 7 + i), t + i * 0.012, 0.22),
      );
      if (b % 2 === 0)
        mixInto(
          buf,
          bell(midi(PENTA[Math.floor(rnd() * PENTA.length)] ?? 72), beat * 1.5),
          t,
          0.12,
        );
    }
  }
  return buf;
}

/** Dummy song: 4 s intro, then a bell + motif exactly at each cue (cues.*.json). */
export const DUMMY_CUES = [4.0, 7.6, 11.2, 14.8, 18.4, 22.0];
function song(): Buf {
  const buf = music(5, 14);
  DUMMY_CUES.forEach((t, i) => {
    mixInto(buf, bell(midi(84 + (i % 3) * 2), 1.4), t, 0.6);
    mixInto(buf, arpeggio([67 + i, 71 + i, 74 + i], 0.18, 1.2), t + 0.6, 0.35);
  });
  return buf.slice(0, len(27));
}

function wav(buf: Buf): Buffer {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? 0.89 / peak : 1;
  const out = Buffer.alloc(44 + buf.length * 2);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + buf.length * 2, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(buf.length * 2, 40);
  buf.forEach((v, i) =>
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * k)) * 32767), 44 + i * 2),
  );
  return out;
}

function save(name: string, buf: Buf): string {
  const wavPath = join(OUT, `${name}.wav`);
  writeFileSync(wavPath, wav(buf));
  try {
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      wavPath,
      '-ac',
      '1',
      '-b:a',
      '64k',
      join(OUT, `${name}.mp3`),
    ]);
    rmSync(wavPath);
    return `assets/audio/${name}.mp3`;
  } catch {
    return `assets/audio/${name}.wav`;
  }
}

mkdirSync(OUT, { recursive: true });
const fx = sfx();
const manifest = {
  _note:
    'PLACEHOLDER audio from scripts/make-placeholder-audio.ts. Phase 6: point these at real files.',
  sfx: { file: save('sfx', fx.buf), sprite: fx.sprite },
  music: { en: save('music-loop', music(1)), ta: 'assets/audio/music-loop.mp3' },
  song: { en: save('song-dummy', song()), ta: 'assets/audio/song-dummy.mp3' },
};
if (!manifest.music.en.endsWith('.mp3')) manifest.music.ta = manifest.music.en;
if (!manifest.song.en.endsWith('.mp3')) manifest.song.ta = manifest.song.en;
writeFileSync(join('src', 'data', 'audio.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('placeholder audio written:', manifest);
