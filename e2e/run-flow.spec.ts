import { expect, test, type Page } from '@playwright/test';
import { MIN_TOUCH_TARGET } from '../game/state/designSpace';

// Task 14: save/resume, main menu, and ⌂ Home. Asserts on structured state (TR §14); screenshots
// are for the human legibility check only.

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState());
const getScreen = (page: Page) => page.evaluate(() => window.__GAME__!.getScreen());
const waitIdle = (page: Page) =>
  page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });

async function openMenu(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();
}

async function expectTouchTarget(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box?.width, testId).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(box?.height, testId).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

test('New Run autosaves; reload resumes in planning with no lost progress', async ({ page }) => {
  await openMenu(page);
  // Nothing to continue yet: New Run is the big button, Puzzles the small one, no Continue.
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
  await expectTouchTarget(page, 'menu-new-run');
  await expectTouchTarget(page, 'menu-puzzles');

  await page.getByTestId('menu-new-run').click();
  expect(await getScreen(page)).toBe('game');
  await waitIdle(page);
  const afterSpawn = await getState(page);
  expect(afterSpawn?.board.robots.length).toBeGreaterThan(0);

  await expectTouchTarget(page, 'end-turn');
  await page.getByTestId('end-turn').click();
  await waitIdle(page);
  const beforeReload = await getState(page);

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await expectTouchTarget(page, 'menu-continue');

  await page.getByTestId('menu-continue').click();
  expect(await getScreen(page)).toBe('game');
  expect(await getState(page)).toEqual(beforeReload);
  expect(await page.evaluate(() => window.__GAME__!.isIdle())).toBe(true);
});

test('Puzzles never touches the saved run; Home returns to it without confirmation', async ({
  page,
}) => {
  await openMenu(page);
  await page.getByTestId('menu-new-run').click();
  await waitIdle(page);
  const savedRun = await getState(page);

  await expectTouchTarget(page, 'home');
  await page.getByTestId('home').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toBeVisible();

  await page.getByTestId('menu-puzzles').click();
  expect(await getScreen(page)).toBe('game');
  expect((await getState(page))?.mode).toBe('level');

  await page.getByTestId('home').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toBeVisible();

  await page.getByTestId('menu-continue').click();
  expect(await getState(page)).toEqual(savedRun);
});

test('reload mid-playback resumes in planning with the resolved state (no reload exploit)', async ({
  page,
}) => {
  await openMenu(page);
  await page.getByTestId('menu-new-run').click();
  await waitIdle(page);

  // Dispatch End Turn but do not skip its animation, then reload immediately — the resolved
  // state is already saved (TR §10.4: saved before playback finishes).
  await page.evaluate(() => window.__GAME__!.dispatch({ type: 'endTurn' }));
  const resolved = await getState(page);

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.getByTestId('menu-continue').click();

  expect(await getScreen(page)).toBe('game');
  expect(await getState(page)).toEqual(resolved);
  expect(await page.evaluate(() => window.__GAME__!.isIdle())).toBe(true);
});

test('a lost run is cleared: Continue disappears after its playback finishes', async ({
  page,
}, testInfo) => {
  await openMenu(page);
  await page.waitForTimeout(600); // let the pop-in finish before the screenshot
  await page.screenshot({ path: testInfo.outputPath('menu-no-continue.png') });

  const yaml = [
    'name: e2e run lost',
    'mode: run',
    'baseValue: 0',
    'baseHp: 5',
    'board:',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . ."',
    '  - ". R8 . . . . . ."',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . ."',
    'waves:',
    '  - id: only-wave',
    '    spawns:',
    '      - { turn: 1, lane: 0, robot: basic, hp: [1, 1] }',
  ].join('\n');
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yaml);
  await page.evaluate(() => window.__GAME__!.dispatch({ type: 'endTurn' }));
  await page.evaluate(() => window.__GAME__!.skipAnimation());

  expect((await getState(page))?.phase).toBe('lost');
  expect(await getScreen(page)).toBe('lost');

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});

test('every menu and HUD button is at least 60pt in both dimensions', async ({ page }) => {
  await openMenu(page);
  await page.waitForTimeout(600);
  await expectTouchTarget(page, 'menu-new-run');
  await expectTouchTarget(page, 'menu-puzzles');

  await page.getByTestId('menu-new-run').click();
  await waitIdle(page);
  for (const testId of ['home', 'replay', 'undo', 'end-turn']) {
    await expectTouchTarget(page, testId);
  }

  await page.getByTestId('home').click();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.waitForTimeout(600); // let the pop-in finish (it scales the buttons)
  await expectTouchTarget(page, 'menu-continue');
  await expectTouchTarget(page, 'menu-new-run');
  await expectTouchTarget(page, 'menu-puzzles');
});
