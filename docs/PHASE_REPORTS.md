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
