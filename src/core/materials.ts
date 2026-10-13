import {
  Color,
  DataTexture,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
} from 'three';
import { markShared } from './dispose';

let gradient: DataTexture | null = null;

/** 3-step toon ramp shared by every toon material (brief §4). */
export function toonGradient(): DataTexture {
  if (gradient) return gradient;
  const t = new DataTexture(new Uint8Array([110, 190, 255]), 3, 1, RedFormat);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  gradient = markShared(t);
  return gradient;
}

const toonCache = new Map<string, MeshToonMaterial>();

/** Shared toon material. Pass `'vertex'` for merged meshes that carry per-vertex colours. */
export function toon(color: number | 'vertex', emissive = 0x000000): MeshToonMaterial {
  const key = `${color}:${emissive}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new MeshToonMaterial({ gradientMap: toonGradient() });
    if (color === 'vertex') m.vertexColors = true;
    else m.color = new Color(color);
    m.emissive = new Color(emissive);
    toonCache.set(key, markShared(m));
  }
  return m;
}

/** A fresh (unshared) toon material for objects that animate their own colour or opacity. */
export function ownToon(color: number): MeshToonMaterial {
  return new MeshToonMaterial({ color, gradientMap: toonGradient() });
}

const basicCache = new Map<string, MeshBasicMaterial>();

export function basic(color: number, opacity = 1): MeshBasicMaterial {
  const key = `${color}:${opacity}`;
  let m = basicCache.get(key);
  if (!m) {
    m = new MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    basicCache.set(key, markShared(m));
  }
  return m;
}
