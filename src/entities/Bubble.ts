import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { markShared } from '../core/dispose';
import { cssFont } from '../core/fonts';
import type { Lang } from '../data/types';
import { sphereCollider } from './colliders';

const textures = new Map<string, Texture>();

/**
 * Glyph drawn on a canvas in the self-hosted font, white with a thick dark outline
 * (brief §11). Callers must `await loadFont(lang)` first or Tamil falls back (brief §5.2).
 */
export function glyphTexture(lang: Lang, glyph: string): Texture {
  const key = `${lang}:${glyph}`;
  const hit = textures.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const size = lang === 'ta' ? 150 : 190;
    g.font = cssFont(lang, size);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const m = g.measureText(glyph);
    const y = 128 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    g.lineJoin = 'round';
    g.lineWidth = 22;
    g.strokeStyle = '#3b2a20';
    g.strokeText(glyph, 128, y);
    g.fillStyle = '#ffffff';
    g.fillText(glyph, 128, y);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  textures.set(key, markShared(t));
  return t;
}

const shell = markShared(new SphereGeometry(1, 24, 16));
const plane = markShared(new PlaneGeometry(1, 1));
const shellMat = markShared(
  new MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.32, depthWrite: false }),
);
const shineMat = markShared(
  new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
);
const glyphMats = new Map<Texture, MeshBasicMaterial>();

function glyphMaterial(t: Texture): MeshBasicMaterial {
  let m = glyphMats.get(t);
  if (!m) {
    m = markShared(new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    glyphMats.set(t, m);
  }
  return m;
}

/** A floating soap bubble carrying one glyph. All GPU resources are shared caches. */
export class Bubble {
  readonly root = new Group();
  readonly body = new Group();
  readonly collider: Mesh;
  vy = 0.6;
  laneX = 0;
  phase = Math.random() * 6;

  constructor(
    readonly glyph: string,
    readonly isTarget: boolean,
    lang: Lang,
    readonly radius = 0.9,
  ) {
    const s = new Mesh(shell, shellMat);
    s.scale.setScalar(radius);
    s.renderOrder = 3;
    const shine = new Mesh(shell, shineMat);
    shine.scale.set(radius * 0.18, radius * 0.12, radius * 0.05);
    shine.position.set(-radius * 0.45, radius * 0.5, radius * 0.75);
    const g = new Mesh(plane, glyphMaterial(glyphTexture(lang, glyph)));
    g.scale.setScalar(radius * 1.6);
    g.position.z = 0.05;
    g.renderOrder = 4;
    this.body.add(s, g, shine);
    this.root.add(this.body);
    this.root.name = `glyph-bubble-${glyph}`;
    this.collider = sphereCollider(this.root, radius * 1.5);
    this.collider.userData.bubble = this;
  }
}
