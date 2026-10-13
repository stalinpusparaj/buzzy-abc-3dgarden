import { expect, test } from '@playwright/test';
import { hook, startGame } from './game';

/** Runs in Chromium AND WebKit (Safari's engine; see playwright.config.ts). */
test('audio suspends when the tab is hidden and resumes when it returns', async ({ page }) => {
  await startGame(page);
  await expect.poll(() => hook(page, 'audioState')).toBe('running');
  const setHidden = (hidden: boolean): Promise<void> =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (h ? 'hidden' : 'visible'),
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await expect.poll(() => hook(page, 'audioState')).toBe('suspended');
  await setHidden(false);
  await expect.poll(() => hook(page, 'audioState')).toBe('running');
});

test('a system-suspended context resumes on the next touch (iOS interruption)', async ({
  page,
}) => {
  await startGame(page);
  await expect.poll(() => hook(page, 'audioState')).toBe('running');
  // Safari suspends audio itself after calls/Siri; mimic that, then tap.
  await page.evaluate(() =>
    (window as unknown as { __buzzyAudioCtx?: AudioContext }).__buzzyAudioCtx?.suspend(),
  );
  await expect.poll(() => hook(page, 'audioState')).toBe('suspended');
  await page.mouse.click(5, 300);
  await expect.poll(() => hook(page, 'audioState')).toBe('running');
});
