import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Command } from '../sim/core/types';
import { parseScenario } from '../sim/scenario/parse';
import { MIN_TOUCH_TARGET } from '../game/state/designSpace';

// Task 11: the puzzle levels and the level flow. Req. 4 — every shipped level is solved through
// the test handle with the known solution from its `/scenarios/levels` file — plus a
// menu → play → clear → next → all done click-through. Asserts on structured state (TR §14);
// screenshots are for the human legibility check only.

const LEVELS_DIR = resolve('scenarios/levels');
const SOLUTIONS = readdirSync(LEVELS_DIR)
  .filter((file) => file.endsWith('.scenario.yaml'))
  .sort()
  .map((file) => {
    const scenario = parseScenario(readFileSync(resolve(LEVELS_DIR, file), 'utf8'));
    return { levelId: scenario.level!, commands: scenario.commands };
  });

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState()!);
const getScreen = (page: Page) => page.evaluate(() => window.__GAME__!.getScreen());

async function openMenu(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();
}

/** Dispatches each command; every End Turn's playback is skipped before the next command. */
async function applySolution(page: Page, commands: Command[]) {
  for (const command of commands) {
    const result = await page.evaluate((cmd) => window.__GAME__!.dispatch(cmd), command);
    expect(result, JSON.stringify(command)).toEqual({ ok: true });
    if (command.type === 'endTurn') {
      await page.evaluate(() => window.__GAME__!.skipAnimation());
    }
  }
}

async function expectTouchTarget(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

test('there is a solution file for 8 levels', () => {
  expect(SOLUTIONS.map((solution) => solution.levelId)).toEqual([
    'level-1',
    'level-2',
    'level-3',
    'level-4',
    'level-5',
    'level-6',
    'level-7',
    'level-8',
  ]);
});

for (const { levelId, commands } of SOLUTIONS) {
  test(`${levelId} is solved through the test handle`, async ({ page }) => {
    await openMenu(page);
    await page.getByTestId('menu-puzzles').click();

    await page.evaluate(
      (id) => window.__GAME__!.dispatch({ type: 'loadLevel', levelId: id }),
      levelId,
    );
    await applySolution(page, commands);

    const state = await getState(page);
    expect(state.phase).toBe('levelCleared');
    expect(state.levelId).toBe(levelId);
    expect(
      state.lastTurnEvents
        .filter((event) => event.type === 'RobotDefeated')
        .every((event) => event.exact),
    ).toBe(true);
    await expect(page.getByTestId('level-cleared')).toBeVisible();
  });
}

test('menu → play → clear → next, and after the last level → all done → play again', async ({
  page,
}, testInfo) => {
  await openMenu(page);
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('hud-bar')).toHaveCount(0);
  await page.waitForTimeout(600); // let the pop-in finish (it scales the button)
  await page.screenshot({ path: testInfo.outputPath('menu.png') });
  await expectTouchTarget(page, 'menu-puzzles');

  // ▶ Play → level 1 on the board, level dots in the HUD, no base HP.
  await page.getByTestId('menu-puzzles').click();
  expect(await getScreen(page)).toBe('game');
  expect((await getState(page)).levelId).toBe('level-1');
  const hud = page.getByTestId('hud-bar');
  await expect(hud.getByTestId('level-dots')).toHaveAttribute('data-level-index', '0');
  await expect(hud).not.toContainText('♥');
  await expect(hud).not.toContainText('Wave');
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('level-1.png') });

  // Level 1: just tap End Turn. The overlay waits for the kill to finish playing.
  await page.getByTestId('end-turn').click();
  expect((await getState(page)).phase).toBe('levelCleared');
  expect(await page.evaluate(() => window.__GAME__!.isIdle())).toBe(false);
  await expect(page.getByTestId('level-cleared')).toHaveCount(0);
  await page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });
  await expect(page.getByTestId('level-cleared')).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath('level-cleared.png') });
  await expectTouchTarget(page, 'level-next');

  // ▶ Next → level 2.
  await page.getByTestId('level-next').click();
  await expect(page.getByTestId('level-cleared')).toHaveCount(0);
  expect((await getState(page)).levelId).toBe('level-2');
  expect((await getState(page)).phase).toBe('planning');
  await expect(hud.getByTestId('level-dots')).toHaveAttribute('data-level-index', '1');

  // Jump to the last level, solve it, ▶ Next → all done.
  const last = SOLUTIONS.at(-1)!;
  await page.evaluate(
    (id) => window.__GAME__!.dispatch({ type: 'loadLevel', levelId: id }),
    last.levelId,
  );
  await applySolution(page, last.commands);
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath('level-8-cleared.png') });
  await page.getByTestId('level-next').click();
  expect(await getScreen(page)).toBe('allDone');
  await expect(page.getByTestId('all-done')).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath('all-done.png') });
  await expectTouchTarget(page, 'all-done-play-again');

  // ▶ Play again → level 1.
  await page.getByTestId('all-done-play-again').click();
  expect(await getScreen(page)).toBe('game');
  expect((await getState(page)).levelId).toBe('level-1');
  expect((await getState(page)).phase).toBe('planning');
});
