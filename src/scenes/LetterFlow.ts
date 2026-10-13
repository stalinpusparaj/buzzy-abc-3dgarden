import { Group, Object3D, type Vector3 } from 'three';
import type { GamePointerEvent } from '../core/input';
import type { GameState } from '../core/stateMachine';
import type { Scope } from '../core/tween';
import type { LetterDef } from '../data/types';
import type { Bud } from '../entities/Bud';
import type { Game } from '../game';
import type { GameContext, MiniGame } from '../minigames/MiniGame';
import { registry } from '../minigames/registry';
import { runBloom } from './Bloom';
import { clearProps, runIntro } from './LetterIntro';
import { stageFrame } from './poses';

/** Garden → LetterIntro → MiniGame → Bloom → Garden (brief §5.1). Home exits at any point. */
export class LetterFlow implements GameState<{ letterId: string }> {
  private scope: Scope | null = null;
  private game: MiniGame | null = null;
  private readonly stage = new Object3D();
  private readonly props = new Group();

  constructor(private readonly g: Game) {
    this.stage.name = 'stage';
  }

  enter({ letterId }: { letterId: string }): void {
    const g = this.g;
    const bud = g.world.bud(letterId);
    const letter = g.letter(letterId);
    if (!bud || !letter) return;
    this.scope = g.scope.child();
    g.hud.setMode('activity');
    void this.run(this.scope, bud, letter);
  }

  private async run(s: Scope, bud: Bud, letter: LetterDef): Promise<void> {
    const g = this.g;
    const seen = g.storage.get().introsSeen.includes(letter.id);
    // Intro (skippable after the first view, brief P5).
    const intro = s.child();
    if (seen) {
      g.hud.showSkip(true);
      g.hud.onSkip = () => intro.kill();
    }
    await Promise.race([
      runIntro(g, intro, bud, letter, this.props),
      new Promise<void>((r) => intro.onKill(r)),
    ]);
    if (!s.alive) return;
    intro.kill();
    g.hud.showSkip(false);
    g.storage.addUnique('introsSeen', letter.id);
    g.voice.stop();

    // Mini-game on a stage in front of the bud.
    const frame = stageFrame(bud);
    this.stage.position.copy(frame.origin);
    this.stage.rotation.set(0, frame.yaw, 0);
    g.world.root.add(this.stage);
    this.stage.updateMatrixWorld(true);
    void g.rig.moveTo(frame.pose, 1.0);
    void g.world.buzzy.setScale(0.62);
    void bud.openTo(0.25, 0.5);
    void s.wait(0.6).then(() => clearProps(this.props));
    const game = await registry[letter.template]();
    if (!s.alive) return;
    this.game = game;
    const done = new Promise<void>((resolve) => (game.onComplete = resolve));
    const mgScope = s.child();
    mgScope.onFrame((dt) => game.update(dt));
    await game.enter(this.context(mgScope), letter);
    await done;
    if (!s.alive) return;
    mgScope.kill();
    game.exit();
    this.game = null;
    g.setTargets(() => []);

    // Bloom, then back to the garden.
    await runBloom(g, s.child(), bud, letter);
    if (!s.alive) return;
    g.session.completed++;
    g.machine.go('garden', undefined);
  }

  private context(scope: Scope): GameContext {
    const g = this.g;
    return {
      scope,
      stage: this.stage,
      camera: g.rc.camera,
      input: g.input,
      voice: g.voice,
      sfx: g.sfx,
      particles: g.world.particles,
      buzzy: g.world.buzzy,
      models: g.models,
      lang: g.lang,
      older: g.storage.get().tolerance === 'big',
      letters: g.letters(),
      onHint: () => g.hintCount++,
      setTargets: (fn: () => Vector3[], wrong?: () => Vector3[]) => g.setTargets(fn, wrong),
    };
  }

  onPointer(e: GamePointerEvent): void {
    this.game?.onPointer(e);
  }

  exit(): void {
    this.scope?.kill();
    this.scope = null;
    this.game?.exit();
    this.game = null;
    clearProps(this.props);
    this.stage.removeFromParent();
    this.stage.clear();
    const g = this.g;
    g.hud.showSkip(false);
    g.hud.onSkip = () => {};
    g.voice.stop();
    g.setTargets(() => []);
    void g.world.buzzy.setScale(1);
    for (const b of g.world.buds) if (!b.bloomed && b.open > 0) void b.openTo(0, 0.4);
  }
}
