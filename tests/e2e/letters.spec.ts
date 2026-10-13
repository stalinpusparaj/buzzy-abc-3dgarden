import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { drag, hook, playMiniGame, startGame, tapBud, waitState, waitTargets } from './game';
import { watch } from './helpers';

const lettersEn = JSON.parse(readFileSync('src/data/letters.en.json', 'utf8')) as {
  id: string;
  template: string;
}[];

test.describe.configure({ mode: 'serial' });

test('all 6 English letters are playable end to end and blooms persist', async ({ page }) => {
  test.setTimeout(300_000);
  const w = watch(page);
  await startGame(page);
  for (const l of lettersEn) {
    await tapBud(page, l.id);
    await waitState(page, 'letter');
    await playMiniGame(page, l.template);
    await waitState(page, 'garden', 20_000);
    expect(await hook(page, 'bloomed')).toContain(l.id);
    await page.waitForTimeout(1400);
  }
  // Blooms survive a reload.
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  expect(await hook(page, 'bloomed')).toEqual(lettersEn.map((l) => l.id));
  expect(w.errors).toEqual([]);
});

test('Pollen Pop: 2 misses fire the hint, and misses never block', async ({ page }) => {
  await startGame(page);
  await tapBud(page, 'A');
  await waitTargets(page);
  const before = await hook(page, 'hints');
  for (let i = 0; i < 2; i++) {
    const wrong = await hook(page, 'wrongTargets');
    await page.mouse.click(wrong[0]!.x, wrong[0]!.y);
    await page.waitForTimeout(250);
  }
  expect(await hook(page, 'hints')).toBe(before + 1);
  await playMiniGame(page, 'pollenPop');
  await waitState(page, 'garden', 20_000);
});

test('Basket Match: idle for 6 s fires the hint; a wrong drop bounces back', async ({ page }) => {
  await startGame(page);
  await tapBud(page, 'C');
  await waitTargets(page);
  const before = await hook(page, 'hints');
  await page.waitForTimeout(6600);
  expect(await hook(page, 'hints')).toBeGreaterThan(before);
  await drag(page, await hook(page, 'wrongTargets'), 8);
  await page.waitForTimeout(800);
  expect(await hook(page, 'state')).toBe('letter');
  await playMiniGame(page, 'basketMatch');
  await waitState(page, 'garden', 20_000);
});

test('Trace: the hint fires after 6 s idle; tapping the end does not complete', async ({
  page,
}) => {
  await startGame(page);
  await tapBud(page, 'B');
  await waitTargets(page);
  const pts = await hook(page, 'targets');
  await page.mouse.click(pts.at(-1)!.x, pts.at(-1)!.y);
  const before = await hook(page, 'hints');
  await page.waitForTimeout(6600);
  expect(await hook(page, 'hints')).toBeGreaterThan(before);
  expect(await hook(page, 'state')).toBe('letter');
  await playMiniGame(page, 'traceTrail');
  await waitState(page, 'garden', 20_000);
});
