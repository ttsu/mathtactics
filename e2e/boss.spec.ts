import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { ROBOT_HP_FONT_SIZE } from '../game/board/layout';

// Task 26: spawn the wave-10 Boss via the robots.json template (board grammar has no
// `:boss` suffix) and screenshot the oversized silhouette. Cannon sits in another lane
// so FIRE-then-SPAWN brings it on without hitting it.

const BOSS_SPAWN = [
  'name: e2e boss overflow sprite',
  'mode: run',
  'baseValue: 1',
  'board:',
  '  - "C . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  'pendingSpawns:',
  '  - { turn: 1, lane: 2, hp: 120, robot: boss }',
  'waves:',
  '  - id: wave-boss',
  '    spawns:',
  '      - { turn: 1, lane: 2, robot: boss, hp: [120, 120] }',
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

test('the Boss overflows the cell and three-digit HP stays the largest numeral', async ({
  page,
}) => {
  await load(page, BOSS_SPAWN);

  await page.evaluate(() => window.__GAME__!.endTurn());
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await page.waitForFunction(() => window.__GAME__!.isIdle());

  const snapshot = await page.evaluate(() => {
    const game = window.__GAME__!;
    const robots = game.getState()!.board.robots;
    return robots.map((robot) => ({
      robotId: robot.robotId,
      isBoss: robot.isBoss,
      hp: robot.hp,
      lane: robot.lane,
      col: robot.col,
      chrome: game.getRobotChrome(robot.robotId),
    }));
  });

  const boss = snapshot.find((robot) => robot.isBoss);
  expect(boss).toBeDefined();
  expect(boss?.hp).toBe(120);
  expect(boss?.lane).toBe(2);
  expect(boss?.col).toBe(7);
  expect(boss?.chrome?.hpFontSize).toBe(ROBOT_HP_FONT_SIZE);
  expect(boss?.chrome?.trait).toBe('none');

  await page.screenshot({ path: '/opt/cursor/artifacts/26-boss.png' });
});
