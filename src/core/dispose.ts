import type { Material, Object3D, Texture } from 'three';

/** Resources flagged `userData.shared = true` are owned by a cache and never disposed here. */
const isShared = (r: { userData: Record<string, unknown> }): boolean => r.userData.shared === true;

export function markShared<T extends { userData: Record<string, unknown> }>(r: T): T {
  r.userData.shared = true;
  return r;
}

function disposeMaterial(m: Material, force: boolean): void {
  if (isShared(m) && !force) return;
  for (const value of Object.values(m)) {
    const tex = value as Texture | null;
    if (
      tex &&
      typeof tex === 'object' &&
      'isTexture' in tex &&
      tex.isTexture &&
      (force || !isShared(tex))
    ) {
      tex.dispose();
    }
  }
  m.dispose();
}

/**
 * Remove `root` from its parent and free every GPU resource it owns (brief §5.5: no leaks).
 * `force` also frees shared resources: only a cache that owns them may pass it.
 */
export function disposeObject(root: Object3D, force = false): void {
  root.traverse((o) => {
    const mesh = o as Object3D & {
      geometry?: { dispose(): void; userData: Record<string, unknown> };
      material?: Material | Material[];
    };
    if (mesh.geometry && (force || !isShared(mesh.geometry))) mesh.geometry.dispose();
    // InstancedMesh owns per-instance buffers too.
    if ((o as Object3D & { isInstancedMesh?: boolean }).isInstancedMesh)
      (o as Object3D & { dispose(): void }).dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => disposeMaterial(m, force));
    }
  });
  root.removeFromParent();
}
