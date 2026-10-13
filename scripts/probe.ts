/**
 * QA probe: open a URL in headless Chromium on the real GPU, optionally CPU-throttled,
 * then print the perf overlay and save a screenshot.
 *   npx tsx scripts/probe.ts "http://localhost:5173/?dev=perf" --throttle 4 --shot shot.png
 */
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const url = args[0] ?? 'http://localhost:5173/?dev=perf';
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const [vw, vh] = (opt('viewport') ?? '1280x720').split('x').map(Number);
const throttle = Number(opt('throttle') ?? 1);
const wait = Number(opt('wait') ?? 5000);
const clicks = (opt('click') ?? '').split(';').filter(Boolean);

const browser = await chromium.launch({
  args: [
    '--use-angle=metal',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const page = await browser.newPage({ viewport: { width: vw ?? 1280, height: vh ?? 720 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', String(e)));
const cdp = await page.context().newCDPSession(page);
if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
await page.goto(url);
for (const c of clicks) {
  await page.waitForTimeout(1500);
  const [x, y] = c.split(',').map(Number);
  await page.mouse.click(x ?? 0, y ?? 0);
}
await page.waitForTimeout(wait);
const overlay = await page
  .locator('#perf-overlay')
  .textContent()
  .catch(() => null);
console.log(overlay ?? '(no perf overlay; add ?dev=perf)');
const shot = opt('shot');
if (shot) await page.screenshot({ path: shot });
await browser.close();
