import type { Group } from 'three';
import { Vector3 } from 'three';
import audioManifest from '../data/audio.json';
import cuesEn from '../data/cues.en.json';
import cuesTa from '../data/cues.ta.json';
import { disposeObject } from '../core/dispose';
import { assetUrl } from '../core/fonts';
import { ease, type Scope } from '../core/tween';
import type { Cue, Lang, LetterDef } from '../data/types';
import type { Bud } from '../entities/Bud';
import { createGlyph } from '../entities/Glyph3D';
import { popIn } from '../entities/juice';
import type { Game } from '../game';
import { budPose, buzzyBesideBud, towardViewer } from './poses';
import { palette } from '../core/theme';

const CUES: Record<Lang, Cue[]> = { en: cuesEn, ta: cuesTa };

/** Seconds of the full song that belong to a letter: its songSlice, else cue → next cue. */
export function songSlice(letter: LetterDef, lang: Lang): { start: number; end: number } | null {
  if (letter.songSlice) return letter.songSlice;
  const cues = CUES[lang];
  const i = cues.findIndex((c) => c.id === letter.id);
  const cue = cues[i];
  if (!cue) return null;
  return { start: cue.t, end: cues[i + 1]?.t ?? cue.t + 3.4 };
}

/**
 * LetterIntro (brief §5.1, 8–12 s): Buzzy flies to the bud, it opens a little, the giant glyph
 * rises out, the sung line plays, then "A is for Apple!" as the object pops in.
 * Returns the props it made so the caller can clear them when the mini-game starts.
 */
export async function runIntro(
  g: Game,
  s: Scope,
  bud: Bud,
  letter: LetterDef,
  props: Group,
): Promise<void> {
  const song = g.audio.load(assetUrl(audioManifest.song[g.lang]));
  void g.world.buzzy.flyTo(buzzyBesideBud(bud), 1.2);
  await g.rig.moveTo(budPose(bud), 1.0);
  if (!s.alive) return;
  g.sfx.play('whoosh');
  await bud.openTo(0.4, 0.6);
  const head = bud.headWorld();
  const dir = towardViewer(head);
  const color = palette.petals[bud.index % palette.petals.length] ?? palette.petals[0];
  const glyph = createGlyph(g.lang, letter.glyph, color, 3.2);
  glyph.rotation.y = Math.atan2(dir.x, dir.z);
  props.add(glyph);
  g.world.root.add(props);
  const from = head.clone();
  const to = head
    .clone()
    .add(new Vector3(0, 2.6, 0))
    .addScaledVector(dir, 0.6);
  g.sfx.play('bloom');
  await s.tween({
    duration: 1.0,
    ease: ease.outBack,
    update: (k) => {
      glyph.position.lerpVectors(from, to, k);
      glyph.scale.setScalar(Math.max(0.01, k));
    },
  });
  if (!s.alive) return;
  // The sung line, then the voice: queued so they never overlap (brief §8).
  const slice = songSlice(letter, g.lang);
  const buf = await Promise.race([song, s.wait(1.5).then(() => null)]);
  if (!s.alive) return;
  if (buf && slice) void g.voice.clip(buf, slice.start, Math.min(slice.end - slice.start, 4));
  const object = g.models.create(letter.objectModel, 1.8);
  const side = new Vector3(dir.z, 0, -dir.x);
  object.position
    .copy(to)
    .addScaledVector(side, -2.6)
    .add(new Vector3(0, -1.2, 0));
  object.rotation.y = glyph.rotation.y;
  props.add(object);
  void popIn(s, object, 1, 0.5, 0.2);
  await g.voice.say(letter.vo.isFor, {
    glyph: letter.glyph,
    word: letter.word,
    letterId: letter.id,
  });
  if (!s.alive) return;
  await s.wait(0.8);
}

export function clearProps(props: Group): void {
  disposeObject(props);
  props.clear();
}
