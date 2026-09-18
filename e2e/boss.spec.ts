import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { BOSS_SIZE, ROBOT_HP_FONT_SIZE, robotCenter } from '../game/board/layout';

// Wave-10 Boss: 2x2 occupancy (top-front lane 1 col 6) with 1000 HP. The silhouette fills
// the four cells; HP is the largest numeral.

const PLANNING_BOARD = [
  'name: e2e boss 2x2 sprite',
  'mode: run',
  'baseValue: 1',
  'board:',
  '  - "C . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
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

test('the Boss fills a 2x2 and four-digit HP stays the largest numeral', async ({
  page,
}) => {
  await load(page, PLANNING_BOARD);

  await page.evaluate(() => {
    const game = window.__GAME__!;
    const state = game.getState()!;
    game.loadState({
      ...state,
      board: {
        ...state.board,
        robots: [
          {
            robotId: 'robot:boss',
            lane: 1,
            col: 6,
            hp: 1000,
            maxHp: 1000,
            trait: { type: 'none' },
            isBoss: true,
          },
        ],
      },
    });
  });

  await page.waitForFunction(() => window.__GAME__!.getRobotChrome('robot:boss') !== null);

  const snapshot = await page.evaluate(() => {
    const game = window.__GAME__!;
    const robot = game.getState()!.board.robots.find((entry) => entry.robotId === 'robot:boss')!;
    return {
      robot,
      chrome: game.getRobotChrome('robot:boss'),
      drawn: game.renderedBoard(),
    };
  });

  expect(snapshot.robot).toMatchObject({ isBoss: true, hp: 1000, lane: 1, col: 6 });
  expect(snapshot.chrome?.hpFontSize).toBe(ROBOT_HP_FONT_SIZE);
  expect(snapshot.chrome?.trait).toBe('none');
  const drawn = snapshot.drawn.robots.find((entry) => entry.robotId === 'robot:boss');
  expect(drawn).toBeDefined();
  const home = robotCenter(1, 6, true);
  expect(Math.abs(drawn!.x - home.x)).toBeLessThan(2);
  expect(Math.abs(drawn!.y - home.y)).toBeLessThan(2);
  expect(BOSS_SIZE).toBeGreaterThan(100);

  await page.screenshot({ path: '/opt/cursor/artifacts/boss-2x2.png' });
});
