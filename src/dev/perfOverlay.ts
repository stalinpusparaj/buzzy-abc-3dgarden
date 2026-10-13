import type { WebGLRenderer } from 'three';
import type { Loop } from '../core/loop';

interface ChromeMemory {
  usedJSHeapSize: number;
}

/** Dev-only HUD: fps, frame time, draw calls, triangles, GPU objects, JS heap (brief Phase 0). */
export function attachPerfOverlay(renderer: WebGLRenderer, loop: Loop): () => void {
  const el = document.createElement('pre');
  el.id = 'perf-overlay';
  el.style.cssText =
    'position:fixed;left:4px;bottom:4px;margin:0;padding:6px 8px;font:11px/1.35 monospace;' +
    'color:#0f0;background:rgba(0,0,0,.7);z-index:9999;pointer-events:none;border-radius:4px';
  document.body.appendChild(el);

  let frames = 0;
  let acc = 0;
  let worst = 0;
  const remove = loop.add(() => {
    frames++;
    acc += loop.frameMs;
    worst = Math.max(worst, loop.frameMs);
    if (acc < 500) return;
    const info = renderer.info;
    const mem = (performance as Performance & { memory?: ChromeMemory }).memory;
    el.textContent = [
      `fps   ${((frames * 1000) / acc).toFixed(0)}  (avg ${(acc / frames).toFixed(1)} ms, worst ${worst.toFixed(0)})`,
      `calls ${info.render.calls}  tris ${info.render.triangles}`,
      `geo   ${info.memory.geometries}  tex ${info.memory.textures}  prog ${info.programs?.length ?? 0}`,
      `dpr   ${renderer.getPixelRatio()}` +
        (mem ? `  heap ${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB` : ''),
    ].join('\n');
    frames = 0;
    acc = 0;
    worst = 0;
  });
  return () => {
    remove();
    el.remove();
  };
}
