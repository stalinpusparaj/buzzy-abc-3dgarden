import { expect, test } from '@playwright/test';
import { thirdParty, watch } from './helpers';

test('boots under a subpath with no console errors and only same-origin requests', async ({
  page,
  baseURL,
}) => {
  const w = watch(page);
  await page.goto('./');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForTimeout(500);
  expect(w.errors).toEqual([]);
  expect(thirdParty(w, new URL(baseURL ?? '').origin)).toEqual([]);
});
