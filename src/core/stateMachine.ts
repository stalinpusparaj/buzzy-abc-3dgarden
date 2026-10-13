import type { GamePointerEvent } from './input';

export interface GameState<P> {
  enter(params: P): void | Promise<void>;
  exit(): void;
  update?(dt: number): void;
  onPointer?(e: GamePointerEvent): void;
}

type StateMap = Record<string, unknown>;

/**
 * Brief §5.1 state machine. `go()` exits the current state synchronously, then enters the
 * next; states own their resources and must free them in `exit()`.
 */
export class StateMachine<M extends StateMap> {
  private readonly states = new Map<keyof M, GameState<never>>();
  private cur: { name: keyof M; state: GameState<never> } | null = null;
  private readonly listeners = new Set<(name: keyof M) => void>();

  register<K extends keyof M>(name: K, state: GameState<M[K]>): void {
    this.states.set(name, state as GameState<never>);
  }

  get current(): keyof M | null {
    return this.cur?.name ?? null;
  }

  go<K extends keyof M>(name: K, params: M[K]): void {
    const next = this.states.get(name) as GameState<M[K]> | undefined;
    if (!next) throw new Error(`unknown state ${String(name)}`);
    this.cur?.state.exit();
    this.cur = { name, state: next as GameState<never> };
    this.listeners.forEach((l) => l(name));
    void next.enter(params);
  }

  onChange(l: (name: keyof M) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  update(dt: number): void {
    this.cur?.state.update?.(dt);
  }

  pointer(e: GamePointerEvent): void {
    this.cur?.state.onPointer?.(e);
  }
}
