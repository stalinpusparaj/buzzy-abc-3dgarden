# Decisions log

Format: date · decision · why · alternative rejected. Every dependency lists its shipped gzip size.

## Dependencies

| Package | Version | Kind | Shipped gzip | Why |
|---|---|---|---|---|
| three | 0.186.1 | runtime | ≈128 KB (whole Phase 0 bundle incl. our code) | 3D engine required by brief §7.1; latest stable per `npm view three version` on 2026-10-13 |
| vite | 8.3.4 | dev | 0 | Bundler/dev server (brief §7.1) |
| typescript | 6.0.3 | dev | 0 | `strict: true`. Pinned to 6.0 because typescript-eslint 8.71 supports `<6.1.0` (TS 7 is out but unsupported by the linter) |
| vitest | 5.0.4 | dev | 0 | Unit tests (brief §7.1) |
| @playwright/test | 1.64.0 | dev | 0 | E2E tests (brief §7.1) |
| vite-plugin-pwa (+ workbox-build/-window 7.4.1 peers) | 2.0.0 | dev | service worker only (counted in JS budget) | Offline PWA (brief §7.1); disabled until Phase 5 |
| eslint, @eslint/js, typescript-eslint, globals, eslint-config-prettier | 10.12.0 / 10.0.1 / 8.71.2 / 17.13.0 / 10.1.8 | dev | 0 | Linting incl. `no-explicit-any` and a 300-line `max-lines` rule (brief rule 6) |
| prettier | 3.9.10 | dev | 0 | Formatting |
| tsx | 4.23.15 | dev | 0 | Runs the TypeScript build scripts in `scripts/` |
| @types/three, @types/node | 0.186.0 / 26.6.5 | dev | 0 | Types |

## Log

- **2026-10-13 · Repo layout.** The game lives at the root of `github.com/stalinpusparaj/PILGRIM` (local folder `PILGRIM/buzzy-abc-garden`); both briefs are copied to `docs/`. *Why:* CI and static deploys expect `package.json` at the repo root. *Rejected:* making the whole `PILGRIM/` folder the repo with the game in a subfolder.
- **2026-10-13 · Relative `base: './'`.** One `dist/` works at `/`, `/play/` or any subpath without a rebuild; `BASE_PATH=/play/ npm run build` pins an absolute base if a host needs it. E2E serves the build under `/play/` to prove it. *Rejected:* hard-coding `/play/`.
- **2026-10-13 · Dev tools behind a `__DEV_TOOLS__` compile-time flag.** True in `vite` dev and `--mode qa` builds, false in production, so `src/dev/**` is tree-shaken out. `check-budgets.ts` greps `dist/` for a marker string to prove it. A QA build (`npm run build:qa`) keeps the perf overlay for real-device testing. *Rejected:* `import.meta.env.DEV` only (would make on-device perf checks impossible).
- **2026-10-13 · Stricter TS flags.** `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `noImplicitOverride` on top of `strict`. `exactOptionalPropertyTypes` was tried and dropped: it fights three.js's own typings more than it catches bugs.
- **2026-10-13 · Scope-based tweens.** `src/core/tween.ts` ties every tween, timer and per-frame callback to a `Scope`. Killing a scene's scope drops its pending promises, so `async` sequences stop cleanly instead of animating disposed objects. *Rejected:* a global tween list with cancel-by-id.
- **2026-10-13 · QA fps probe uses headless Chromium on Metal** (`scripts/probe.ts`, `--use-angle=metal`). The default headless GPU is SwiftShader (CPU) which would make fps numbers meaningless.
- **2026-10-13 · Git workflow.** Phase 0 is the initial commit on `main`; later phases land on the `mvp` branch, pushed after each phase, then go to `main` through one PR.
