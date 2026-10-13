import type { Object3D, PerspectiveCamera, Vector3 } from 'three';
import type { Models } from '../core/assets';
import type { GamePointerEvent, Input } from '../core/input';
import type { Sfx } from '../core/sfx';
import type { Scope } from '../core/tween';
import type { Voice } from '../core/voice';
import type { Lang, LetterDef } from '../data/types';
import type { Buzzy } from '../entities/Buzzy';
import type { PollenParticles } from '../entities/PollenParticles';
import type { TemplateId } from './registry';

/** What a mini-game may use. It owns nothing here except what it adds under `stage`. */
export interface GameContext {
  /** Killed on exit: tweens, timers and per-frame callbacks stop automatically. */
  scope: Scope;
  /** Local play frame: x right, y up, z toward the camera; roughly x ±6, y ±3.5 visible. */
  stage: Object3D;
  camera: PerspectiveCamera;
  input: Input;
  voice: Voice;
  sfx: Sfx;
  particles: PollenParticles;
  buzzy: Buzzy;
  models: Models;
  lang: Lang;
  /** Parent setting "Big (5–6)": tighter tracing tolerance. */
  older: boolean;
  letters: LetterDef[];
  /** Called whenever a hint fires (tests count these). */
  onHint(): void;
  /** Expose the world points a test should tap/drag next (and, optionally, wrong answers). */
  setTargets(fn: () => Vector3[], wrong?: () => Vector3[]): void;
}

/** Brief §5.5 template interface. */
export interface MiniGame {
  readonly id: TemplateId;
  enter(ctx: GameContext, letter: LetterDef): Promise<void>;
  update(dt: number): void;
  onPointer(e: GamePointerEvent): void;
  /** Dispose geometries/materials/textures: no leaks. */
  exit(): void;
  /** Set by the state machine. */
  onComplete: () => void;
}
