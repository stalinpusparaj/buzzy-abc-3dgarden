import type { Material, Object3D, Texture } from 'three';

/** Resources flagged `userData.shared = true` are owned by a cache and never disposed here. */
const isShared = (r: { userData: Record<string, unknown> }): boolean => r.userData.shared === true;

export function markShared<T extends { userData: Record<string, unknown> }>(r: T): T {
  r.userData.shared = true;
  return r;
}

function disposeMaterial(m: Material): void {
  if (isShared(m)) return;
  for (const value of Object.values(m)) {
    const tex = value as Texture | null;
    if (tex && typeof tex === 'object' && 'isTexture' in tex && tex.isTexture && !isShared(tex)) {
      tex.dispose();
    }
  }
  m.dispose();
}

/** Remove `root` from its parent and free every GPU resource it owns (brief §5.5: no leaks). */
export function disposeObject(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Object3D & {
      geometry?: { dispose(): void; userData: Record<string, unknown> };
      material?: Material | Material[];
    };
    if (mesh.geometry && !isShared(mesh.geometry)) mesh.geometry.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach(disposeMaterial);
    }
  });
  root.removeFromParent();
}
