# Buzzy ABC Garden: build brief for Claude Code

> **How to use:** create an empty repo `buzzy-abc-garden`, save this file as `docs/BUILD_PROMPT.md`, open Claude Code in the repo and say:
> *"Read docs/BUILD_PROMPT.md fully. Do Phase 0 only, then stop and report."*
> Then say *"go"* for each following phase.

---

## 0. Rules for you, the agent

1. Work **one phase at a time** (section 12). After each phase, run its acceptance checks, write a 10-line report (what works, what's stubbed, what's risky), then **stop and wait for "go"**.
2. Before writing any code in Phase 0, give me your plan in no more than 15 bullets plus a list of assumptions.
3. Ask me only when you are blocked. Otherwise pick the simpler option and log it in `DECISIONS.md` (date, decision, why, alternative rejected).
4. **Every new dependency** needs its gzip size and a one-line reason in `DECISIONS.md`. Prefer zero-dependency solutions.
5. Do not create content (letters, words, songs) that isn't in this brief's data tables. Leave `TODO(content)` instead.
6. TypeScript `strict: true`. No `any` without a comment. Small files of 300 lines or fewer, one responsibility each.
7. Never load anything from a third-party domain at runtime: no CDNs, Google Fonts, analytics, ads or embeds. Everything is self-hosted (see section 10).

---

## 1. Product in one paragraph

**Buzzy ABC Garden** is a browser-based 3D learning game for children **aged 3–6**, in **English and Tamil**. Buzzy, a friendly bee from my existing mobile game *Buzzy Spelling Garden*, flies around a magical garden. Each flower bud holds one letter. A child taps a bud and then **hears** the letter (a sung line plus the word), **plays** a 60–90 second mini-game, and **watches** the flower bloom into the letter's object. The bloom permanently decorates the garden. A sing-along stage plays the full alphabet song while every bud reacts in time with the music. It runs on my own website, works on cheap Android phones and iPads, works offline after the first visit, and collects **zero personal data** from children.

**What it's for (keep in mind when trading off):** (a) a showcase of my studio's gamified interactive work, (b) a white-label product I can license to play schools and pediatric clinics in Tamil Nadu, (c) a funnel to the Buzzy mobile app. It is **not** an ad-revenue product.

---

## 2. Design principles (non-negotiable)

| # | Principle | What it means in code |
|---|---|---|
| P1 | **Pre-readers first** | No instruction is ever text-only. Every instruction is a voice line plus an animated visual hint. Buttons are icons only. |
| P2 | **Tap and drag only** | No double-tap, pinch, long-press (except the parent gate) or multi-touch. Pointer Events API, so mouse and touch share one code path. |
| P3 | **Huge targets** | Every tappable thing is **≥ 64 CSS px** on screen, with an invisible hit collider about 1.5× its visual size. |
| P4 | **No failure** | No lives, timers, game-over or red X. A wrong answer gives a soft wobble and a "boop", and after 2 misses or 6 s idle the correct answer pulses. |
| P5 | **Short loops** | One letter takes about 2–3 minutes. Intros are skippable after the first view. |
| P6 | **Guided camera** | No free orbit or zoom. The camera moves only on rails or tweens, so kids never get lost. |
| P7 | **Gentle stop** | After 6 completed letters **or** 15 minutes, Buzzy yawns and the voice says "Buzzy is sleepy, let's play more tomorrow!" The child can keep playing, but nothing autoplays the next letter. |
| P8 | **No dark patterns** | No streaks, guilt ("Buzzy is sad you left"), loot boxes, ads or purchase prompts in the child area. |
| P9 | **Low-end first** | The target device is a 2–3 GB RAM Android phone on Chrome over 4G. If it's slow there, it's broken. |

---

## 3. MVP scope (the vertical slice)

**In:**

