import type { GamePointerEvent } from '../core/input';
import type { GameState } from '../core/stateMachine';
import type { Scope } from '../core/tween';
import type { Bud } from '../entities/Bud';
import type { Game } from '../game';
import { BUZZY_HOME } from './layout';
import { buzzyBesideBud, overviewPose } from './poses';

/** The hub: tap a bud to learn its letter, tap the gazebo to sing (brief §5.1). */
export class GardenScene implements GameState<void> {
  private scope: Scope | null = null;

  constructor(private readonly g: Game) {}

  enter(): void {
    const g = this.g;
    this.scope = g.scope.child();
    g.hud.setMode('garden');
    void g.rig.moveTo(overviewPose(g.aspect), 1.0);
    this.refreshSuggestion();
    const next = this.suggested();
    void g.world.buzzy.flyTo(
      next && !g.session.sleepyShown ? buzzyBesideBud(next) : BUZZY_HOME,
      1.2,
    );
  }

  exit(): void {
    this.scope?.kill();
    this.scope = null;
    for (const b of this.g.world.buds) b.setPulse(false);
  }

  /** The first un-bloomed bud gently pulses. Nothing is ever locked (brief §5.1). */
  refreshSuggestion(): void {
    const next = this.suggested();
    for (const b of this.g.world.buds) b.setPulse(b === next && !this.g.session.sleepyShown);
  }

  suggested(): Bud | undefined {
    const bloomed = this.g.storage.get().bloomed;
    return this.g.world.buds.find((b) => !bloomed.includes(b.letter.id));
  }

  onPointer(e: GamePointerEvent): void {
    if (e.type !== 'down') return;
    const w = this.g.world;
    const hit = this.g.input.pick(e, [
      ...w.buds.map((b) => b.collider),
      w.gazebo.collider,
      w.buzzy.collider,
    ]);
    if (!hit) return;
    const bud = hit.object.userData.bud as Bud | undefined;
    if (bud) {
      void bud.bounce();
      this.g.machine.go('letter', { letterId: bud.letter.id });
    } else if (hit.object === w.gazebo.collider) {
      this.g.machine.go('sing', undefined);
    } else if (hit.object === w.buzzy.collider) {
      void w.buzzy.celebrate();
    }
  }
}
