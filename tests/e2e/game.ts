import { expect, type Page } from '@playwright/test';
import type { TestApi } from '../../src/testHooks';

type Fn = keyof TestApi;

/** Call a read-only test hook in the page. */
export async function hook<K extends Fn>(
  page: Page,
  name: K,
  ...args: Parameters<TestApi[K]>
): Promise<ReturnType<TestApi[K]>> {
  return page.evaluate(
    ([n, a]) => {
      const api = (window as unknown as { __buzzy: Record<string, (...x: unknown[]) => unknown> })
        .__buzzy;
      return api[n as string]!(...(a as unknown[]));
    },
    [name, args] as const,
  ) as Promise<ReturnType<TestApi[K]>>;
}

export async function waitState(page: Page, state: string, timeout = 15_000): Promise<void> {
  await expect.poll(() => hook(page, 'state'), { timeout }).toBe(state);
}

/** Load, tap the big play button, land in the garden with the camera settled. */
export async function startGame(page: Page, query = ''): Promise<void> {
  await page.goto(`./?e2e=1${query}`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  // The play button pulses forever, so it is never 'stable': skip that actionability check.
  await page.locator('#start-btn').click({ force: true });
  await waitState(page, 'garden');
  await page.waitForTimeout(1300);
}

export async function tapBud(page: Page, id: string): Promise<void> {
  const p = await hook(page, 'budScreen', id);
  if (!p) throw new Error(`no bud ${id}`);
  await page.mouse.click(p.x, p.y);
}

type Pt = { x: number; y: number };

async function targets(page: Page): Promise<Pt[]> {
  return hook(page, 'targets');
}

/** Wait until the current mini-game exposes targets (intro finished, game built). */
export async function waitTargets(page: Page, timeout = 30_000): Promise<void> {
  await expect.poll(async () => (await targets(page)).length, { timeout }).toBeGreaterThan(0);
}

export async function drag(page: Page, path: Pt[], stepsPerSegment = 3): Promise<void> {
  const [first, ...rest] = path;
  if (!first) return;
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(p.x, p.y, { steps: stepsPerSegment });
  await page.mouse.up();
}

/** Play the current mini-game to completion using only real pointer input. */
export async function playMiniGame(page: Page, template: string): Promise<void> {
  await waitTargets(page);
  for (let guard = 0; guard < 40; guard++) {
    if ((await hook(page, 'state')) !== 'letter') return;
    const t = await targets(page);
    if (t.length === 0) {
      await page.waitForTimeout(300);
      continue;
    }
    if (template === 'pollenPop') await page.mouse.click(t[0]!.x, t[0]!.y);
    else if (template === 'traceTrail') await drag(page, t, 2);
    else await drag(page, t, 8);
    await page.waitForTimeout(template === 'basketMatch' ? 1500 : 350);
  }
}
