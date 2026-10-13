import type { DirectionalLight, Object3D, WebGLRenderer } from 'three';
import type { RenderContext } from './renderer';

export type Tier = 'low' | 'mid' | 'high';
export const TIER_ORDER: Tier[] = ['low', 'mid', 'high'];

/** Brief §7.3 quality tiers. */
export const TIERS: Record<Tier, { dpr: number; shadowMap: number; particles: number }> = {
  low: { dpr: 1, shadowMap: 0, particles: 100 },
  mid: { dpr: 1.5, shadowMap: 1024, particles: 200 },
  high: { dpr: 2, shadowMap: 2048, particles: 200 },
};

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  userAgent: string;
}

/** First guess before the GPU exists (decides antialias). `?quality=` overrides. */
export function guessTier(nav: NavigatorHints, search: string): Tier {
  const forced = new URLSearchParams(search).get('quality');
  if (forced === 'low' || forced === 'mid' || forced === 'high') return forced;
  const mem = nav.deviceMemory;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  if (mem !== undefined && mem <= 2) return 'low';
  if (mobile && (nav.hardwareConcurrency ?? 8) <= 4) return 'low';
  if (mem !== undefined && mem <= 4) return 'mid';
  return mobile ? 'mid' : 'high';
}

export function isForced(search: string): boolean {
  return new URLSearchParams(search).has('quality');
}

/** Refine with GPU caps. */
export function refineTier(t: Tier, renderer: WebGLRenderer): Tier {
  const caps = renderer.capabilities;
  if (caps.maxTextureSize < 4096 || caps.maxVertexUniforms < 256) return 'low';
  return t;
}

export function lowerTier(t: Tier): Tier {
  return TIER_ORDER[Math.max(0, TIER_ORDER.indexOf(t) - 1)] ?? 'low';
}

/**
 * Applies a tier and watches frame time: if the average stays above 40 ms for 3 s, drop one
 * tier (brief §7.3). Never raises the tier again during a session.
 */
export class Quality {
  tier: Tier;
  private slowFor = 0;
  private avg = 16.7;
  private readonly listeners = new Set<(t: Tier) => void>();

  constructor(
    initial: Tier,
    private readonly rc: RenderContext,
    private readonly sun: DirectionalLight,
    private readonly scene: Object3D,
    private readonly autoDrop = true,
  ) {
    this.tier = initial;
    this.apply();
  }

  get particles(): number {
    return TIERS[this.tier].particles;
  }

  onChange(l: (t: Tier) => void): void {
    this.listeners.add(l);
  }

  set(t: Tier): void {
    if (t === this.tier) return;
    this.tier = t;
    this.apply();
    this.listeners.forEach((l) => l(t));
  }

  /** Feed real frame times (ms). */
  sample(frameMs: number, dt: number): void {
    if (!this.autoDrop || this.tier === 'low') return;
    this.avg += (frameMs - this.avg) * 0.1;
    this.slowFor = this.avg > 40 ? this.slowFor + dt : 0;
    if (this.slowFor >= 3) {
      this.slowFor = 0;
      this.avg = 16.7;
      this.set(lowerTier(this.tier));
    }
  }

  private apply(): void {
    const cfg = TIERS[this.tier];
    const { renderer } = this.rc;
    this.rc.setMaxDpr(cfg.dpr);
    const shadows = cfg.shadowMap > 0;
    const changed = renderer.shadowMap.enabled !== shadows;
    renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    if (shadows) {
      this.sun.shadow.mapSize.set(cfg.shadowMap, cfg.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (changed) {
      this.scene.traverse((o) => {
        const m = (
          o as Object3D & { material?: { needsUpdate: boolean } | { needsUpdate: boolean }[] }
        ).material;
        if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
        else if (m) m.needsUpdate = true;
      });
    }
  }
}
