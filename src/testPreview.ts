import { Color, DirectionalLight, Group, HemisphereLight } from 'three';
import { loadFont } from './core/fonts';
import type { Lang } from './data/types';
import { Bubble } from './entities/Bubble';
import { createGlyph } from './entities/Glyph3D';
import type { Game } from './game';

/**
 * E2E-only: show one glyph two ways on a plain background (the extruded 3D letter and the
 * canvas-font bubble) so screenshot tests can prove each glyph renders correctly.
 */
export async function previewGlyph(g: Game, lang: Lang, glyph: string): Promise<void> {
  await loadFont(lang);
  const scene = g.rc.scene;
  scene.getObjectByName('glyph-preview')?.removeFromParent();
  g.world.root.visible = false;
  g.hud.setMode('hidden');
  scene.background = new Color(0xe0f4ff);
  const root = new Group();
  root.name = 'glyph-preview';
  const letter = createGlyph(lang, glyph, 0xff8fa3, 4.2);
  letter.position.set(-2.4, 0, 0);
  const bubble = new Bubble(glyph, true, lang, 1.7);
  bubble.root.position.set(2.6, 0, 0);
  root.add(letter, bubble.root, new HemisphereLight(0xffffff, 0x7bc950, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 6);
  root.add(sun);
  scene.add(root);
  g.rig.set({
    pos: root.position.clone().set(0, 0.4, 11),
    look: root.position.clone().set(0, 0, 0),
  });
}
