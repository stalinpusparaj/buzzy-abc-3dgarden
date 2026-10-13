import { expect, test } from '@playwright/test';
import { hook, startGame, tapBud, waitState } from './game';
import { watch } from './helpers';

test('tap a bud: Buzzy flies, camera tweens, letter scene, home returns', async ({ page }) => {
  const w = watch(page);
  await startGame(page);
  await tapBud(page, 'A');
  await waitState(page, 'letter');
  await page.waitForTimeout(1500);
  await expect(page.locator('#btn-home')).toBeVisible();
  await page.locator('#btn-home').click();
  await waitState(page, 'garden');
  expect(w.errors).toEqual([]);
});

test('no GPU leaks after 20 round trips', async ({ page }) => {
  test.setTimeout(240_000);
  await startGame(page);
  const trip = async (): Promise<void> => {
    await tapBud(page, 'C');
    await waitState(page, 'letter');
    await page.waitForTimeout(2200);
    await page.locator('#btn-home').click();
    await waitState(page, 'garden');
    await page.waitForTimeout(1300);
  };
  await trip();
  const first = await hook(page, 'info');
  for (let i = 0; i < 19; i++) await trip();
  const last = await hook(page, 'info');
  expect(last.geometries).toBe(first.geometries);
  expect(last.textures).toBe(first.textures);
});

test('tappable buds are ≥ 64 CSS px on a small landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await startGame(page);
  const targets = await hook(page, 'tapTargets');
  expect(targets).toHaveLength(6);
  for (const t of targets) {
    expect(Math.max(t.visualW, t.visualH), `${t.id} visual`).toBeGreaterThanOrEqual(64);
    expect(t.collider, `${t.id} collider`).toBeGreaterThanOrEqual(96);
  }
});

test('holds ≥ 30 fps at 4x CPU throttle', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await startGame(page);
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const e = gl?.getExtension('WEBGL_debug_renderer_info');
    return e && gl ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : '';
  });
  test.skip(/SwiftShader/i.test(gpu), 'software GPU: fps is not meaningful');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await tapBud(page, 'B');
  await page.waitForTimeout(2500);
  await page.locator('#btn-home').click();
  await page.waitForTimeout(2500);
  const fps = await hook(page, 'fps');
  console.log(`fps at 4x CPU throttle: ${fps.toFixed(1)} (tier ${await hook(page, 'tier')})`);
  expect(fps).toBeGreaterThanOrEqual(30);
});
