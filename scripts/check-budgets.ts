/**
 * Performance budgets (brief §7.4). Exits non-zero if any budget fails.
 * Static checks read dist/; transfer + draw-call numbers come from the e2e budget run
 * (test-results/runtime-budgets.json) when it exists.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { imageSize, inspectGlb } from './lib/glb';
import { letterPackFiles } from './lib/letterPacks';

const DIST = process.argv[2] ?? 'dist';
const KB = 1024;
const MB = 1024 * KB;
const CHARACTERS = new Set(['buzzy']);
const DEV_MARKER = 'BUZZY_DEV_TOOLS_PRESENT';

type Status = 'pass' | 'FAIL' | 'skip';
const rows: { budget: string; value: string; limit: string; status: Status }[] = [];
const add = (budget: string, value: string, limit: string, ok: boolean | null): void => {
  rows.push({ budget, value, limit, status: ok === null ? 'skip' : ok ? 'pass' : 'FAIL' });
};
const kb = (n: number): string => `${(n / KB).toFixed(1)} KB`;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (!existsSync(DIST)) {
  console.error(`check-budgets: ${DIST}/ not found. Run "npm run build" first.`);
  process.exit(1);
}
const files = walk(DIST);

// 1. JS, all chunks, gzip (service worker included).
const js = files.filter((f) => extname(f) === '.js');
const jsGzip = js.reduce((sum, f) => sum + gzipSync(readFileSync(f), { level: 9 }).length, 0);
add(`JS gzip (${js.length} files)`, kb(jsGzip), '300 KB', jsGzip <= 300 * KB);

// 2. Dev tools must not ship in production builds.
const leaked = js.filter((f) => readFileSync(f, 'utf8').includes(DEV_MARKER));
add(
  'Dev tools excluded',
  leaked.length ? leaked.map((f) => basename(f)).join(', ') : 'none',
  'none',
  leaked.length === 0,
);

// 3. GLBs: size + triangle budgets + embedded textures.
const glbs = files.filter((f) => extname(f) === '.glb');
for (const f of glbs) {
  const buf = readFileSync(f);
  const id = basename(f, '.glb');
  const info = inspectGlb(buf);
  const triLimit = CHARACTERS.has(id) ? 8000 : 3000;
  add(`GLB ${id} size`, kb(buf.length), '400 KB', buf.length <= 400 * KB);
  add(`GLB ${id} triangles`, String(info.triangles), String(triLimit), info.triangles <= triLimit);
  for (const img of info.images) {
    add(
      `GLB ${id} texture`,
      `${img.width}x${img.height}`,
      '512x512',
      img.width <= 512 && img.height <= 512,
    );
  }
}
if (glbs.length === 0) add('GLB budgets', 'no GLBs yet (placeholders)', '400 KB / tris', null);

// 4. Standalone textures.
const images = files.filter(
  (f) => /\.(png|jpe?g|webp|ktx2)$/i.test(f) && f.includes(`${join('assets', 'textures')}`),
);
for (const f of images) {
  const s = imageSize(readFileSync(f));
  if (s)
    add(
      `Texture ${basename(f)}`,
      `${s.width}x${s.height}`,
      '512x512',
      s.width <= 512 && s.height <= 512,
    );
}

// 5. Letter packs (model + audio + strokes).
for (const pack of letterPackFiles(DIST)) {
  add(`Letter pack ${pack.lang}:${pack.id}`, kb(pack.bytes), '1536 KB', pack.bytes <= 1.5 * MB);
}

// 6. Runtime budgets measured by the e2e suite.
const runtimePath = join('test-results', 'runtime-budgets.json');
if (existsSync(runtimePath)) {
  const r = JSON.parse(readFileSync(runtimePath, 'utf8')) as Record<string, number>;
  const m = (k: string): number | null => (typeof r[k] === 'number' ? r[k] : null);
  const toStart = m('bytesToStart');
  const toPlay = m('bytesToPlayable');
  const calls = m('gardenDrawCalls');
  add(
    'Transferred to "tap to start"',
    toStart === null ? 'n/a' : kb(toStart),
    '2048 KB',
    toStart === null ? null : toStart <= 2 * MB,
  );
  add(
    'Transferred to garden playable',
    toPlay === null ? 'n/a' : kb(toPlay),
    '5120 KB',
    toPlay === null ? null : toPlay <= 5 * MB,
  );
  add(
    'Garden draw calls',
    calls === null ? 'n/a' : String(calls),
    '80',
    calls === null ? null : calls <= 80,
  );
} else {
  add('Transfer + draw-call budgets', 'run "npm run e2e" to measure', '2 MB / 5 MB / 80', null);
}

const w = Math.max(...rows.map((r) => r.budget.length));
console.log(`\nBudgets for ${relative(process.cwd(), DIST) || DIST}/\n`);
for (const r of rows)
  console.log(
    `  ${r.status.padEnd(4)}  ${r.budget.padEnd(w)}  ${r.value.padStart(14)}  / ${r.limit}`,
  );
const failed = rows.filter((r) => r.status === 'FAIL');
console.log(failed.length ? `\n${failed.length} budget(s) FAILED\n` : '\nAll budgets pass\n');
process.exit(failed.length ? 1 : 0);
