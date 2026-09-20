import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Command } from '../sim/core/types';
import { parseScenario } from '../sim/scenario/parse';

// Task 11: the FIRE-only boards remain solvable through the test handle. The player-facing
// Puzzles button is the puzzle book (task 32 / e2e/puzzles.spec.ts).

const LEVELS_DIR = resolve('scenarios/levels');
const SOLUTIONS = readdirSync(LEVELS_DIR)
  .filter((file) => file.endsWith('.scenario.yaml'))
  .sort()
  .map((file) => {
    const scenario = parseScenario(readFileSync(resolve(LEVELS_DIR, file), 'utf8'));
    return { levelId: scenario.level!, commands: scenario.commands };
  });

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState()!);

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
    await page.evaluate(
      (id) => window.__GAME__!.loadScenario(`name: t\nlevel: ${id}`),
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

test('FIRE-only levels still clear through continueToNextLevel', async ({ page }) => {
  await openMenu(page);
  await page.evaluate(() => window.__GAME__!.loadScenario('name: t\nlevel: level-1'));
  await page.getByTestId('end-turn').click();
  await page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });
  await expect(page.getByTestId('level-cleared')).toBeVisible();
});
