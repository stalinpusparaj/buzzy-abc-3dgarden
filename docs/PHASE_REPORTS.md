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
