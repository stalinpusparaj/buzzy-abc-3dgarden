import { BoxGeometry, DirectionalLight, HemisphereLight, Mesh } from 'three';
import { Loop } from './core/loop';
import { toon } from './core/materials';
import { createRenderContext } from './core/renderer';
import { palette } from './core/theme';
import { createSky } from './entities/Sky';
import './ui/styles.css';

async function boot(): Promise<void> {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app missing');
  const ctx = createRenderContext(host);
  const { scene, camera, renderer } = ctx;

  scene.add(createSky());
  scene.add(new HemisphereLight(0xffffff, palette.grass, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(5, 10, 6);
  scene.add(sun);

  const cube = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), toon(palette.buzzyBody));
  scene.add(cube);
  camera.position.set(0, 2.2, 6);
  camera.lookAt(0, 0, 0);

  const loop = new Loop(renderer, () => renderer.render(scene, camera));
  loop.add((dt) => {
    cube.rotation.x += dt * 0.7;
    cube.rotation.y += dt * 1.1;
  });

  if (__DEV_TOOLS__) {
    const dev = await import('./dev/index');
    if (dev.readDevMode(location.search) === 'perf') dev.attachPerfOverlay(renderer, loop);
  }
  loop.start();
  document.body.dataset.ready = '1';
}

void boot();
