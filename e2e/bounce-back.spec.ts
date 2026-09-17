import { expect, test, type Page } from '@playwright/test';

// Bounce-back overshoot presentation (GDD §6.2 v0.7.1): HP drains to 0, then the remainder
// refills with green pluses. Video is on so the drain-then-pluses beat can be reviewed.

test.use({
  video: { mode: 'on', size: { width: 1180, height: 820 } },
});

const BOUNCE_BACK_OVERSHOOT = [
  'name: e2e bounce-back overshoot refill',
  'baseValue: 10',
  'board:',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - "C +3 R10:bb . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
].join('\n');

async function load(page: Page, yaml: string) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yaml);
}

test('bounce-back overshoot keeps the robot and lands on the remainder HP', async ({ page }) => {
  await load(page, BOUNCE_BACK_OVERSHOOT);
  const events = await page.evaluate(() => window.__GAME__!.endTurn());
  expect(events.some((event) => event.type === 'RobotBouncedBack')).toBe(true);

  await page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });

  const snapshot = await page.evaluate(() => {
    const game = window.__GAME__!;
    const robot = game.getState()!.board.robots[0]!;
    return {
      hp: robot.hp,
      chrome: game.getRobotChrome(robot.robotId),
      drawn: game.renderedBoard().robots.length,
    };
  });
  expect(snapshot.hp).toBe(3);
  expect(snapshot.drawn).toBe(1);
  expect(snapshot.chrome).toMatchObject({ trait: 'bounceBack', coiled: true });
});
