# Asset licence log

**No asset ships without a row** (brief §10.6). Columns: file · kind · source/tool · creator · licence/plan · date · proof.

| File | Kind | Source / tool | Creator | Licence / plan | Date | Proof |
|---|---|---|---|---|---|---|
| public/assets/fonts/baloo2-latin-700.woff2 | font | Fontsource `@fontsource/baloo-2` 5.3.0 (Google Fonts Baloo 2) | Ek Type | SIL OFL 1.1 (copy shipped as `OFL-baloo2-latin-700.txt`) | 2026-10-13 | https://github.com/EkType/Baloo2 |
| public/assets/fonts/baloothambi2-tamil-700.woff2 | font | Fontsource `@fontsource/baloo-thambi-2` 5.3.0 (Google Fonts Baloo Thambi 2) | Ek Type | SIL OFL 1.1 (copy shipped as `OFL-baloothambi2-tamil-700.txt`) | 2026-10-13 | https://github.com/EkType/Baloo2 |
| src/data/glyphs.*.json | glyph outlines | Extracted from the two fonts above by `scripts/build-letters.ts` | Ek Type (outlines) | SIL OFL 1.1 (derived data) | 2026-10-13 | as above |
| public/assets/audio/sfx.mp3 | SFX sprite (PLACEHOLDER) | `scripts/make-placeholder-audio.ts` (oscillator synthesis) | this project | own work, no third-party material | 2026-10-13 | the script itself |
| public/assets/audio/music-loop.mp3 | music loop (PLACEHOLDER) | `scripts/make-placeholder-audio.ts` (Karplus-Strong + bells, seeded) | this project | own work, no third-party material | 2026-10-13 | the script itself |
| public/assets/audio/song-dummy.mp3 | dummy song for cue timing (PLACEHOLDER) | `scripts/make-placeholder-audio.ts` | this project | own work, no third-party material | 2026-10-13 | the script itself |
| Placeholder 3D props, Buzzy, buds, gazebo, garden | procedural geometry in code (`src/entities/**`) | three.js primitives | this project | own work | 2026-10-13 | source code |

**Replace before launch:** every PLACEHOLDER row above. Voice-over currently uses the device's speech synthesis; recorded VO files need rows here when they land (Phase 6).
