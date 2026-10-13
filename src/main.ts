import { loadFont } from './core/fonts';
import { Game } from './game';
import { decorateBloom } from './scenes/Bloom';
import { GardenScene } from './scenes/GardenScene';
import { LetterFlow } from './scenes/LetterFlow';
import { overviewPose } from './scenes/poses';
import { SingAlong } from './scenes/SingAlong';
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
  g.machine.register('sing', new SingAlong(g));
  installTestHooks(g);

  g.voice.onNoVoice = () => g.sfx.play('chime');
  // Fonts + SFX in parallel with the first frames; never block on them for long.
  await Promise.race([
    Promise.all([loadFont(g.lang), g.sfx.load()]),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
  decorateBloomed(g);
  loading.progress(0.8);
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
  g.voice.unlock();
  loading.hide();
  g.machine.go('garden', undefined);
  void g.music.start(g.lang);
  void g.voice.say('welcome').then(() => g.voice.say('pick_flower'));
}

/** Re-create saved blooms (they persist in the garden, brief §5.1). */
function decorateBloomed(g: Game): void {
  const bloomed = g.storage.get().bloomed;
  for (const b of g.world.buds) if (bloomed.includes(b.letter.id)) decorateBloom(g, b);
}

void boot();
