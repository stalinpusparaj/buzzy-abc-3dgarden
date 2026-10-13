import { Game } from './game';
import { GardenScene } from './scenes/GardenScene';
import { LetterFlow } from './scenes/LetterFlow';
import { overviewPose } from './scenes/poses';
import { installTestHooks } from './testHooks';
import { LoadingScreen } from './ui/loading';
import { mountRotatePrompt } from './ui/rotatePrompt';
import './ui/styles.css';

async function boot(): Promise<void> {
  const host = document.getElementById('app');
  const ui = document.getElementById('ui');
  if (!host || !ui) throw new Error('#app / #ui missing');

  if (__DEV_TOOLS__) {
    const dev = await import('./dev/index');
    const mode = dev.readDevMode(location.search);
    if (mode === 'strokes' || mode === 'cues') return dev.startTool(mode, ui);
  }

  mountRotatePrompt(ui);
  const loading = new LoadingScreen(ui, null);
  loading.progress(0.2);

  const g = new Game(host, ui);
  const garden = new GardenScene(g);
  g.machine.register('start', { enter: () => g.hud.setMode('hidden'), exit: () => {} });
  g.machine.register('garden', garden);
  g.machine.register('letter', new LetterFlow(g));
  g.machine.register('sing', {
    enter: () => void g.world.buzzy.celebrate().then(() => g.machine.go('garden', undefined)),
    exit: () => {},
  });
  installTestHooks(g, { targets: () => [] });

  g.machine.go('start', undefined);
  g.rig.set(overviewPose(g.aspect));
  g.loop.start();
  if (__DEV_TOOLS__) {
    const dev = await import('./dev/index');
    if (dev.readDevMode(location.search) === 'perf') dev.attachPerfOverlay(g.rc.renderer, g.loop);
  }
  loading.progress(1);
  document.body.dataset.ready = '1';

  await loading.waitForStart();
  g.audio.unlock();
  loading.hide();
  g.machine.go('garden', undefined);
}

void boot();
