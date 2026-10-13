import { BoxGeometry, Group, Mesh, Plane, Vector3, type Object3D } from 'three';
import { disposeObject } from '../core/dispose';
import type { GamePointerEvent } from '../core/input';
import { toon } from '../core/materials';
import { shuffle } from '../core/random';
import { palette } from '../core/theme';
import { ease } from '../core/tween';
import type { LetterDef } from '../data/types';
import { Basket } from '../entities/Basket';
import { sphereCollider } from '../entities/colliders';
import { popIn, squash } from '../entities/juice';
import { Hint } from './hint';
import type { GameContext, MiniGame } from './MiniGame';

const SLOTS = [-3.6, 0, 3.6];
const SLOT_Y = -2.6;
const OBJ_H = 1.7;
const BASKET_POS = new Vector3(0, 1.0, 0);
const BASKET_R = 1.9;
const ROUNDS = 2;

interface Item {
  id: string;
  correct: boolean;
  root: Group;
  home: Vector3;
}

/**
 * Template C, Basket Match (brief §5.4): drag the object that starts with the target sound
 * into Buzzy's basket. Wrong picks bounce home and get named. 2 rounds, shuffled.
 */
export class BasketMatch implements MiniGame {
  readonly id = 'basketMatch' as const;
  onComplete: () => void = () => {};
  private ctx: GameContext | null = null;
  private letter: LetterDef | null = null;
  private readonly root = new Group();
  private items: Item[] = [];
  private drag: Item | null = null;
  private round = 0;
  private hint: Hint | null = null;
  private glow = 0;
  private busy = false;
  private readonly plane = new Plane();

  async enter(ctx: GameContext, letter: LetterDef): Promise<void> {
    this.ctx = ctx;
    this.letter = letter;
    const ids = [letter.objectModel, ...letter.matchDistractors];
    await ctx.models.prepare(ids);
    if (!ctx.scope.alive) return;
    const cloth = new Mesh(new BoxGeometry(11.5, 0.12, 3.2), toon(palette.cloth));
    cloth.position.set(0, SLOT_Y - 0.1, 0.3);
    cloth.rotation.x = 0.35;
    const basket = new Basket();
    basket.root.position.copy(BASKET_POS);
    basket.root.scale.setScalar(1.25);
    basket.root.rotation.x = 0.25;
    this.root.add(cloth, basket.root);
    ctx.stage.add(this.root);
    this.hint = new Hint(() => this.showHint());
    const basketAt = (): Vector3 =>
      this.root.localToWorld(BASKET_POS.clone().add(new Vector3(0, 0.6, 1.2)));
    ctx.setTargets(
      () => {
        const c = this.items.find((i) => i.correct);
        return c
          ? [c.root.getWorldPosition(new Vector3()).add(new Vector3(0, 0.5, 0)), basketAt()]
          : [];
      },
      () => {
        const w = this.items.find((i) => !i.correct);
        return w
          ? [w.root.getWorldPosition(new Vector3()).add(new Vector3(0, 0.5, 0)), basketAt()]
          : [];
      },
    );
    void ctx.buzzy.flyTo(ctx.stage.localToWorld(new Vector3(2.9, 2.6, 0.8)), 1.0);
    this.startRound();
  }

  private startRound(): void {
    const ctx = this.ctx;
    const letter = this.letter;
    if (!ctx || !letter) return;
    for (const it of this.items) disposeObject(it.root);
    const ids = shuffle([letter.objectModel, ...letter.matchDistractors].slice(0, 3));
    this.items = ids.map((id, i) => {
      const root = new Group();
      const model = ctx.models.create(id, OBJ_H);
      root.add(model);
      const home = new Vector3(SLOTS[i] ?? 0, SLOT_Y, 0.6);
      root.position.copy(home);
      sphereCollider(root, OBJ_H * 0.75, OBJ_H * 0.5).userData.item = id;
      this.root.add(root);
      void popIn(ctx.scope, root, 1, 0.45, i * 0.12);
      return { id, correct: id === letter.objectModel, root, home };
    });
    const sound = ctx.voice.text(letter.vo.sound, { glyph: letter.glyph, letterId: letter.id });
    void ctx.voice.say(letter.vo.intro, { glyph: letter.glyph, sound, letterId: letter.id });
  }

