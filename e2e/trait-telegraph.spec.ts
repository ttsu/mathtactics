import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { ROBOT_HP_FONT_SIZE, WEAKNESS_N_FONT_SIZE } from '../game/board/layout';
import presentation from '../data/presentation.json' with { type: 'json' };

// Task 23: planning-phase trait telegraph. Install a board with one robot of each trait via
// loadScenario (no wave play) and assert live chrome through getRobotChrome, plus that HP views
// are still on the board.

const TRAIT_BOARD = [
  'name: e2e trait telegraph',
  'mode: run',
  'baseValue: 1',
  'board:',
  '  - ". R20 . . . . . ."',
  '  - ". R20:w5 . . . . . ."',
  '  - ". R20:bb . . . . . ."',
  '  - ". R20:odd . . . . . ."',
  '  - ". R20:even . . . . . ."',
].join('\n');

async function load(page: Page, yaml: string) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yaml);
  await expect(page.getByTestId('hud-bar')).toBeVisible();
}

test.beforeAll(async () => {
  await mkdir('/opt/cursor/artifacts', { recursive: true });
});

test('getRobotChrome telegraphs each trait and HP stays on the board', async ({ page }) => {
  await load(page, TRAIT_BOARD);

  await page.waitForFunction(() => {
    const game = window.__GAME__;
    const robots = game?.getState()?.board.robots ?? [];
    return (
      robots.length === 5 && robots.every((robot) => game!.getRobotChrome(robot.robotId) !== null)
    );
  });

  const snapshot = await page.evaluate(() => {
    const game = window.__GAME__!;
    const robots = game.getState()!.board.robots;
    return {
      robots: robots.map((robot) => ({
        robotId: robot.robotId,
        trait: robot.trait,
        chrome: game.getRobotChrome(robot.robotId),
      })),
      board: game.renderedBoard(),
    };
  });

  expect(snapshot.board.robots).toHaveLength(5);
  expect(snapshot.board.robots.map((robot) => robot.robotId).sort()).toEqual(
    snapshot.robots.map((robot) => robot.robotId).sort(),
  );

  const { traits } = presentation;
  const byType = Object.fromEntries(
    snapshot.robots.map((robot) => [robot.trait.type, robot]),
  ) as Record<string, (typeof snapshot.robots)[number]>;

  expect(byType.none?.chrome).toEqual({
    trait: 'none',
    n: null,
    pairCount: 1,
    coiled: false,
    shieldColor: null,
    hpFontSize: ROBOT_HP_FONT_SIZE,
  });
  expect(byType.weakness?.chrome).toEqual({
    trait: 'weakness',
    n: 5,
    pairCount: 1,
    coiled: false,
    shieldColor: null,
    hpFontSize: ROBOT_HP_FONT_SIZE,
  });
  expect(byType.bounceBack?.chrome).toEqual({
    trait: 'bounceBack',
    n: null,
    pairCount: 1,
    coiled: true,
    shieldColor: null,
    hpFontSize: ROBOT_HP_FONT_SIZE,
  });
  expect(byType.oddOnly?.chrome).toEqual({
    trait: 'oddOnly',
    n: null,
    pairCount: 2,
    coiled: false,
    shieldColor: traits.oddShieldColor,
    hpFontSize: ROBOT_HP_FONT_SIZE,
  });
  expect(byType.evenOnly?.chrome).toEqual({
    trait: 'evenOnly',
    n: null,
    pairCount: 1,
    coiled: false,
    shieldColor: traits.evenShieldColor,
    hpFontSize: ROBOT_HP_FONT_SIZE,
  });

  expect(byType.weakness?.chrome?.hpFontSize).toBeGreaterThan(WEAKNESS_N_FONT_SIZE);

  await page.waitForFunction(() => window.__GAME__!.isIdle());
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

  await page.screenshot({
    path: '/opt/cursor/artifacts/23-trait-telegraph.png',
    fullPage: true,
  });
  await page.screenshot({
    path: '/opt/cursor/artifacts/special-bots-traits.png',
    fullPage: true,
  });
  await page.screenshot({
    path: '/tmp/m4-23/23-trait-telegraph.png',
    fullPage: true,
  });
});
