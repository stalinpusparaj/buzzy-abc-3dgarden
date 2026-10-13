import { Group, Vector3 } from 'three';
import { loadFont } from '../core/fonts';
import type { GamePointerEvent } from '../core/input';
import { shuffle } from '../core/random';
import { ease } from '../core/tween';
import type { LetterDef } from '../data/types';
import { Bubble } from '../entities/Bubble';
import { squash, wobble } from '../entities/juice';
import { Hint } from './hint';
import type { GameContext, MiniGame } from './MiniGame';

const TOP = 4.4;
const BOTTOM = -4.6;
const TARGETS = 3;

/**
 * Template A, Pollen Pop (brief §5.2): 7 bubbles drift up; pop the 3 that carry the target
 * glyph. Distractors wobble and boop. One round per visit.
 */
export class PollenPop implements MiniGame {
  readonly id = 'pollenPop' as const;
  onComplete: () => void = () => {};
  private ctx: GameContext | null = null;
  private letter: LetterDef | null = null;
  private readonly root = new Group();
  private bubbles: Bubble[] = [];
  private popped = 0;
  private hint: Hint | null = null;
  private pulse = 0;

  async enter(ctx: GameContext, letter: LetterDef): Promise<void> {
    this.ctx = ctx;
    this.letter = letter;
    await loadFont(ctx.lang);
    if (!ctx.scope.alive) return;
    ctx.stage.add(this.root);
    const glyphs = [
      ...Array<string>(TARGETS).fill(letter.glyph),
      // 4 distractors; repeat the list if a letter has fewer (validate-data requires ≥ 1).
      ...shuffle([...letter.distractors, ...letter.distractors, ...letter.distractors]).slice(0, 4),
    ];
    const lanes = shuffle([-4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8]);
    shuffle(glyphs).forEach((glyph, i) => {
      const b = new Bubble(glyph, glyph === letter.glyph, ctx.lang);
      b.laneX = lanes[i] ?? 0;
      b.vy = 0.55 + Math.random() * 0.3;
      b.root.position.set(b.laneX, BOTTOM + 0.6 + (i % 2 ? 2.2 : 0) + Math.random() * 3.6, 0);
      this.bubbles.push(b);
      this.root.add(b.root);
    });
    this.hint = new Hint(() => this.showHint());
    ctx.setTargets(
      () => this.targets().map((b) => b.root.getWorldPosition(new Vector3())),
      () =>
        this.bubbles.filter((b) => !b.isTarget).map((b) => b.root.getWorldPosition(new Vector3())),
    );
    void ctx.buzzy.flyTo(ctx.stage.localToWorld(new Vector3(-6.2, 2.4, 1)), 1.0);
    void ctx.voice.say(letter.vo.intro, { glyph: letter.glyph, letterId: letter.id });
  }

  private targets(): Bubble[] {
    return this.bubbles.filter((b) => b.isTarget);
  }

  update(dt: number): void {
    if (!this.ctx) return;
    this.hint?.update(dt);
    this.pulse = Math.max(0, this.pulse - dt);
    for (const b of this.bubbles) {
      b.phase += dt;
      const p = b.root.position;
      p.y += b.vy * dt;
      p.x = b.laneX + Math.sin(b.phase * 1.3) * 0.35;
      if (p.y > TOP) p.y = BOTTOM;
      const k = b.isTarget && this.pulse > 0 ? 1 + 0.18 * Math.abs(Math.sin(this.pulse * 7)) : 1;
      if (!b.body.userData.busy) b.body.scale.setScalar(k);
    }
  }

  onPointer(e: GamePointerEvent): void {
    const ctx = this.ctx;
    if (!ctx || e.type !== 'down' || this.popped >= TARGETS) return;
    const hit = ctx.input.pick(
      e,
      this.bubbles.map((b) => b.collider),
    );
    const b = hit?.object.userData.bubble as Bubble | undefined;
    if (!b) return;
    if (b.isTarget) this.pop(b);
    else {
      ctx.sfx.play('boop');
      b.body.userData.busy = true;
      void wobble(ctx.scope, b.body, 0.4).then(() => (b.body.userData.busy = false));
      this.hint?.miss();
    }
  }

  private pop(b: Bubble): void {
    const ctx = this.ctx;
    const letter = this.letter;
    if (!ctx || !letter) return;
    this.bubbles = this.bubbles.filter((x) => x !== b);
    this.popped++;
    this.hint?.progress();
    ctx.sfx.play('pop');
    ctx.particles.burst(b.root.getWorldPosition(new Vector3()), 28);
    void ctx.voice.say(letter.vo.sound, { glyph: letter.glyph, letterId: letter.id }, true);
    b.body.userData.busy = true;
    void ctx.scope
      .tween({
        duration: 0.18,
        ease: ease.outQuad,
        update: (k) => b.body.scale.setScalar(1 + k * 0.5),
      })
      .then(() => b.root.removeFromParent());
    if (this.popped >= TARGETS) {
      void ctx.scope.wait(0.8).then(() => this.onComplete());
    }
  }

  private showHint(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.onHint();
    this.pulse = 2.5;
    const targets = this.targets();
    const buzzyAt = ctx.buzzy.position;
    const nearest = targets
      .map((b) => b.root.getWorldPosition(new Vector3()))
      .sort((a, c) => a.distanceTo(buzzyAt) - c.distanceTo(buzzyAt))[0];
    if (nearest) void ctx.buzzy.point(nearest);
    for (const t of targets) void squash(ctx.scope, t.body, 0.15);
  }

  exit(): void {
    // Bubble geometry, materials and glyph textures are shared caches: nothing to free.
    this.root.removeFromParent();
    this.bubbles = [];
    this.ctx = null;
  }
}
