import { Box3, Vector3 } from 'three';
import type { Game } from './game';

/** Screen position (CSS px) of a world point. */
export function toScreen(g: Game, p: Vector3): { x: number; y: number } {
  const v = p.clone().project(g.rc.camera);
  const s = g.rc.size();
  return { x: ((v.x + 1) / 2) * s.width, y: ((1 - v.y) / 2) * s.height };
}

export interface TestApi {
  state(): string | null;
  info(): {
    geometries: number;
    textures: number;
    calls: number;
    triangles: number;
    programs: number;
  };
  budScreen(id: string): { x: number; y: number } | null;
  gazeboScreen(): { x: number; y: number };
  /** Screen points the current mini-game wants tapped/dragged (set by mini-games). */
  targets(): { x: number; y: number }[];
  fps(): number;
  tier(): string;
  bloomed(): string[];
  hints(): number;
  wrongTargets(): { x: number; y: number }[];
  cueLog(): { id: string; expected: number; actual: number }[];
  audioState(): string;
  songDuration(): number;
  /** On-screen size (CSS px) of each bud's visual bounds and its hit collider. */
  tapTargets(): { id: string; visualW: number; visualH: number; collider: number }[];
}

function screenBox(g: Game, box: Box3): { w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = toScreen(
      g,
      new Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ),
    );
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  return { w: x1 - x0, h: y1 - y0 };
}

/** E2E hooks: only installed with `?e2e=1`. Read-only views of game state, no shortcuts. */
export function installTestHooks(g: Game): void {
  if (!new URLSearchParams(location.search).has('e2e')) return;
  const frames: number[] = [];
  g.loop.add(() => {
    frames.push(g.loop.frameMs);
    if (frames.length > 120) frames.shift();
  });
  const api: TestApi = {
    state: () => (g.machine.current as string | null) ?? null,
    info: () => {
      const i = g.rc.renderer.info;
      return {
        geometries: i.memory.geometries,
        textures: i.memory.textures,
        calls: i.render.calls,
        triangles: i.render.triangles,
        programs: i.programs?.length ?? 0,
      };
    },
    budScreen: (id) => {
      const b = g.world.bud(id);
      return b ? toScreen(g, b.collider.getWorldPosition(new Vector3())) : null;
    },
    gazeboScreen: () => toScreen(g, g.world.gazebo.collider.getWorldPosition(new Vector3())),
    targets: () => g.targets().map((p) => toScreen(g, p)),
    hints: () => g.hintCount,
    wrongTargets: () => g.wrongTargets().map((p) => toScreen(g, p)),
    cueLog: () => [...g.cueLog],
    audioState: () => g.audio.ctx?.state ?? 'none',
    songDuration: () => g.songDuration,
    fps: () => (frames.length ? 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length) : 0),
    tier: () => g.quality.tier,
    bloomed: () => [...g.storage.get().bloomed],
    tapTargets: () =>
      g.world.buds.map((b) => {
        const v = screenBox(g, new Box3().setFromObject(b.body, true));
        const c = b.collider.getWorldPosition(new Vector3());
        const r = b.collider.getWorldScale(new Vector3()).x;
        const right = new Vector3()
          .setFromMatrixColumn(g.rc.camera.matrixWorld, 0)
          .multiplyScalar(r);
        const a = toScreen(g, c.clone().add(right));
        const z = toScreen(g, c.clone().sub(right));
        return {
          id: b.letter.id,
          visualW: v.w,
          visualH: v.h,
          collider: Math.hypot(a.x - z.x, a.y - z.y),
        };
      }),
  };
  (window as Window & { __buzzy?: TestApi }).__buzzy = api;
  // Lets the audio e2e test mimic a Safari system suspension.
  Object.defineProperty(window, '__buzzyAudioCtx', { get: () => g.audio.ctx });
}
