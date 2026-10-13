# Phase reports

## Phase 0: Scaffold (2026-10-13)

1. ✅ `npm run dev`, `npm run build`, `npm test` (6 unit tests) and `npm run e2e` (subpath smoke test) all pass; lint + typecheck clean.
2. ✅ The empty scene renders the sky gradient (inverted-sphere shader) and a spinning toon cube at 60 fps (headless Chromium on Metal, perf overlay: 2 draw calls, 540 tris).
3. ✅ `scripts/check-budgets.ts` runs: JS 128.2 KB gzip / 300 KB, dev tools absent from `dist/`, GLB/texture/letter-pack checks ready.
4. ✅ Perf overlay at `?dev=perf` (fps, frame ms, calls, tris, geometries, textures, programs, DPR, heap), excluded from production by `__DEV_TOOLS__`.
5. ✅ `dist/` is relocatable (`base: './'`); e2e serves it at `/play/` and asserts zero console errors and zero third-party requests.
6. Stubbed: `validate-data.ts` is a no-op until content exists; `vite-plugin-pwa` is installed but disabled.
7. Stubbed: transfer (2 MB / 5 MB) and draw-call budgets show "skip" until the e2e suite measures them.
8. Risk: three.js alone is ~128 KB gzip, so game code has ~170 KB of the JS budget.
9. Risk: TypeScript pinned to 6.0.3 because typescript-eslint doesn't support TS 7 yet.
10. Risk: the GitHub Actions workflow is untested until its first run.

## Phase 1: Garden and Buzzy, placeholders (2026-10-13)

1. ✅ Tap a bud: Buzzy flies there (CatmullRom arc, banking), the camera tweens 1.0 s to the bud's close-up, the bud opens a little and a stub letter object pops in; the home icon returns to the garden (e2e).
2. ✅ No leaks: geometry and texture counts are identical after 1 and after 20 round trips (e2e, `renderer.info.memory`).
3. ✅ 60 fps at 4× CPU throttle in Chrome (headless, real Metal GPU; e2e asserts ≥ 30). Garden: 41 draw calls (incl. shadow pass), ~47k tris.
4. ✅ Island, S-curve path, pond, trees, rocks, bushes merged into 1 draw call; flowers, grass tufts, clouds instanced (1 call each); buds use a morph target so opening costs nothing.
5. ✅ Buzzy placeholder: idle bob ±0.15 @ 0.8 Hz, 12 Hz wings, fly-to, celebrate, point, yawn, blinking, pupils track the camera; blob shadow.
6. ✅ Tap targets on a 740×360 phone: every bud's visual ≥ 64 px and collider ≥ 96 px (e2e). Overview camera adapts to 4:3 and 19.5:9.
7. ✅ Tap-to-start (pointerdown, unlocks Web Audio), CSS-only rotate prompt, state machine, Pointer Events input with primary-pointer-only picking.
8. Stubbed: the letter scene is a placeholder knot; gazebo tap just makes Buzzy celebrate (sing-along lands in Phase 3).
9. Risk: the fps number is from an M1 Max with CPU throttling, not a real low-end Android GPU; Phase 7's device matrix is the real test.
10. Risk: quality tiers pick "high" on desktop (2048 shadow map); the auto-drop exists but is only exercised in Phase 7.

## Phase 2: The 3 templates with English data (2026-10-13)

1. ✅ All 6 English letters play end to end with real pointer input (e2e): A/D Pollen Pop, B/E Trace the Trail, C/F Basket Match. Blooms persist across a reload.
2. ✅ `traceMath.ts` unit tests cover on-path progress, off-path pause, forward-only, the 15 % jump guard, stroke order and multi-stroke completion (8 tests).
3. ✅ Hints fire after 2 misses (Pollen Pop) and after 6 s idle (Basket Match, Trace); wrong answers never block (e2e).
4. ✅ LetterIntro (bud opens, 3D glyph rises, sung slice, "A is for Apple!", object pops in; skippable after the first view) and Bloom (full bloom, glyph + object stay in the garden, confetti, Buzzy celebrates).
5. ✅ Fonts pipeline: `build-letters.ts` extracts glyph outlines from self-hosted Baloo 2 / Baloo Thambi 2 (OFL); 3D glyphs are extruded with a rounded bevel at runtime.
6. ✅ Content is data: zod schema + `validate-data.ts` run on every build; templates load as lazy chunks from a registry.
7. ✅ Fully bloomed garden: 66 draw calls on high tier (shadows), 45 on low; JS 202 KB gzip across 16 chunks (zod not shipped).
8. Stubbed: VO is speechSynthesis (en-IN / ta-IN); SFX, music and the song are synthesised placeholders; 3D props are primitive placeholders.
9. Risk: English stroke centre lines were measured from the font, but stroke *order* follows common uppercase practice; check it against the scheme your schools teach.
10. Risk: placeholder props are recognisable but crude; Basket Match leans on them most, so it benefits first from the Phase 6 GLBs.

## Phase 3: Audio and sing-along (2026-10-13)

1. ✅ With the dummy song, all 6 cues fire 11 ms after their timestamps (limit 50 ms). Timing runs on the AudioContext clock, so it can't drift from the music (e2e).
2. ✅ The Cue Recorder (`/?dev=cues`) exports JSON that passes the same zod schema the build uses (unit test + browser check).
3. ✅ Audio suspends when the tab is hidden and resumes when it returns, in Chromium **and WebKit** (Safari's engine). A system-suspended context, like iOS after a call, resumes on the next touch (e2e + unit tests).
4. ✅ Music / VO / SFX buses; music ducks to 0.12 under VO, scaled by the parent's music volume (unit test). One SFX sprite, one background loop per language, VO and sung lines queued so they never overlap.
5. ✅ Sing-along: the camera follows a Catmull-Rom rail keyed to the cue times, Buzzy leaves early so she lands on the beat, and each bud bounces, flashes and shows its big glyph + object. No karaoke text. The home icon is always visible.
6. ✅ Stroke Editor (`/?dev=strokes`) is live (built in Phase 2 to author the English strokes). Both dev tools now use a stylesheet instead of inline styles, so they also work under the Phase 5 CSP in QA builds.
7. Stubbed: the song, loop and SFX are synthesised placeholders; `cues.en.json` matches the dummy song and must be re-recorded for the real one.
8. Risk: this is not a real iPhone. WebKit on macOS exercises the same Web Audio code, but iOS-only behaviours (silent switch, Low Power Mode, AirPods hand-off) need the Phase 7 device check.
9. Risk: the full song plays on the VO bus (volume 1.0), so the parent's "Voice" slider also sets song volume. Simple, but worth knowing.
10. Risk: speechSynthesis voices vary a lot between devices (many Androids have no ta-IN voice). The chime fallback works, but recorded VO is what makes the Tamil experience good.
