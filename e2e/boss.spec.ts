import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { ROBOT_HP_FONT_SIZE, cellCenter } from '../game/board/layout';

// Task 26: put the wave-10 Boss on the board through `syncRobots` (`loadState` with `isBoss`)
// so the oversized silhouette is visible without a FIRE-then-SPAWN turn. Occupies col 6 so
// overflow into neighbouring cells is obvious; cannon slot (col 0) stays clear.

const PLANNING_BOARD = [
  'name: e2e boss overflow sprite',
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

test('the Boss overflows the cell and three-digit HP stays the largest numeral', async ({
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
            lane: 2,
            col: 6,
            hp: 120,
            maxHp: 150,
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

  expect(snapshot.robot).toMatchObject({ isBoss: true, hp: 120, lane: 2, col: 6 });
  expect(snapshot.chrome?.hpFontSize).toBe(ROBOT_HP_FONT_SIZE);
  expect(snapshot.chrome?.trait).toBe('none');
  const drawn = snapshot.drawn.robots.find((entry) => entry.robotId === 'robot:boss');
  expect(drawn).toBeDefined();
  const home = cellCenter(2, 6);
  expect(Math.abs(drawn!.x - home.x)).toBeLessThan(2);
  expect(Math.abs(drawn!.y - home.y)).toBeLessThan(2);

  await page.screenshot({ path: '/opt/cursor/artifacts/26-boss.png' });
});