- 1 garden hub, 6 letter buds per language, Buzzy character, sing-along stage
- 3 reusable mini-game templates (section 5); **letters are data, not code**
- English A–F and Tamil அ ஆ இ ஈ உ ஊ (section 6 content tables)
- Language toggle, parent gate, parent zone, local progress save, offline PWA
- Placeholder art first, real GLB assets swapped in at Phase 6

**Out (do not build):**

- Accounts, login, leaderboards, multiplayer, chat, free-text input, microphone or camera
- Ads, in-app purchases, analytics SDKs
- The remaining letters (the data pipeline must make adding them a JSON-only change)
- Lowercase tracing (data schema supports it; UI ships uppercase only)

---

## 4. World, camera, character

**Garden hub:** a small floating island, roughly a 40 × 40 unit disc, with grass, a winding path, 6 giant flower buds placed along the path in an S-curve, a gazebo "sing-along stage" at the end, a few trees, rocks and a pond. Sky is a vertical gradient on a large inverted sphere (no skybox texture). A few clouds drift slowly.

**Camera:** perspective, FOV 45, about 30° downward tilt, framing the whole island in landscape 16:9. When a bud is chosen, the camera tweens (1.0 s, easeInOutCubic) to a close-up rail for that bud. In portrait, show a full-screen "rotate your phone" illustration (animated phone icon, no text).

**Buzzy (placeholder until Phase 6):** a round yellow body (sphere scaled 1, 0.9, 1.1) with 2 dark stripes (vertex colours or a tiny canvas texture), big white eyes with black pupils that track the camera, 2 translucent wing planes flapping at about 12 Hz, and small antennae.

- **Idle:** sine bob of ±0.15 units at 0.8 Hz
- **Fly-to:** CatmullRom curve with banking into turns, 1.2 s
- **Celebrate:** 360° spin plus a small jump
- **Point:** lean toward the hint target
- **Yawn:** for P7

