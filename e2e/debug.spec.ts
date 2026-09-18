import { expect, test, type Page } from '@playwright/test';

async function openMenu(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();
}

async function tapTitle(page: Page, times: number) {
  const title = page.getByTestId('menu-title');
  for (let i = 0; i < times; i++) {
    await title.tap();
  }
}

/** Fires `pointerdown` in one turn so Playwright's per-tap actionability wait cannot
 * stretch the burst past the 7-tap window (and so a leftover tap cannot land on the overlay). */
async function burstTitle(page: Page, times: number) {
  await page.getByTestId('menu-title').evaluate((el, count) => {
    for (let i = 0; i < count; i++) {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    }
  }, times);
}

test('one tap on the title does not open the debug menu', async ({ page }) => {
  await openMenu(page);
  await tapTitle(page, 1);
  await expect(page.getByTestId('debug-menu')).toHaveCount(0);
});

test('7-tap the title opens the debug menu', async ({ page }) => {
  await openMenu(page);
  await burstTitle(page, 7);
  await expect(page.getByTestId('debug-menu')).toBeVisible();
  await expect(page.getByTestId('debug-panel-jump')).toBeVisible();
});

test('Ctrl+Shift+D toggles the debug menu', async ({ page }) => {
  await openMenu(page);
  await page.keyboard.press('Control+Shift+D');
  await expect(page.getByTestId('debug-menu')).toBeVisible();
  await page.keyboard.press('Control+Shift+D');
  await expect(page.getByTestId('debug-menu')).toHaveCount(0);
});

test('?debug=1 opens the menu on load', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('debug-menu')).toBeVisible();
});

test('Jump to a puzzle, add a tile, add an enemy, copy a snapshot', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('debug-menu')).toBeVisible();

  await page.getByTestId('debug-level-level-3').tap();
  await page.waitForFunction(() => window.__GAME__!.getState()?.levelId === 'level-3');
  expect(await page.evaluate(() => window.__GAME__!.getState()?.mode)).toBe('level');
  expect(await page.evaluate(() => window.__GAME__!.getScreen())).toBe('game');

  await page.getByTestId('debug-tab-tiles').tap();
  await expect(page.getByTestId('debug-panel-tiles')).toBeVisible();
  const trayBefore = await page.evaluate(() => window.__GAME__!.getState()!.tray.length);
  await page.getByTestId('debug-tile-add:5').tap();
  await page.waitForFunction(
    (before) => (window.__GAME__!.getState()?.tray.length ?? 0) > before,
    trayBefore,
  );
  const addedTile = await page.evaluate(() => {
    const state = window.__GAME__!.getState()!;
    const pieceId = state.tray[state.tray.length - 1]!;
    return state.pieces[pieceId]?.tileId;
  });
  expect(addedTile).toBe('add:5');

  await page.getByTestId('debug-tab-enemies').tap();
  await expect(page.getByTestId('debug-panel-enemies')).toBeVisible();
  await page.getByTestId('debug-robot-bounce-back').tap();
  await page.getByTestId('debug-lane-0').tap();
  await page.getByTestId('debug-hp-20').tap();
  const robotsBefore = await page.evaluate(() => window.__GAME__!.getState()!.board.robots.length);
  await page.getByTestId('debug-add-enemy').tap();
  await page.waitForFunction(
    (before) => (window.__GAME__!.getState()?.board.robots.length ?? 0) > before,
    robotsBefore,
  );
  const spawned = await page.evaluate(() => {
    const robots = window.__GAME__!.getState()!.board.robots;
    return robots[robots.length - 1];
  });
  expect(spawned).toMatchObject({
    lane: 0,
    col: 7,
    hp: 20,
    trait: { type: 'bounceBack' },
  });

  await page.getByTestId('debug-tab-snapshot').tap();
  await expect(page.getByTestId('debug-snapshot')).toBeVisible();
  const blob = await page.getByTestId('debug-snapshot').inputValue();
  expect(blob).toContain('mathtactics.debugSnapshot');
  expect(blob).toContain('level-3');
  expect(blob).toContain('add:5');
  expect(blob).toContain('bounceBack');

  await page.getByTestId('debug-copy').tap();
  await expect(page.getByTestId('debug-snapshot-status')).toBeVisible();
});

test('Jump to a wave persists as a resumable run', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.getByTestId('debug-wave-8').tap();
  await page.waitForFunction(() => window.__GAME__!.getState()?.waveIndex === 7);
  expect(await page.evaluate(() => window.__GAME__!.getState()?.mode)).toBe('run');

  await page.getByTestId('debug-close').tap();
  await expect(page.getByTestId('debug-menu')).toHaveCount(0);
  await page.getByTestId('home').tap();
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
});
