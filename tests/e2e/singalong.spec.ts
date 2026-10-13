import { expect, test } from '@playwright/test';
import { hook, startGame, waitState } from './game';
import { watch } from './helpers';

test('sing-along: every cue fires within 50 ms of its timestamp, then returns home', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const w = watch(page);
  await startGame(page);
  const g = await hook(page, 'gazeboScreen');
  await page.mouse.click(g.x, g.y);
  await waitState(page, 'sing');
  await expect.poll(async () => (await hook(page, 'cueLog')).length, { timeout: 60_000 }).toBe(6);
  expect(await hook(page, 'songDuration')).toBeGreaterThan(20); // the real (dummy) song decoded
  const log = await hook(page, 'cueLog');
  for (const c of log) {
    expect(Math.abs(c.actual - c.expected), `${c.id} drift`).toBeLessThanOrEqual(0.05);
  }
  console.log(
    'cue drift (ms):',
    log.map((c) => `${c.id}:${Math.round((c.actual - c.expected) * 1000)}`).join(' '),
  );
  await waitState(page, 'garden', 30_000);
  expect(w.errors).toEqual([]);
});