> **BUZZY_SPEC:** *(I will paste the exact colours and description from my Buzzy Spelling Garden app here. Until then use: body #FFD23F, stripes #3B2A20, wings #FFFFFF at 45% opacity, cheeks #FF8FA3.)*

**Visual style:** soft, chunky, toy-like low-poly in the spirit of preschool 3D cartoons, without copying any existing show's characters or look.

- `MeshToonMaterial` with a 3-step gradient map, one `HemisphereLight` plus one `DirectionalLight`
- Blob-shadow decals under characters (no real shadows on the low tier)
- Palette tokens in `src/core/theme.ts`: grass #7BC950, path #F2D7A1, sky top #8ED1FC, sky bottom #E0F4FF, petal colours #FF8FA3 #FFB84C #B28DFF #6FD3E8 #FF6B6B #9BE15D

**Juice everywhere:** squash and stretch (easeOutBack overshoot) on every tap response, pollen particle bursts (instanced points, ≤ 200 particles) and a soft chime on success.

---

## 5. Core loop and the 3 mini-game templates

### 5.1 Letter loop (state machine)

```
Garden ──tap bud──▶ LetterIntro ──▶ MiniGame(template from data) ──▶ Bloom ──▶ Garden
   │                    (skippable after 1st view)                      (5 s)
   ├──tap stage──▶ SingAlong ──end/exit──▶ Garden
   └──hold parent button 3 s──▶ ParentGate ──pass──▶ ParentZone ──▶ Garden
```

- **LetterIntro (8–12 s):** Buzzy flies to the bud, the bud opens a little, the giant 3D glyph rises out of it, the sung line for that letter plays, and the voice says "A is for Apple!" while the 3D apple pops in beside the glyph.
- **Bloom (5 s):** the bud fully blooms into a large flower carrying the glyph, the object (e.g. an apple tree) grows next to it, confetti pollen bursts, and Buzzy celebrates. The bloom is saved to progress and stays in the garden.
- In the garden, the **suggested next** bud gently pulses. All buds are always tappable; nothing is ever locked.

### 5.2 Template A: Pollen Pop (letter recognition)

- 7 bubbles float up slowly from the flower bed (sine drift, wrapped back to the bottom when they leave the top). Each bubble shows one glyph (a canvas texture on a sphere, or an extruded glyph inside a transparent sphere). For canvas textures, wait for the self-hosted font through the `FontFace` API before drawing, or Tamil glyphs will render in a fallback font.
- 3 bubbles carry the **target** glyph. The other 4 are distractors from `distractors[]` in the data.
- Voice: "Pop the bubbles with **A**!"
- Tapping the target pops the bubble (particles, pop SFX, and the voice says the letter sound). Tapping a distractor makes it wobble, plays "boop", and the bubble stays.
- **Hint:** after 2 misses or 6 s idle, target bubbles pulse and Buzzy points at the nearest one.
- The round ends after 3 targets are popped. There is 1 round per visit.

### 5.3 Template B: Trace the Trail (letter formation)

- The glyph lies large on a flat "garden plot", seen from the close-up camera, with a dotted guide path.
- Each stroke has a **green start dot** and a small arrow. Buzzy sits on the start dot.
- The child drags. **Buzzy follows the finger only while the finger is within tolerance of the current stroke** (default 12% of glyph height for ages 3–4; parent setting "older child" makes it 8%). The covered part of the stroke fills with a glowing pollen trail.
- Progress is the projection of the pointer onto the stroke polyline. It may only advance forward, and jumps of more than 15% of the stroke length are ignored, so kids can't cheat by tapping the end.
- A stroke is complete at ≥ 85% coverage. Strokes are done in order. The letter is complete when all strokes are done.
- If the finger is off the path, the trail stops (no punishment), Buzzy hovers back to the last valid point, and the start dot pulses.
- Voice: "Trace **A** with your finger. Follow Buzzy!"
- **Stroke data:** `src/data/strokes/{lang}/{id}.json`, each holding normalized polylines in a 0–1 box with y pointing up. Example for English A:

```json
{ "id": "A", "strokes": [
  [[0.50,0.95],[0.08,0.05]],
  [[0.50,0.95],[0.92,0.05]],
  [[0.25,0.40],[0.75,0.40]]
]}
```

- Build a **dev-only Stroke Editor** at `/?dev=strokes`. It shows the glyph; I click to place points, Enter ends a stroke, and an Export button copies the JSON. I will author the Tamil stroke orders myself with it.

### 5.4 Template C: Basket Match (initial sound)

- 3 3D objects sit on a picnic cloth. One starts with the target letter; 2 are distractors from `matchDistractors[]`.
- Voice: "Which one starts with **/a/**? Put it in Buzzy's basket!"
- The child drags an object; it follows the pointer on a raycast plane.
- **Correct:** dropping it within the basket radius makes it hop in, the voice says "Apple! A is for Apple!", and the round is done.
- **Wrong:** the object bounces back to its spot with a gentle "boop" and the voice names it ("That's a fish!"). After 2 misses the correct object glows.
- 2 rounds per visit, with object positions shuffled each time.

### 5.5 Template interface

```ts
interface MiniGame {
  readonly id: 'pollenPop' | 'traceTrail' | 'basketMatch';
  enter(ctx: GameContext, letter: LetterDef): Promise<void>; // build scene objects, start VO
  update(dt: number): void;
  onPointer(e: GamePointerEvent): void;
  exit(): void;            // dispose geometries/materials/textures — no leaks
  onComplete: () => void;  // set by the state machine
}
```

Adding a 4th template later must not change existing code apart from a registry entry.

### 5.6 Sing-along mode

- Tapping the gazebo moves the camera onto a slow rail past all the buds. The full song (one per language) plays.
- At each cue time, the matching bud bounces, flashes and shows its glyph plus a small 3D object. Buzzy flies bud to bud in time.
- For pre-readers, show the **big glyph and the object, not karaoke lyrics**.
- Cue data: `src/data/cues.{lang}.json` → `[{ "id": "A", "t": 4.20 }, …]` (seconds).
- Build a **dev-only Cue Recorder** at `/?dev=cues`. It plays the song; I press the key for each letter as it is sung, and it exports the cue JSON.
- An exit button (home icon) is always visible.

---

## 6. Content data

### 6.1 Schema (validate with `zod` at build time and in tests)

```ts
type LetterDef = {
  id: string;                 // "A", "a1" (use ASCII ids for Tamil: "ta_a", "ta_aa"…)
  lang: 'en' | 'ta';
  glyph: string;              // "A" | "அ"
  word: string;               // "Apple" | "அணில்"
  wordRoman?: string;         // "aṇil" (for my reference only, never shown to kids)
  objectModel: string;        // "apple" → /assets/models/apple.glb (placeholder primitive until Phase 6)
  template: 'pollenPop' | 'traceTrail' | 'basketMatch';
  distractors: string[];      // glyphs for Pollen Pop
  matchDistractors: string[]; // objectModel ids for Basket Match
  vo: { intro: string; isFor: string; sound: string }; // keys into vo-manifest
  songSlice?: { start: number; end: number };          // seconds within the full song
};
```

### 6.2 MVP content: English

| id | glyph | word | template | distractors | matchDistractors |
|---|---|---|---|---|---|
| A | A | Apple | pollenPop | B, D, E, F | — |
| B | B | Bee | traceTrail | — | — |
| C | C | Cat | basketMatch | — | duck, fish |
| D | D | Duck | pollenPop | B, C, E, F | — |
| E | E | Egg | traceTrail | — | — |
| F | F | Fish | basketMatch | — | apple, cat |

(B is Bee, so Buzzy gets a cameo. Every object model is reused across letters as a distractor.)

### 6.3 MVP content: Tamil (உயிர் எழுத்துக்கள் 1–6)

| id | glyph | word | roman | template |
|---|---|---|---|---|
| ta_a | அ | அணில் | aṇil (squirrel) | pollenPop |
| ta_aa | ஆ | ஆடு | āṭu (goat) | traceTrail |
| ta_i | இ | இலை | ilai (leaf) | basketMatch |
| ta_ii | ஈ | ஈ | ī (housefly) | pollenPop |
| ta_u | உ | உரல் | ural (stone mortar) | traceTrail |
| ta_uu | ஊ | ஊஞ்சல் | ūñcal (swing) | basketMatch |

Tamil Pollen Pop distractors come from the other 5 vowels. Basket Match distractors come from the other Tamil objects. Mark all Tamil words and VO with `// REVIEW(ta)`: I will verify them against the Tamil Nadu primer.

### 6.4 Voice-over manifest

Create `src/data/vo-manifest.json` with an id → `{ en: file, ta: file, textEn, textTa }` map. Required ids:

`tap_to_start, welcome, pick_flower, pp_instruction, tt_instruction, bm_instruction, great_1, great_2, great_3, try_again, look_here, letter_is_for (template "{glyph} is for {word}!"), sing_intro, sleepy, parent_gate_hint`, plus per letter: `{id}_sound, {id}_isfor`.

- **Placeholder VO (Phases 1–5):** use `speechSynthesis` with an `en-IN` voice, or a `ta-IN` voice if available. If no Tamil voice exists, fall back to showing the glyph pulsing and playing a chime. Never block gameplay on VO.
- **Phase 6:** real recorded `.mp3`/`.ogg` files replace the placeholders through the manifest. No code changes.

---

## 7. Tech architecture

### 7.1 Stack

- **Vite + TypeScript + three.js** (`WebGLRenderer`). Pin the current stable `three` version (check with `npm view three version`) and log it in `DECISIONS.md`. **Do not use WebGPU** for MVP: WebGL2 has the broadest reach on low-end Android and older iPads.
- No React or framework for the game canvas. UI overlays (HUD, parent zone) are plain DOM plus CSS on top of the canvas.
- Audio: Web Audio API directly (a small wrapper with music, VO and SFX buses and ducking). Howler is acceptable only if you justify it.
- Tweens: a tiny in-house tween utility (`src/core/tween.ts`, easing functions included).
- Validation: `zod` (build and test only if possible).
- PWA: `vite-plugin-pwa` (precache shell plus the current language pack; letter packs cached on first use).
- Tests: `vitest` for unit tests, `@playwright/test` for e2e.

### 7.2 Folder structure

```
src/
  main.ts
  core/       renderer.ts loop.ts stateMachine.ts input.ts audio.ts assets.ts
              tween.ts quality.ts storage.ts i18n.ts theme.ts dispose.ts
  scenes/     GardenScene.ts LetterIntro.ts Bloom.ts SingAlong.ts
  minigames/  MiniGame.ts registry.ts PollenPop.ts TraceTrail.ts BasketMatch.ts
              traceMath.ts          // pure functions, fully unit-tested
  entities/   Buzzy.ts Bud.ts Bubble.ts Basket.ts PollenParticles.ts
  ui/         hud.ts parentGate.ts parentZone.ts rotatePrompt.ts loading.ts
  dev/        strokeEditor.ts cueRecorder.ts perfOverlay.ts   // excluded from prod build
  data/       letters.en.json letters.ta.json cues.en.json cues.ta.json
              vo-manifest.json strokes/en/*.json strokes/ta/*.json brand.config.json
public/assets/ models/ audio/ fonts/ textures/
scripts/      build-letters.ts optimize-assets.ts check-budgets.ts
tests/        unit/ e2e/
DECISIONS.md  ASSETS.md (licence log, see section 10)
```

### 7.3 Key systems

- **Loop:** `renderer.setAnimationLoop`, a fixed `dt` clamp (max 1/20 s), and pausing everything on `visibilitychange`.
- **Input:** pointer events → raycast against **hit colliders** (invisible spheres or boxes, larger than the visuals), never against complex meshes.
- **Assets:** `GLTFLoader` with `MeshoptDecoder`. Add `KTX2Loader` only if textured assets actually exist; its transcoder is a sizeable WASM file, so count it in the budget. Self-host all decoders in `/public`. Packs are loaded per language and per letter; the next suggested letter's pack is prefetched while the child plays. A simple reference-counting cache disposes unused geometries, materials and textures.
- **3D glyphs:** `scripts/build-letters.ts` runs at **build time**. It uses `opentype.js` to read the glyph outline from the self-hosted fonts, and outputs either a GLB per glyph (written with `@gltf-transform/core`) or a compact outline JSON that is extruded with a rounded bevel at runtime. Pick the simpler option and log it. Fonts: **Baloo 2** (Latin) and **Baloo Thambi 2** (Tamil), both under the SIL Open Font License, subset to the needed glyphs. The Tamil uyir letters are single code points, so per-glyph extraction works without a shaping engine. Confirm this for each glyph and log any exceptions.
- **Quality tiers (`quality.ts`):** pick a tier at boot using `navigator.deviceMemory` (when available), `renderer.capabilities`, and a 2-second frame-time probe on the loading screen.
  - **Low:** DPR 1, no shadow maps (blob decals only), 100 particles max
  - **Mid:** DPR 1.5, one 1024 shadow map
  - **High:** DPR ≤ 2, one 2048 shadow map
  - Drop a tier automatically if average frame time stays above 40 ms for 3 s.
- **Storage:** `localStorage`, every call wrapped in try/catch, versioned key `buzzyabc:v1`. Stores only `{ lang, bloomed: string[], introsSeen: string[], tolerance, volume }`. The game must work perfectly if storage throws.
- **i18n:** VO and parent-zone strings come from JSON. A build-time check fails if any id is missing in either language.

### 7.4 Performance budgets (enforced by `scripts/check-budgets.ts` in CI; the build fails if any is exceeded)

| Budget | Limit |
|---|---|
| JS (all chunks, gzip) | ≤ 300 KB |
| Transferred until "tap to start" screen | ≤ 2 MB |
| Transferred until garden playable | ≤ 5 MB |
| Each letter pack (model + audio + strokes) | ≤ 1.5 MB |
| Any single GLB | ≤ 400 KB; characters ≤ 8k tris; props ≤ 3k tris |
| Textures | ≤ 512² (KTX2) or vertex colours only (preferred) |
| Draw calls in garden | ≤ 80 (merge static scenery, instance flowers/grass) |
| Frame rate | 60 fps mid-range; ≥ 30 fps on low tier |
| Tap → visible response | ≤ 100 ms |

---

## 8. Audio

- **Buses:** music (default volume 0.35), VO (1.0), SFX (0.7). Music ducks to 0.12 while VO plays.
- **iOS/Safari:** create or resume the `AudioContext` on the first "tap to start" gesture, and resume again on `touchend` if it gets suspended.
- Keep 1 background music loop per language (the instrumental version of the song). Load SFX as one audio sprite: `pop, boop, chime, buzz, whoosh, bloom, celebrate`.
- Pause all audio on `visibilitychange`. Provide a mute icon in the HUD.
- Never play VO and the sung line at the same time; queue them.

---

## 9. Parent gate and parent zone

- **Gate:** the parent icon sits small in the top-right corner. Holding it for 3 s opens a challenge: a random number written in words ("Tap forty-seven") with a 4×3 number pad. 3 wrong attempts close the gate. The gate never shows to a child who is just tapping.
- **Parent zone (plain DOM, readable text, both languages):**
  - Language: English / தமிழ்
  - Tracing difficulty: Little (3–4) / Big (5–6)
  - Volume sliders, and a reset-progress button with a confirm step
  - "What your child is learning": the letters list with bloom status
  - Privacy note in plain language (section 10)
  - "More from Buzzy": links to my website and the Buzzy mobile app. **Outbound links exist only here.** Read the URLs from `brand.config.json`: `PARENT_SITE_URL` and `APP_STORE_URL` / `PLAY_STORE_URL`.
- **White-label hook:** `brand.config.json` holds `{ partnerName, partnerLogo, accentColor, parentSiteUrl }`. The loading screen shows "presented by {partnerName}" when it is set. The child area stays unbranded. This lets me ship a branded build for a play school or clinic with only a config change.

---

## 10. Privacy, safety and licensing (hard rules)

1. **No personal data from children.** No accounts, names, photos, audio, location, free text, device IDs, or fingerprinting.
2. **No third-party network requests from the game.** Self-host fonts, decoders and all assets. Add a Content-Security-Policy meta/header limited to `'self'`. A Playwright test asserts that every request in a full play session is same-origin.
3. **No analytics or ads SDKs in the game.** (Measurement happens on my separate parent-facing website, not here.)
4. Progress lives only in the browser's local storage.
5. `/privacy.html` explains this in plain English and Tamil.
6. **`ASSETS.md` licence log:** every asset (model, texture, font, song, VO, SFX) gets a row with source/tool, creator, licence or plan, date, and proof link. **No asset ships without a row.** Free-tier AI music, for example, is often non-commercial only; check each tool's terms.
7. Don't imitate any existing kids' brand (characters, logos, theme songs, colour signatures).

---

## 11. Accessibility

- Every action has 3 kinds of feedback: visual, audio and motion.
- Respect `prefers-reduced-motion`: halve camera moves, no screen shake, fewer particles.
- Contrast ≥ 4.5:1 for the parent-zone text. Glyphs on bubbles get a dark outline.
- Colour is never the only cue (targets also pulse and scale).
- The parent zone works with the keyboard.

---

## 12. Phased plan with acceptance checks

**Phase 0: Scaffold.** Vite + TS strict, three, ESLint/Prettier, vitest, Playwright, `vite-plugin-pwa` (disabled until Phase 5), `check-budgets.ts`, dev perf overlay (fps, draw calls, triangles, memory), and a static deploy config (`dist/` deployable to any static host under a subpath such as `/play/`).
- ✅ `npm run dev`, `npm run build`, `npm test` and `npm run e2e` all pass. The empty scene renders a sky gradient and spinning cube at 60 fps. The budget script runs.

**Phase 1: Garden and Buzzy (placeholders).** Island, path, 6 placeholder buds (cone plus sphere petals), gazebo, placeholder Buzzy with all 5 animations, guided camera, state machine, input/raycast with hit colliders, tap-to-start screen with audio unlock, rotate prompt.
- ✅ Tap a bud: Buzzy flies there, the camera tweens, a stub letter scene appears, and the home icon returns to the garden. Nothing leaks after 20 round trips (renderer.info memory counts stable). Holds ≥ 30 fps at 4× CPU throttle in Chrome DevTools.

**Phase 2: The 3 templates with English data.** PollenPop, TraceTrail and BasketMatch are fully data-driven. `traceMath.ts` has unit tests. Speech-synthesis VO placeholders, LetterIntro and Bloom are in, and blooms persist in the garden.
- ✅ All 6 English letters are playable end to end. Unit tests cover the trace rules: on-path progress, off-path pause, forward-only, jump guard, stroke order and multi-stroke completion. Wrong answers never block progress. The hint fires after 2 misses or 6 s.

**Phase 3: Audio and sing-along.** Audio buses, ducking, SFX sprite, music loop, VO manifest loader, the sing-along rail, the Cue Recorder and the Stroke Editor.
- ✅ With a dummy song file, the cues fire within 50 ms of their timestamps. The Cue Recorder exports valid JSON that passes schema validation. Audio resumes correctly after the tab is backgrounded on iOS Safari.

**Phase 4: Tamil.** The fonts pipeline and `build-letters.ts` for both languages, Tamil data, the language toggle (in the parent zone, plus a big "A / அ" icon button on the garden HUD), and Tamil placeholder strokes.
- ✅ All 6 Tamil letters are playable. Screenshot tests render each Tamil glyph correctly. The i18n completeness check passes.

**Phase 5: Parent zone, persistence, PWA, privacy.** Gate, parent zone, `brand.config.json`, privacy page, CSP, and offline caching.
- ✅ After one full online visit, the game loads and plays offline in airplane mode. The same-origin network test passes. Storage failure (mocked) doesn't break anything. The gate can't be opened by random tapping (tested with 200 random taps).

**Phase 6: Real assets.** Swap the placeholders for the GLBs and audio in `/public/assets` (I'll supply them). Add `optimize-assets.ts` (gltf-transform: dedup, weld, simplify only where over budget, meshopt, KTX2 or WebP textures), so GLBs from AI 3D tools are auto-processed. Update `ASSETS.md`.
- ✅ All budgets in 7.4 pass. Every asset has a licence row. No visual regressions in the screenshot tests.

**Phase 7: Polish and QA.** Pass over juice and timing, quality-tier auto-switching, reduced-motion support, and the P7 gentle stop. Remove dev tools from the prod build. Produce a QA report.
- ✅ A device matrix report covers a low-end Android phone on Chrome, an iPhone on Safari, an iPad on Safari and desktop Chrome: fps, load time on throttled "Fast 4G", and any bugs. There are no console errors. Lighthouse Performance is ≥ 90 on desktop, and installability passes in the Chrome DevTools Application panel.

---

## 13. Definition of done (MVP)

- A 4-year-old who has never seen the game can finish one letter **without adult help** in under 3 minutes. (I will run this test with 5 kids; you make sure nothing requires reading.)
- Loads to the garden in **≤ 5 s** on throttled Fast 4G and is playable at ≥ 30 fps on the low tier.
- Adding letter G requires only: 1 JSON entry, 1 stroke file, 1 model, VO lines, and re-running `build-letters`. **No code changes.** Prove it by adding a test letter in a test fixture.
- Zero third-party requests, zero personal data, and every asset licensed and logged.
- `README.md` covers how to run, build, deploy to a subpath, add a letter, add a language and make a white-label build.
