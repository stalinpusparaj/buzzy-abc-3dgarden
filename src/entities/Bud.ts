import { Group, Mesh, Vector3 } from 'three';
import { toon } from '../core/materials';
import { palette } from '../core/theme';
import type { Scope } from '../core/tween';
import { ease } from '../core/tween';
import type { LetterDef } from '../data/types';
import { petalGeometry, STEM_HEIGHT, stemGeometry } from './budGeometry';
import { sphereCollider } from './colliders';
import { squash } from './juice';

export const BUD_SCALE = 1.6;

/** A giant flower bud holding one letter. Opens via a morph target; pulses when suggested. */
export class Bud {
  readonly root = new Group();
  readonly body = new Group(); // squash target
  readonly head = new Group(); // pulse target
  readonly petals: Mesh;
  readonly collider: Mesh;
  /** Bloom content (glyph + object) lives here so it moves with the bud. */
  readonly bloomSlot = new Group();
  bloomed = false;
  private openK = 0;
  private pulsing = false;
  private t = Math.random() * 10;
  private openScope: Scope | null = null;

  constructor(
    readonly letter: LetterDef,
    readonly index: number,
    position: Vector3,
    private readonly scope: Scope,
  ) {
    const color = palette.petals[index % palette.petals.length] ?? palette.petals[0];
    this.root.position.copy(position);
    this.root.scale.setScalar(BUD_SCALE);
    this.root.name = `bud-${letter.id}`;
    const stem = new Mesh(stemGeometry(), toon('vertex'));
    stem.castShadow = true;
    this.petals = new Mesh(petalGeometry(color), toon('vertex'));
    this.petals.castShadow = true;
    this.petals.position.y = -STEM_HEIGHT;
    this.head.position.y = STEM_HEIGHT;
    this.head.add(this.petals);
    this.bloomSlot.position.y = STEM_HEIGHT + 0.25;
    this.body.add(stem, this.head, this.bloomSlot);
    this.root.add(this.body);
    // Visual is ~1.5 units wide, ~3.9 tall; the collider is ~1.5x that (brief P3).
    this.collider = sphereCollider(this.root, 2.9, 2.3);
    this.collider.userData.bud = this;
  }

  /** World-space centre of the flower head. */
  headWorld(target = new Vector3()): Vector3 {
    return this.head.getWorldPosition(target).add(new Vector3(0, 0.6 * BUD_SCALE, 0));
  }

  setOpen(k: number): void {
    this.openK = k;
    const inf = this.petals.morphTargetInfluences;
    if (inf) inf[0] = k;
  }

  get open(): number {
    return this.openK;
  }

  openTo(k: number, duration = 0.8): Promise<void> {
    this.openScope?.kill();
    const s = (this.openScope = this.scope.child());
    const from = this.openK;
    return s.tween({
      duration,
      ease: ease.outBack,
      update: (e) => this.setOpen(from + (k - from) * e),
    });
  }

  setPulse(on: boolean): void {
    this.pulsing = on;
    if (!on) this.head.scale.setScalar(1);
  }

  bounce(): Promise<void> {
    return squash(this.scope, this.body, 0.22);
  }

  update(dt: number): void {
    this.t += dt;
    if (this.pulsing)
      this.head.scale.setScalar(1 + 0.08 * Math.max(0, Math.sin(this.t * Math.PI * 2 * 0.9)));
    else this.head.rotation.z = Math.sin(this.t * 1.3) * 0.03; // idle sway
  }
}
