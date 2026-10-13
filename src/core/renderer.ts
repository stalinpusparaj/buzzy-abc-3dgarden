import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';

export interface RenderContext {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** Cap device pixel ratio (quality tiers call this). */
  setMaxDpr(maxDpr: number): void;
  /** CSS-pixel size of the canvas. */
  size(): { width: number; height: number };
}

/** WebGL2 only (brief §7.1: no WebGPU for MVP). Throws if WebGL2 is unavailable. */
export function createRenderContext(host: HTMLElement, antialias = true): RenderContext {
  const renderer = new WebGLRenderer({ antialias, powerPreference: 'high-performance' });
  renderer.domElement.id = 'game-canvas';
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 600);
  let maxDpr = 2;

  const resize = (): void => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, true);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    setMaxDpr(dpr) {
      maxDpr = dpr;
      resize();
    },
    size: () => ({
      width: host.clientWidth || window.innerWidth,
      height: host.clientHeight || window.innerHeight,
    }),
  };
}
