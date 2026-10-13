import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { markShared } from '../core/dispose';

let material: MeshBasicMaterial | null = null;
const geometry = markShared(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2));

function blobMaterial(): MeshBasicMaterial {
  if (material) return material;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(40,30,50,0.55)');
    grad.addColorStop(1, 'rgba(40,30,50,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = markShared(new CanvasTexture(c));
  material = markShared(new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  return material;
}

/** Soft blob decal under characters (brief §4: cheap stand-in for real shadows). */
export function createBlobShadow(size: number): Mesh {
  const m = new Mesh(geometry, blobMaterial());
  m.scale.setScalar(size);
  m.renderOrder = 1;
  m.name = 'blob-shadow';
  return m;
}