  update(dt: number): void {
    if (!this.ctx) return;
    if (!this.drag && !this.busy) this.hint?.update(dt);
    this.glow = Math.max(0, this.glow - dt);
    const c = this.items.find((i) => i.correct);
    if (c && c !== this.drag) {
      const k = this.glow > 0 ? 1 + 0.15 * Math.abs(Math.sin(this.glow * 6)) : 1;
      c.root.children[0]?.scale.setScalar(k * OBJ_H);
    }
  }

  private stagePoint(e: GamePointerEvent): Vector3 | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    this.root.updateMatrixWorld();
    const n = new Vector3(0, 0, 1).transformDirection(this.root.matrixWorld);
    this.plane.setFromNormalAndCoplanarPoint(n, this.root.localToWorld(new Vector3(0, 0, 1.2)));
    const hit = ctx.input.planePoint(e, this.plane, new Vector3());
    return hit ? this.root.worldToLocal(hit) : null;
  }

  onPointer(e: GamePointerEvent): void {
    const ctx = this.ctx;
    if (!ctx || this.busy) return;
    if (e.type === 'down') {
      const hit = ctx.input.pick(
        e,
        this.items.map((i) => i.root.children[1] as Object3D),
      );
      const id = hit?.object.userData.item as string | undefined;
      this.drag = this.items.find((i) => i.id === id) ?? null;
      if (this.drag) {
        ctx.sfx.play('pop');
        void squash(ctx.scope, this.drag.root, 0.2, 1.15);
        this.hint?.progress();
      }
      return;
    }
    if (!this.drag) return;
    if (e.type === 'move') {
      const p = this.stagePoint(e);
      if (p) this.drag.root.position.set(p.x, p.y - OBJ_H * 0.4, 1.2);
      return;
    }
    const item = this.drag;
    this.drag = null;
    const inBasket = item.root.position.distanceTo(BASKET_POS.clone().setZ(1.2)) < BASKET_R + 0.4;
    if (inBasket && item.correct) void this.success(item);
    else void this.bounceHome(item, inBasket);
  }

  private async bounceHome(item: Item, named: boolean): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const from = item.root.position.clone();
    if (named) {
      ctx.sfx.play('boop');
      this.hint?.miss();
      const word = ctx.letters.find((l) => l.objectModel === item.id)?.word ?? item.id;
      void ctx.voice.say('thats_a', { word }, true);
    }
    await ctx.scope.tween({
      duration: 0.45,
      ease: ease.outBack,
      update: (k) => {
        item.root.position.lerpVectors(from, item.home, k);
        item.root.position.y += Math.sin(k * Math.PI) * 0.8;
      },
    });
    item.root.scale.setScalar(1);
  }

  private async success(item: Item): Promise<void> {
    const ctx = this.ctx;
    const letter = this.letter;
    if (!ctx || !letter) return;
    this.busy = true;
    const from = item.root.position.clone();
    const to = BASKET_POS.clone().add(new Vector3(0, 0.6, 0));
    await ctx.scope.tween({
      duration: 0.55,
      ease: ease.inOutSine,
      update: (k) => {
        item.root.position.lerpVectors(from, to, k);
        item.root.position.y += Math.sin(k * Math.PI) * 1.4;
        item.root.scale.setScalar(1.15 - 0.45 * k);
      },
    });
    ctx.sfx.play('chime');
    ctx.particles.burst(this.root.localToWorld(to.clone()), 40);
    void ctx.buzzy.celebrate();
    await ctx.voice.say(letter.vo.isFor, {
      glyph: letter.glyph,
      word: letter.word,
      letterId: letter.id,
    });
    if (!ctx.scope.alive) return;
    this.round++;
    this.busy = false;
    if (this.round >= ROUNDS) this.onComplete();
    else this.startRound();
  }

  private showHint(): void {
    const ctx = this.ctx;
    const c = this.items.find((i) => i.correct);
    if (!ctx || !c) return;
    ctx.onHint();
    this.glow = 3;
    void ctx.buzzy.point(c.root.getWorldPosition(new Vector3()));
  }

  exit(): void {
    const ctx = this.ctx;
    disposeObject(this.root);
    if (ctx && this.letter)
      ctx.models.release([this.letter.objectModel, ...this.letter.matchDistractors]);
    this.items = [];
    this.ctx = null;
  }
}
