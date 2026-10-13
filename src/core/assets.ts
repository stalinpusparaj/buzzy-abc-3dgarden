import { Box3, Group, Mesh, Vector3, type BufferGeometry, type Object3D } from 'three';
import modelsManifest from '../data/models.json';
import { PLACEHOLDERS } from '../entities/props/placeholders';
import { disposeObject, markShared } from './dispose';
import { assetUrl } from './fonts';
import { mergeColored } from './geometry';
import { toon } from './materials';

/** Written by scripts/optimize-assets.ts: which real GLBs exist (Phase 6). */
const MANIFEST = modelsManifest as Record<string, { file: string; bytes: number }>;

interface Loaded {
  scene: Object3D;
  refs: number;
}

/**
 * Model cache (brief §7.3). Real GLBs (when listed in models.json) load per letter pack with
 * GLTFLoader + MeshoptDecoder, are reference-counted and disposed when unused. Anything
 * without a GLB uses a placeholder primitive, so the game always has something to show.
 */
export class Models {
  private readonly placeholderGeo = new Map<string, BufferGeometry>();
  private readonly glb = new Map<string, Loaded>();
  private readonly pending = new Map<string, Promise<void>>();

  has(id: string): boolean {
    return id in MANIFEST;
  }

  /** Load (or add a reference to) the GLBs for these ids. Never rejects. */
  async prepare(ids: string[]): Promise<void> {
    await Promise.all(
      [...new Set(ids)].map(async (id) => {
        const hit = this.glb.get(id);
        if (hit) {
          hit.refs++;
          return;
        }
        const entry = MANIFEST[id];
        if (!entry) return;
        let p = this.pending.get(id);
        if (!p) {
          p = this.loadGlb(id, entry.file);
          this.pending.set(id, p);
        }
        await p;
        const loaded = this.glb.get(id);
        if (loaded) loaded.refs++;
      }),
    );
  }

  /** Drop references; GLBs with no references left are disposed. */
  release(ids: string[]): void {
    for (const id of new Set(ids)) {
      const e = this.glb.get(id);
      if (!e) continue;
      e.refs--;
      if (e.refs <= 0) {
        disposeObject(e.scene, true);
        this.glb.delete(id);
        this.pending.delete(id);
      }
    }
  }

  /** A new instance, ~`height` units tall, base at y = 0, facing +z. Shares GPU data. */
  create(id: string, height = 1): Object3D {
    const root = new Group();
    root.name = `model-${id}`;
    const loaded = this.glb.get(id);
    if (loaded) {
      const clone = loaded.scene.clone(true);
      clone.scale.multiplyScalar(height);
      root.add(clone);
      return root;
    }
    const mesh = new Mesh(this.placeholder(id), toon('vertex'));
    mesh.scale.setScalar(height);
    mesh.castShadow = true;
    root.add(mesh);
    return root;
  }

  private placeholder(id: string): BufferGeometry {
    let g = this.placeholderGeo.get(id);
    if (!g) {
      const parts = PLACEHOLDERS[id]?.() ?? PLACEHOLDERS.egg?.() ?? [];
      g = markShared(mergeColored(parts));
      this.placeholderGeo.set(id, g);
    }
    return g;
  }

  private async loadGlb(id: string, file: string): Promise<void> {
    try {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ]);
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(assetUrl(file));
      const scene = gltf.scene;
      // Normalise: 1 unit tall, base on y = 0, centred on x/z.
      const box = new Box3().setFromObject(scene);
      const size = box.getSize(new Vector3());
      const k = size.y > 0 ? 1 / size.y : 1;
      scene.scale.setScalar(k);
      scene.position.set(
        -((box.min.x + box.max.x) / 2) * k,
        -box.min.y * k,
        -((box.min.z + box.max.z) / 2) * k,
      );
      const wrap = new Group();
      wrap.add(scene);
      wrap.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        // Clones share these; only release() (force) may free them.
        markShared(m.geometry);
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          markShared(mat);
          for (const v of Object.values(mat)) {
            if (v && typeof v === 'object' && 'isTexture' in v)
              markShared(v as { userData: Record<string, unknown> });
          }
        }
      });
      this.glb.set(id, { scene: wrap, refs: 0 });
    } catch {
      // Fall back to the placeholder; a broken asset must never break a lesson.
    }
  }
}
