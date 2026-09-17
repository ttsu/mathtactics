import { expect, test, type Page } from '@playwright/test';

// Parity block presentation: even ball vs Odd-only. The shield (not the robot body) takes
// the clonk. Video is on so the shield-only shake can be reviewed.

test.use({
  video: { mode: 'on', size: { width: 1180, height: 820 } },
});

const ODD_BLOCK = [
  'name: e2e odd-only block',
  'baseValue: 2',
  'board:',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - "C R5:odd . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
].join('\n');

async function load(page: Page, yaml: string) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yaml);
}

test('an even ball is blocked and the Odd-only robot keeps its HP', async ({ page }) => {
  await load(page, ODD_BLOCK);
  const events = await page.evaluate(() => window.__GAME__!.endTurn());
  expect(events.some((event) => event.type === 'BallBlocked')).toBe(true);

  await page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });

  const snapshot = await page.evaluate(() => {
    const game = window.__GAME__!;
    const robot = game.getState()!.board.robots[0]!;
    return {
      hp: robot.hp,
      chrome: game.getRobotChrome(robot.robotId),
    };
  });
  expect(snapshot.hp).toBe(5);
  expect(snapshot.chrome).toMatchObject({ trait: 'oddOnly', pairCount: 2 });
});
