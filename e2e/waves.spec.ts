import { expect, test, type Page } from '@playwright/test';
import { MIN_TOUCH_TARGET } from '../game/state/designSpace';

// Task 16: the wave-cleared overlay and the win/lose screens. Now that task 14 is merged, the
// won/lost screens are reached through the real flow — End Turn → skipAnimation() finishes
// playback, and `finishPlayback` (task 14 req. 2) switches `screen` to `won`/`lost` and clears
// the save by itself; no `setScreen` needed. Asserts on structured state (TR §14); screenshots
// are for the human legibility check only (not committed).

// A run one exact kill from clearing wave 1 of the real shipped `waves.json` (reward
// add:1/add:2/add:3, not the final wave) — the cannon's base value 5 exactly matches the robot's
// HP for an exact kill.
const NON_FINAL_WAVE_CLEAR = [
  'name: e2e wave cleared',
  'mode: run',
  'baseValue: 5',
  'board:',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - "C R5 . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
].join('\n');

// Wave 3 (index 2) is the last of the 3 shipped M2 waves — clearing it wins the run instead of
// granting a reward.
const FINAL_WAVE_WIN = [
  'name: e2e final wave win',
  'mode: run',
  'baseValue: 5',
  'waveIndex: 2',
  'board:',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - "C R5 . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
].join('\n');

// One lane's cannon exact-kills its robot (lane 0) while a second lane's robot (already on col 1,
// no cannon needed) detonates the same turn for more damage than the base has (GDD §4.1: the loss
// check wins over a same-turn clear either way).
const LOSE = [
  'name: e2e lose',
  'mode: run',
  'baseValue: 5',
  'baseHp: 3',
  'board:',
  '  - "C R5 . . . . . ."',
  '  - ". R8 . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
].join('\n');

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState()!);
const getScreen = (page: Page) => page.evaluate(() => window.__GAME__!.getScreen());

async function loadScenario(page: Page, yamlText: string) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yamlText);
}

async function endTurnAndSkip(page: Page) {
  const result = await page.evaluate(() => window.__GAME__!.dispatch({ type: 'endTurn' }));
  expect(result).toEqual({ ok: true });
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await page.waitForFunction(() => window.__GAME__!.isIdle());
}

async function expectTouchTarget(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

test('wave-cleared overlay shows the reward tiles; ▶ starts the next wave', async ({
  page,
}, testInfo) => {
  await loadScenario(page, NON_FINAL_WAVE_CLEAR);
  await endTurnAndSkip(page);

  const state = await getState(page);
  expect(state.phase).toBe('waveCleared');
  const granted = state.lastTurnEvents.find((event) => event.type === 'TilesGranted');
  expect(granted?.tiles).toEqual([
    { pieceId: expect.any(String), tileId: 'add:1' },
    { pieceId: expect.any(String), tileId: 'add:2' },
    { pieceId: expect.any(String), tileId: 'add:3' },
  ]);

  await expect(page.getByTestId('wave-cleared')).toBeVisible();
  await expect(page.getByTestId('reward-tile')).toHaveCount(granted!.tiles.length);
  await page.waitForTimeout(700); // let the staggered pop-ins finish
  await page.screenshot({ path: testInfo.outputPath('wave-cleared.png') });
  await expectTouchTarget(page, 'wave-next');

  // ▶ starts the next wave and the overlay hides itself (the double-tap guard itself — a second
  // `nextWave` refused as `wrong_phase` once the overlay is gone — is `continueToNextWave`'s own
  // unit test, tests/game/waveFlow.test.ts, since the button is no longer there to tap twice).
  await page.getByTestId('wave-next').click();

  const next = await getState(page);
  expect(next.phase).toBe('planning');
  expect(next.waveIndex).toBe(1);
  await expect(page.getByTestId('wave-cleared')).toHaveCount(0);
});

test('reloading while the wave-cleared overlay is up resumes into it, rewards intact (task 14+16 integration)', async ({
  page,
}) => {
  await loadScenario(page, NON_FINAL_WAVE_CLEAR);
  await endTurnAndSkip(page);

  const state = await getState(page);
  expect(state.phase).toBe('waveCleared');
  const granted = state.lastTurnEvents.find((event) => event.type === 'TilesGranted');
  await expect(page.getByTestId('wave-cleared')).toBeVisible();
  await expect(page.getByTestId('reward-tile')).toHaveCount(granted!.tiles.length);

  // The `endTurn` dispatch above (unlike `loadScenario`) persists — it resolved to `mode: 'run'`
  // (task 14 req. 1) — so the saved run is this `waveCleared` state, `lastTurnEvents` included
  // (task 16 req. 1: reward tiles must still show after resume).
  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toBeVisible();

  await page.getByTestId('menu-continue').click();
  expect(await getScreen(page)).toBe('game');
  expect((await getState(page))?.phase).toBe('waveCleared');
  await expect(page.getByTestId('wave-cleared')).toBeVisible();
  await expect(page.getByTestId('reward-tile')).toHaveCount(granted!.tiles.length);

  await page.getByTestId('wave-next').click();
  const next = await getState(page);
  expect(next.phase).toBe('planning');
  expect(next.waveIndex).toBe(1);
  await expect(page.getByTestId('wave-cleared')).toHaveCount(0);
});

test('the final wave clear wins the run; ▶ returns to the menu', async ({ page }, testInfo) => {
  await loadScenario(page, FINAL_WAVE_WIN);
  await endTurnAndSkip(page);

  const state = await getState(page);
  expect(state.phase).toBe('won');
  expect(state.exactKills).toBe(1);

  // `finishPlayback` (task 14 req. 2) already switched `screen` to 'won' the instant
  // `skipAnimation()` finished the last beat — no `setScreen` needed.
  expect(await getScreen(page)).toBe('won');
  await expect(page.getByTestId('won')).toBeVisible();
  await expect(page.getByTestId('exact-kill-count')).toHaveText(String(state.exactKills));
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath('won.png') });
  await expectTouchTarget(page, 'won-menu');

  await page.getByTestId('won-menu').click();
  expect(await getScreen(page)).toBe('menu');
  // A won run is cleared (task 14 req. 2): the menu offers no Continue.
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});

test('a lost run shows the cheerful lose screen; ▶ returns to the menu', async ({
  page,
}, testInfo) => {
  await loadScenario(page, LOSE);
  await endTurnAndSkip(page);

  const state = await getState(page);
  expect(state.phase).toBe('lost');
  expect(state.exactKills).toBe(1);

  // `finishPlayback` (task 14 req. 2) already switched `screen` to 'lost' the instant
  // `skipAnimation()` finished the last beat — no `setScreen` needed.
  expect(await getScreen(page)).toBe('lost');
  await expect(page.getByTestId('lost')).toBeVisible();
  await expect(page.getByTestId('exact-kill-count')).toHaveText(String(state.exactKills));
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath('lost.png') });
  await expectTouchTarget(page, 'lost-menu');

  // GDD §10.1: loss returns to the menu with no other options.
  await expect(page.getByTestId('lost').getByRole('button')).toHaveCount(1);

  await page.getByTestId('lost-menu').click();
  expect(await getScreen(page)).toBe('menu');
  // A lost run is cleared (task 14 req. 2): the menu offers no Continue.
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});
