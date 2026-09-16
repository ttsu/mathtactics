import { expect, test, type Page } from '@playwright/test';
import type { Lane } from '../sim/core/coords';

// Task 17 requirement 3: a full run through the real menus and screens (menu → New Run (real
// button) → waves 1–3 → win screen → menu), driving planning turns with `dispatch` (moving the
// cannon to the front-most robot's lane, no tiles) and `skipAnimation` — plus a reload in the
// middle of wave 2 that resumes via ▶ Continue and finishes the run. Asserts on structured state
// (TR §14); screenshots are for the human legibility check only.
//
// The real New Run button seeds the run randomly (`runFlow.ts`), so this can't pin a seed —
// `MAX_TURNS` is generous headroom over the shipped ladder's measured worst case (task 17
// Completion Notes: a cannon-follows-the-front-robot, no-tiles bot never needs more than 36 End
// Turns for a full 3-wave run across seeds 1–100).
const MAX_TURNS = 80;

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState());
const getScreen = (page: Page) => page.evaluate(() => window.__GAME__!.getScreen());
const waitIdle = (page: Page) =>
  page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });

/** One planning-phase turn: move the cannon (via `dispatch`) to the front-most on-board robot's
 * lane if it isn't already there, fire (End Turn), then skip playback. No tiles are ever placed. */
async function playOneTurn(page: Page) {
  await page.evaluate(() => {
    const game = window.__GAME__!;
    const state = game.getState()!;
    const onBoard = state.board.robots.filter((robot) => robot.col !== null);
    if (onBoard.length > 0) {
      onBoard.sort((a, b) => a.col! - b.col! || a.lane - b.lane);
      const targetLane = onBoard[0]!.lane;
      const currentLane = state.board.cannons.findIndex(Boolean) as Lane;
      if (targetLane !== currentLane) {
        game.dispatch({ type: 'moveCannon', fromLane: currentLane, toLane: targetLane });
      }
    }
    game.dispatch({ type: 'endTurn' });
  });
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await waitIdle(page);
}

test('a full run plays through the real menus and screens: New Run -> waves 1-3 -> win -> menu', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();

  await page.getByTestId('menu-new-run').click();
  expect(await getScreen(page)).toBe('game');
  await waitIdle(page);

  let turns = 0;
  while ((await getScreen(page)) !== 'won') {
    expect(turns, 'ran out of turns before the run won').toBeLessThan(MAX_TURNS);
    turns++;

    const state = await getState(page);
    if (state?.phase === 'waveCleared') {
      await expect(page.getByTestId('wave-cleared')).toBeVisible();
      await page.getByTestId('wave-next').click();
      continue;
    }
    expect(state?.phase).toBe('planning');
    await playOneTurn(page);
  }

  const finalState = await getState(page);
  expect(finalState?.phase).toBe('won');
  // The win screen itself is proof every wave was played (only the last wave's clear wins);
  // `waveIndex` also stayed at the wave that won, 0-based.
  expect(finalState?.waveIndex).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('won')).toBeVisible();
  await page.waitForTimeout(700); // let the staggered pop-ins finish
  await page.screenshot({ path: testInfo.outputPath('run-won.png') });

  await page.getByTestId('won-menu').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});

test('reloading mid wave 2 resumes via Continue and the run completes', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.getByTestId('menu-new-run').click();
  await waitIdle(page);

  let turns = 0;
  // Play until wave 2 (index 1) is reached and at least one of its turns has resolved, so the
  // reload lands mid-wave rather than at its very first planning phase.
  while (true) {
    expect(turns, 'ran out of turns before reaching wave 2').toBeLessThan(MAX_TURNS);
    const state = await getState(page);
    if (state?.waveIndex === 1 && state.phase === 'planning' && state.turn > 1) break;

    if (state?.phase === 'waveCleared') {
      await page.getByTestId('wave-next').click();
    } else {
      await playOneTurn(page);
      turns++;
    }
  }

  const beforeReload = await getState(page);
  expect(beforeReload?.waveIndex).toBe(1);

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toBeVisible();

  await page.getByTestId('menu-continue').click();
  expect(await getScreen(page)).toBe('game');
  expect(await getState(page)).toEqual(beforeReload);
  await waitIdle(page);

  // Finish the run from here.
  while ((await getScreen(page)) !== 'won') {
    expect(turns, 'ran out of turns before the run won').toBeLessThan(MAX_TURNS);
    turns++;
    const state = await getState(page);
    if (state?.phase === 'waveCleared') {
      await page.getByTestId('wave-next').click();
      continue;
    }
    await playOneTurn(page);
  }

  expect((await getState(page))?.phase).toBe('won');
  await expect(page.getByTestId('won')).toBeVisible();
  await page.getByTestId('won-menu').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});
