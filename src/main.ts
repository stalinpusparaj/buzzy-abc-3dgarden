import { loadFont } from './core/fonts';
import { squash } from './entities/juice';
import { Game } from './game';
import { decorateSaved } from './scenes/Bloom';
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

  // No Tamil TTS voice on this device: pulse whatever glyph is on screen and chime (brief §6.4).
  g.voice.onNoVoice = () => {
    g.sfx.play('chime');
    g.rc.scene.traverse((o) => {
      if (o.name.startsWith('glyph-') && o.visible) void squash(g.scope, o, 0.25);
    });
  };
  g.hud.onLang = () => void g.setLang(g.lang === 'en' ? 'ta' : 'en');
  // Fonts + SFX in parallel with the first frames; never block on them for long.
  await Promise.race([
    Promise.all([loadFont(g.lang), g.sfx.load()]),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
  decorateSaved(g);
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

void boot();
