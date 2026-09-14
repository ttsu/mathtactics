import { expect, test } from '@playwright/test';

// TR §14, GDD §15.2, task 05 req./acceptance: window.__GAME__ exists in the preview
// (VITE_TEST_HANDLE=1) build and getDisplay() reflects the starting economy (base HP 100).

test('window.__GAME__ exists and getDisplay() returns base HP 100', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();

  const hasHandle = await page.evaluate(() => typeof window.__GAME__ !== 'undefined');
  expect(hasHandle).toBe(true);

  const display = await page.evaluate(() => window.__GAME__!.getDisplay());
  expect(display).toEqual({ coins: 0, baseHp: 100, waveIndex: 0 });

  const state = await page.evaluate(() => window.__GAME__!.getState());
  expect(state).toBeNull();

  const screen = await page.evaluate(() => window.__GAME__!.getScreen());
  expect(screen).toBe('game');

  const dispatchResult = await page.evaluate(() => window.__GAME__!.dispatch({ type: 'endTurn' }));
  expect(dispatchResult).toEqual({ ok: false, error: 'wrong_phase' });

  // No run exists yet (state is null), so the underlying dispatch fails with `wrong_phase` and
  // `endTurn()` returns `[]` rather than throwing (task 07 ruling).
  const endTurnEvents = await page.evaluate(() => window.__GAME__!.endTurn());
  expect(endTurnEvents).toEqual([]);
});

// Task 08: `loadScenario` parses + builds + installs a scenario's initial state, same as
// `loadState` but starting from scenario YAML text instead of a ready-made `RunState`.
test('window.__GAME__.loadScenario installs the scenario’s initial state', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();

  const yamlText = [
    'name: e2e scenario',
    'baseValue: 1',
    'board:',
    '  - "C . . . . . . ."',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . R5"',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . ."',
  ].join('\n');

  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yamlText);

  const state = await page.evaluate(() => window.__GAME__!.getState());
  expect(state?.phase).toBe('planning');
  expect(state?.levelId).toBe('scenario:e2e-scenario');
  expect(state?.board.cannons).toEqual([true, false, false, false, false]);
  expect(state?.board.robots).toHaveLength(1);
  expect(state?.board.robots[0]).toMatchObject({ lane: 2, col: 7, hp: 5, maxHp: 5 });
});
