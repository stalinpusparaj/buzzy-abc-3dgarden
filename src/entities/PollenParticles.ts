import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  PointsMaterial,
  type Vector3,
} from 'three';
import { motion } from '../core/a11y';
import { palette } from '../core/theme';

const MAX = 200; // brief §4: ≤ 200 particles

function dotTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
  }
  return new CanvasTexture(c);
}

/** Pollen/confetti bursts: one Points draw call, fixed pool, recycled oldest-first. */
export class PollenParticles {
  readonly points: Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly col = new Float32Array(MAX * 3);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly life = new Float32Array(MAX);
  private next = 0;
  private alive = 0;
  cap: number = MAX;

  constructor() {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('color', new BufferAttribute(this.col, 3));
    const m = new PointsMaterial({
      size: 0.45,
      map: dotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new Points(g, m);
    this.points.frustumCulled = false;
    this.points.name = 'pollen';
    this.points.renderOrder = 5;
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;
  }

  /** Burst `count` particles from `at` (scaled down for reduced motion and low tier). */
  burst(at: Vector3, count = 40, colors: readonly number[] = palette.petals, speed = 4): void {
    const n = Math.round(count * motion.particleScale);
    const c = new Color();
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.cap;
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      const s = speed * (0.5 + Math.random() * 0.6);
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([Math.cos(a) * s * 0.6, up * s, Math.sin(a) * s * 0.6], i * 3);
      c.setHex(colors[k % colors.length] ?? 0xffffff);
      this.col.set([c.r, c.g, c.b], i * 3);
      this.life[i] = 0.9 + Math.random() * 0.6;
    }
    this.alive = Math.max(this.alive, n);
  }

  update(dt: number): void {
    if (this.alive === 0) return;
    let any = 0;
    for (let i = 0; i < MAX; i++) {
      const l = this.life[i] ?? 0;
      if (l <= 0) continue;
      const nl = l - dt;
      this.life[i] = nl;
      const o = i * 3;
      if (nl <= 0) {
        this.pos[o + 1] = -999;
        continue;
      }
      any++;
      this.vel[o + 1] = (this.vel[o + 1] ?? 0) - 6 * dt;
      for (let a = 0; a < 3; a++) {
        this.vel[o + a] = (this.vel[o + a] ?? 0) * (1 - dt * 1.2);
        this.pos[o + a] = (this.pos[o + a] ?? 0) + (this.vel[o + a] ?? 0) * dt;
      }
      const fade = Math.min(1, nl * 2);
      for (let a = 0; a < 3; a++) this.col[o + a] = (this.col[o + a] ?? 0) * (fade < 1 ? 0.97 : 1);
    }
    this.alive = any;
    const g = this.points.geometry;
    (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('color') as BufferAttribute).needsUpdate = true;
  }
}
