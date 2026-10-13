import {
  DirectionalLight,
  Group,
  HemisphereLight,
  type Camera,
  type Mesh,
  type Scene,
} from 'three';
import { disposeObject } from '../core/dispose';
import { palette } from '../core/theme';
import type { Scope } from '../core/tween';
import type { LetterDef } from '../data/types';
import { Bud } from '../entities/Bud';
import { Buzzy } from '../entities/Buzzy';
import { Clouds, createDecor } from '../entities/Decor';
import { Gazebo } from '../entities/Gazebo';
import { createIsland } from '../entities/Island';
import { createSky } from '../entities/Sky';
import { budPositions, BUZZY_HOME, GAZEBO_POS } from './layout';

/** The persistent garden: everything that stays on screen across states. */
export class World {
  readonly root = new Group();
  readonly sun: DirectionalLight;
  readonly island: Mesh;
  readonly gazebo = new Gazebo();
  readonly clouds = new Clouds();
  readonly buzzy: Buzzy;
  buds: Bud[] = [];
  private budScope: Scope;

  constructor(
    scene: Scene,
    private readonly scope: Scope,
    camera: Camera,
  ) {
    scene.add(this.root);
    this.root.add(createSky());
    this.root.add(new HemisphereLight(0xfffbf0, palette.grass, 1.5));
    this.sun = new DirectionalLight(0xffffff, 1.7);
    this.sun.position.set(14, 26, 12);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -24;
    sc.right = sc.top = 24;
    sc.near = 5;
    sc.far = 70;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    this.root.add(this.sun, this.sun.target);

    this.island = createIsland();
    this.root.add(this.island);
    this.root.add(...createDecor([...budPositions(), GAZEBO_POS]));
    this.gazebo.root.position.copy(GAZEBO_POS);
    this.root.add(this.gazebo.root, this.clouds.mesh);

    this.buzzy = new Buzzy(scope.child(), camera, 1.15);
    this.buzzy.addTo(this.root);
    this.buzzy.teleport(BUZZY_HOME);

    this.budScope = scope.child();
    scope.onFrame((dt) => this.update(dt));
  }

  /** (Re)build the 6 buds for a language. Bloom content is disposed with the old buds. */
  setLetters(letters: LetterDef[]): void {
    this.budScope.kill();
    this.budScope = this.scope.child();
    for (const b of this.buds) disposeObject(b.root);
    const slots = budPositions();
    this.buds = letters.slice(0, slots.length).map((l, i) => {
      const bud = new Bud(l, i, slots[i] ?? slots[0]!, this.budScope);
      this.root.add(bud.root);
      return bud;
    });
  }

  bud(letterId: string): Bud | undefined {
    return this.buds.find((b) => b.letter.id === letterId);
  }

  private update(dt: number): void {
    this.clouds.update(dt);
    for (const b of this.buds) b.update(dt);
  }
}
