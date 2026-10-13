import { Mesh, MeshToonMaterial, TorusKnotGeometry } from 'three';
import { disposeObject } from '../core/dispose';
import { toonGradient } from '../core/materials';
import type { GameState } from '../core/stateMachine';
import type { Scope } from '../core/tween';
import type { Bud } from '../entities/Bud';
import { popIn } from '../entities/juice';
import type { Game } from '../game';
import { budPose, buzzyBesideBud } from './poses';

/** Phase 1 stub: fly to the bud, open it a little, show a placeholder, home returns. */
export class LetterFlow implements GameState<{ letterId: string }> {
  private scope: Scope | null = null;
  private bud: Bud | null = null;
  private stub: Mesh | null = null;

  constructor(private readonly g: Game) {}

  enter({ letterId }: { letterId: string }): void {
    const g = this.g;
    const bud = g.world.bud(letterId);
    if (!bud) return;
    this.bud = bud;
    const s = (this.scope = g.scope.child());
    g.hud.setMode('activity');
    void g.world.buzzy.flyTo(buzzyBesideBud(bud), 1.2);
    void g.rig.moveTo(budPose(bud), 1.0).then(async () => {
      await bud.openTo(0.35, 0.6);
      const stub = new Mesh(
        new TorusKnotGeometry(0.6, 0.2, 48, 8),
        new MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient() }),
      );
      stub.position.copy(bud.headWorld());
      stub.position.y += 1.6;
      g.world.root.add(stub);
      this.stub = stub;
      s.onFrame((dt) => (stub.rotation.y += dt * 2));
      await popIn(s, stub, 1);
    });
  }

  exit(): void {
    this.scope?.kill();
    this.scope = null;
    if (this.stub) disposeObject(this.stub);
    this.stub = null;
    if (this.bud && !this.bud.bloomed) void this.bud.openTo(0, 0.4);
    this.bud = null;
  }
}
