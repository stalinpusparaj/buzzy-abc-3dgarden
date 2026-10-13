import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { drag, hook, playMiniGame, startGame, tapBud, waitState, waitTargets } from './game';
import { watch } from './helpers';

/**
 * Trace the Trail follows each stroke's direction (brief §5.3): dragging a Tamil stroke from
 * its end back to its start, again and again, never counts; dragging it from the green start
 * dot to its end does. (The old rules let each backwards drag grab ~15-28 % of the stroke, so
 * a few of them finished it.)
 */
const lettersTa = JSON.parse(readFileSync('src/data/letters.ta.json', 'utf8')) as {
  id: string;
  template: string;
}[];
const traced = lettersTa.filter((l) => l.template === 'traceTrail').map((l) => l.id);

type P = { x: number; y: number };
const gap = (a: P | undefined, b: P | undefined): number =>
  a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;

/** Tamil garden, every intro already seen (so it can be skipped). */
async function tamil(page: Page): Promise<void> {
  await page.addInitScript(
    (seen) => {
      if (!localStorage.getItem('buzzyabc:v1')) {
        localStorage.setItem(
          'buzzyabc:v1',
          JSON.stringify({ lang: 'ta', bloomed: [], introsSeen: seen }),
        );
      }
    },
    lettersTa.map((l) => l.id),
  );
}

test('there is a Tamil letter with a trace template', () => {
  expect(traced.length).toBeGreaterThan(0);
});

for (const id of traced) {
  test(`${id}: backwards drags do nothing, a forwards trace finishes the letter`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const w = watch(page);
    await tamil(page);
    await startGame(page);
    await tapBud(page, id);
    await waitState(page, 'letter');
    await page
      .locator('#btn-skip')
      .click({ force: true, timeout: 5_000 })
      .catch(() => {});
    await waitTargets(page);
    await page.waitForTimeout(1_500); // camera settles on the plot
    const first = await hook(page, 'targets');
    expect(first.length).toBeGreaterThan(1);

    // End → start along the current stroke, eight times over.
    for (let k = 0; k < 8; k++) {
      await drag(page, [...first].reverse(), 2);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);
    expect(await hook(page, 'state')).toBe('letter');
    const after = await hook(page, 'targets');
    // Still the same stroke: its start and end are where they were.
    expect(after).toHaveLength(first.length);
    expect(gap(after[0], first[0])).toBeLessThan(20);
    expect(gap(after.at(-1), first.at(-1))).toBeLessThan(20);

    // Start → end, stroke by stroke: the letter is done and blooms.
    await playMiniGame(page, 'traceTrail');
    await waitState(page, 'garden', 20_000);
    expect(await hook(page, 'bloomed')).toContain(id);
    expect(w.errors).toEqual([]);
  });
}
