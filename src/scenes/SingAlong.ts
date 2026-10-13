import { CatmullRomCurve3, Group, Vector3 } from 'three';
import { motion } from '../core/a11y';
import { disposeObject } from '../core/dispose';
import { assetUrl } from '../core/fonts';
import type { GameState } from '../core/stateMachine';
import { palette } from '../core/theme';
import type { Scope } from '../core/tween';
import audioManifest from '../data/audio.json';
import cuesEn from '../data/cues.en.json';
import cuesTa from '../data/cues.ta.json';
import type { Cue, Lang } from '../data/types';
import type { Bud } from '../entities/Bud';
import { createGlyph } from '../entities/Glyph3D';
import { popIn, squash } from '../entities/juice';
import type { Game } from '../game';
import { budPose, buzzyBesideBud, overviewPose, towardViewer } from './poses';

const CUES: Record<Lang, Cue[]> = { en: cuesEn, ta: cuesTa };
const FLY = 1.0;

/**
 * Sing-along (brief §5.6): the camera glides on a rail past every bud while the song plays.
 * At each cue the bud bounces, flashes and shows its big glyph + object; Buzzy arrives on the
 * beat. Pre-readers get the glyph and the object, never karaoke text.
 * Cue timing uses the audio clock, so it cannot drift from the music.
 */
export class SingAlong implements GameState<void> {
  private scope: Scope | null = null;
  private readonly props = new Group();
  private stopSong: () => void = () => {};

  constructor(private readonly g: Game) {}

  enter(): void {
    const g = this.g;
    const s = (this.scope = g.scope.child());
    g.hud.setMode('activity');
    g.music.stop();
    g.cueLog.length = 0;
    void this.run(s);
  }

  private async run(s: Scope): Promise<void> {
    const g = this.g;
    const song = g.audio.load(assetUrl(audioManifest.song[g.lang]));
    void g.rig.moveTo(overviewPose(g.aspect), 1.0);
    await g.voice.say('sing_intro');
    const buf = await song;
    if (!s.alive) return;
    const cues = CUES[g.lang]
      .map((c) => ({ ...c, bud: g.world.bud(c.id) }))
      .filter((c): c is Cue & { bud: Bud } => !!c.bud);
    g.songDuration = buf?.duration ?? 0;
    const duration = buf?.duration ?? (cues.at(-1)?.t ?? 0) + 4;
    const v = buf ? g.audio.play(buf, 'vo') : null;
    // Song time comes from the AudioContext clock when we have it.
    const t0 = v ? v.startedAt : g.audio.now();
    const clock = (): number => g.audio.now() - t0;
    this.stopSong = () => v?.stop();
    g.world.root.add(this.props);
    const rail = this.rail(cues, duration);
    let next = 0;
    let flewTo = -1;
    s.onFrame(() => {
      const t = clock();
      const cam = rail(t);
      g.rig.follow(cam);
      // Leave early so Buzzy lands on the beat.
      const upcoming = cues[flewTo + 1];
      if (upcoming && t >= upcoming.t - FLY) {
        flewTo++;
        void g.world.buzzy.flyTo(buzzyBesideBud(upcoming.bud), Math.max(0.3, upcoming.t - t));
      }
      while (next < cues.length && t >= (cues[next]?.t ?? Infinity)) {
        const c = cues[next++];
        if (c) this.fire(s, c, t);
      }
      if (t > duration + 0.3) g.machine.go('garden', undefined);
    });
  }

  /** Camera keyframes at each cue time, Catmull-Rom between them, timed by the song. */
  private rail(
    cues: (Cue & { bud: Bud })[],
    duration: number,
  ): (t: number) => { pos: Vector3; look: Vector3 } {
    const g = this.g;
    const start = overviewPose(g.aspect);
    const keys = [{ t: 0, ...start }];
    for (const c of cues) {
      const p = budPose(c.bud);
      const k = motion.reduced ? 0.5 : 1; // halve camera moves for reduced motion
      const dir = towardViewer(c.bud.headWorld());
      p.pos.addScaledVector(dir, 8).add(new Vector3(0, 5, 0));
      keys.push({
        t: c.t,
        pos: start.pos.clone().lerp(p.pos, k),
        look: start.look.clone().lerp(p.look, k),
      });
    }
    keys.push({ t: Math.max(duration, (cues.at(-1)?.t ?? 0) + 1), ...start });
    const pos = new CatmullRomCurve3(keys.map((k) => k.pos));
    const look = new CatmullRomCurve3(keys.map((k) => k.look));
    return (t: number) => {
      let i = 0;
      while (i < keys.length - 2 && t > (keys[i + 1]?.t ?? 0)) i++;
      const a = keys[i]?.t ?? 0;
      const b = keys[i + 1]?.t ?? a + 1;
      const local = Math.min(1, Math.max(0, (t - a) / Math.max(b - a, 1e-3)));
      const eased = local * local * (3 - 2 * local);
      const u = (i + eased) / (keys.length - 1);
      return { pos: pos.getPoint(u), look: look.getPoint(u) };
    };
  }

  private fire(s: Scope, c: Cue & { bud: Bud }, actual: number): void {
    const g = this.g;
    g.cueLog.push({ id: c.id, expected: c.t, actual });
    const bud = c.bud;
    void bud.bounce();
    const open = bud.open;
    void bud.openTo(1, 0.35).then(() => (bud.bloomed ? undefined : bud.openTo(open, 1.4)));
    g.world.particles.burst(bud.headWorld(), 26, palette.petals, 4);
    g.sfx.play('chime');
    const head = bud.headWorld();
    const dir = towardViewer(head);
    const color = palette.petals[bud.index % palette.petals.length] ?? palette.petals[0];
    const glyph = createGlyph(g.lang, bud.letter.glyph, color, 2.6);
    glyph.position.copy(head).add(new Vector3(0, 3.0, 0));
    glyph.rotation.y = Math.atan2(dir.x, dir.z);
    const object = g.models.create(bud.letter.objectModel, 1.4);
    object.position
      .copy(head)
      .add(new Vector3(0, 0.6, 0))
      .addScaledVector(new Vector3(dir.z, 0, -dir.x), 2.2);
    object.rotation.y = glyph.rotation.y;
    this.props.add(glyph, object);
    void popIn(s, glyph, 1, 0.45);
    void popIn(s, object, 1, 0.45, 0.1);
    void squash(s, glyph, 0.2);
  }

  exit(): void {
    this.scope?.kill();
    this.scope = null;
    this.stopSong();
    this.stopSong = () => {};
    disposeObject(this.props);
    this.props.clear();
    this.g.voice.stop();
    void this.g.music.start(this.g.lang);
  }
}
