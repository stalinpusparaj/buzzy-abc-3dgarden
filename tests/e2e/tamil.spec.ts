import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { hook, playMiniGame, startGame, tapBud, waitState } from './game';
import { watch } from './helpers';

const lettersTa = JSON.parse(readFileSync('src/data/letters.ta.json', 'utf8')) as {
  id: string;
  glyph: string;
  template: string;
}[];

async function useTamil(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!localStorage.getItem('buzzyabc:v1')) {
      localStorage.setItem(
        'buzzyabc:v1',
        JSON.stringify({ lang: 'ta', bloomed: [], introsSeen: [] }),
      );
    }
  });
}

test('the A / அ button switches the garden to Tamil and back', async ({ page }) => {
  await startGame(page);
  expect(await hook(page, 'budIds')).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  await page.locator('#btn-lang').click();
  await expect.poll(() => hook(page, 'budIds')).toEqual(lettersTa.map((l) => l.id));
  expect(await hook(page, 'lang')).toBe('ta');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ta');
  await page.locator('#btn-lang').click();
  await expect.poll(() => hook(page, 'budIds')).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
});

test('all 6 Tamil letters are playable end to end', async ({ page }) => {
  test.setTimeout(300_000);
  const w = watch(page);
  await useTamil(page);
  await startGame(page);
  for (const l of lettersTa) {
    await tapBud(page, l.id);
    await waitState(page, 'letter');
    await playMiniGame(page, l.template);
    await waitState(page, 'garden', 20_000);
    expect(await hook(page, 'bloomed')).toContain(l.id);
    await page.waitForTimeout(1400);
  }
  expect(w.errors).toEqual([]);
});

test.describe('Tamil glyphs render correctly', () => {
  // Pixel baselines are GPU/OS specific: they were recorded on macOS (Metal).
  test.skip(process.platform !== 'darwin', 'screenshot baselines are macOS-only');
  for (const l of lettersTa) {
    test(`glyph ${l.glyph} (${l.id})`, async ({ page }) => {
      await startGame(page);
      await hook(page, 'previewGlyph', 'ta', l.glyph);
      await page.waitForTimeout(400);
      await expect(page.locator('#game-canvas')).toHaveScreenshot(`${l.id}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
