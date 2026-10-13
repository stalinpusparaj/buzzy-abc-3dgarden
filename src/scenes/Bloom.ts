import { Group, Vector3 } from 'three';
import { palette } from '../core/theme';
import type { Scope } from '../core/tween';
import { ease } from '../core/tween';
import type { LetterDef } from '../data/types';
import type { Bud } from '../entities/Bud';
import { BUD_SCALE } from '../entities/Bud';
import { createGlyph } from '../entities/Glyph3D';
import { popIn } from '../entities/juice';
import type { Game } from '../game';
import { budPose, buzzyBesideBud, towardViewer } from './poses';

const GREAT = ['great_1', 'great_2', 'great_3'];

/**
 * Permanent bloom decoration: the glyph standing on the open flower and the letter's object
 * grown big beside the bud. Lives under the bud, so it stays in the garden.
 */
export function decorateBloom(g: Game, bud: Bud): { glyph: Group; object: Group } {
  bud.bloomSlot.clear();
  bud.body.getObjectByName('bloom-object')?.removeFromParent();
  bud.bloomed = true;
  bud.setOpen(1);
  const dir = towardViewer(bud.headWorld());
  const yaw = Math.atan2(dir.x, dir.z);
  // White face + dark sides: readable against every petal colour.
  const glyph = createGlyph(g.lang, bud.letter.glyph, 0xffffff, 1.25);
  glyph.position.set(0, 0.55, 0);
  glyph.rotation.y = yaw;
  const object = new Group();
  object.add(g.models.create(bud.letter.objectModel, 1.6 / BUD_SCALE));
  const side = new Vector3(dir.z, 0, -dir.x).multiplyScalar(1.25);
  object.position.set(side.x + dir.x * 0.5, 0, side.z + dir.z * 0.5);
  object.rotation.y = yaw;
  bud.bloomSlot.add(glyph);
  // The object stands on the ground next to the stem, not in the flower.
  bud.body.add(object);
  object.name = 'bloom-object';
  return { glyph, object: object };
}

/** Re-create saved blooms for the current language (they persist in the garden, brief §5.1). */
export function decorateSaved(g: Game): void {
  const bloomed = g.storage.get().bloomed;
  for (const b of g.world.buds) if (bloomed.includes(b.letter.id)) decorateBloom(g, b);
}

/** Bloom (brief §5.1, ~5 s): full bloom, glyph + object grow, confetti, Buzzy celebrates. */
export async function runBloom(g: Game, s: Scope, bud: Bud, letter: LetterDef): Promise<void> {
  g.storage.addUnique('bloomed', letter.id); // saved first: leaving mid-bloom still counts
  void g.world.buzzy.setScale(1);
  void g.world.buzzy.flyTo(buzzyBesideBud(bud), 1.0);
  await g.rig.moveTo(budPose(bud), 1.0);
  if (!s.alive) return;
  await g.models.prepare([letter.objectModel]);
  g.sfx.play('bloom');
  const from = bud.open;
  await s.tween({
    duration: 1.1,
    ease: ease.outBack,
    update: (k) => bud.setOpen(from + (1 - from) * k),
  });
  if (!s.alive) return;
  const { glyph, object } = decorateBloom(g, bud);
  void popIn(s, glyph, 1, 0.5);
  void popIn(s, object, 1, 0.7, 0.25);
  g.sfx.play('celebrate');
  const head = bud.headWorld();
  g.world.particles.burst(head, 70, palette.petals, 6);
  void s
    .wait(0.4)
    .then(() =>
      g.world.particles.burst(head.clone().add(new Vector3(0, 1, 0)), 50, palette.petals, 5),
    );
  void g.world.buzzy.celebrate();
  void g.voice.say(GREAT[g.session.completed % GREAT.length] ?? 'great_1');
  await s.wait(2.6);
}
