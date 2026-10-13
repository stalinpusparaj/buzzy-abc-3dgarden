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
