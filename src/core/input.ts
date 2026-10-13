import type { Plane } from 'three';
import { Raycaster, Vector2, Vector3, type Camera, type Intersection, type Object3D } from 'three';

export interface GamePointerEvent {
  type: 'down' | 'move' | 'up' | 'cancel';
  ndc: Vector2;
  clientX: number;
  clientY: number;
  /** ms timestamp, for tap-latency checks */
  time: number;
}

/**
 * Pointer Events only (brief P2): mouse, touch and pen share one path. Only the primary
 * pointer counts, so multi-touch is ignored. Picking raycasts against invisible colliders.
 */
export class Input {
  enabled = true;
  private readonly raycaster = new Raycaster();
  private listener: ((e: GamePointerEvent) => void) | null = null;
  private down = false;

  constructor(
    el: HTMLElement,
    private readonly camera: Camera,
  ) {
    const handle = (type: GamePointerEvent['type']) => (ev: PointerEvent) => {
      if (!ev.isPrimary) return;
      if (type === 'down') {
        this.down = true;
        el.setPointerCapture?.(ev.pointerId);
      } else if (type === 'up' || type === 'cancel') {
        this.down = false;
      } else if (!this.down && ev.pointerType !== 'mouse') {
        return;
      }
      ev.preventDefault();
      if (!this.enabled || !this.listener) return;
      const r = el.getBoundingClientRect();
      this.listener({
        type,
        ndc: new Vector2(
          ((ev.clientX - r.left) / r.width) * 2 - 1,
          -((ev.clientY - r.top) / r.height) * 2 + 1,
        ),
        clientX: ev.clientX,
        clientY: ev.clientY,
        time: performance.now(),
      });
    };
    el.addEventListener('pointerdown', handle('down'));
    el.addEventListener('pointermove', handle('move'));
    el.addEventListener('pointerup', handle('up'));
    el.addEventListener('pointercancel', handle('cancel'));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get isDown(): boolean {
    return this.down;
  }

  setListener(fn: ((e: GamePointerEvent) => void) | null): void {
    this.listener = fn;
  }

  /** Nearest collider hit, preferring the collider whose owner centre is closest to the ray. */
  pick(e: GamePointerEvent, colliders: Object3D[]): Intersection | null {
    this.raycaster.setFromCamera(e.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(colliders, false);
    if (hits.length <= 1) return hits[0] ?? null;
    // Colliders are generous (1.5x) and may overlap: choose the one aimed at most directly.
    const ray = this.raycaster.ray;
    let best = hits[0] ?? null;
    let bestD = Infinity;
    const c = new Vector3();
    for (const h of hits) {
      h.object.getWorldPosition(c);
      const d = ray.distanceSqToPoint(c) / Math.max(h.object.scale.x * h.object.scale.x, 1e-6);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  /** Where the pointer ray meets a plane (drag targets, trace plot). */
  planePoint(e: GamePointerEvent, plane: Plane, target: Vector3): Vector3 | null {
    this.raycaster.setFromCamera(e.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(plane, target);
  }
}
