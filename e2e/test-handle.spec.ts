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
