import { expect, test, type Page } from '@playwright/test';
import { MIN_TOUCH_TARGET } from '../game/state/designSpace';
import { startNewGame } from './helpers/newGame';

// Task 29: New Game picker and Settings three-way. Asserts on structured state (TR §14).

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

test('New Game always opens the picker; Normal is pressed on a fresh profile', async ({ page }) => {
  await openMenu(page);
  await page.getByTestId('menu-new-run').click();
  expect(await getScreen(page)).toBe('difficulty');
  await expect(page.getByTestId('difficulty')).toBeVisible();
  await expect(page.getByTestId('difficulty-easy')).toHaveAttribute('aria-label', 'Easy');
  await expect(page.getByTestId('difficulty-normal')).toHaveAttribute('aria-label', 'Normal');
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-label', 'Hard');
  await expect(page.getByTestId('difficulty-normal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('difficulty-easy')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed', 'false');
  await expectTouchTarget(page, 'difficulty-easy');
  await expectTouchTarget(page, 'difficulty-normal');
  await expectTouchTarget(page, 'difficulty-hard');
  await expectTouchTarget(page, 'difficulty-back');
  const backBox = await page.getByTestId('difficulty-back').boundingBox();
  const easyBox = await page.getByTestId('difficulty-easy').boundingBox();
  expect(backBox!.x, 'Back sits on the left').toBeLessThan(easyBox!.x);
  expect(backBox!.y, 'Back sits above the stars').toBeLessThan(easyBox!.y);
});

test('tapping Easy starts that run, remembers the pick, and applies the overlay', async ({
  page,
}) => {
  await openMenu(page);
  await startNewGame(page, 'easy');
  expect(await getScreen(page)).toBe('game');
  await waitIdle(page);
  const state = await getState(page);
  expect(state?.difficulty).toBe('easy');
  const hps = [
    ...(state?.board.robots.map((robot) => robot.hp) ?? []),
    ...(state?.pendingSpawns.map((spawn) => spawn.hp) ?? []),
  ];
  expect(hps.length).toBeGreaterThan(0);
  // Wave-1 Easy band is 75% of [1, 3] → [1, 2].
  expect(hps.every((hp) => hp >= 1 && hp <= 2)).toBe(true);

  await page.getByTestId('home').click();
  await page.getByTestId('menu-new-run').click();
  await expect(page.getByTestId('difficulty-easy')).toHaveAttribute('aria-pressed', 'true');
});

test('Back from the picker does not replace a saved run or the last pick', async ({ page }) => {
  await openMenu(page);
  await startNewGame(page, 'normal');
  await waitIdle(page);
  const saved = await getState(page);
  expect(saved?.difficulty).toBe('normal');

  await page.getByTestId('home').click();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-new-run').click();
  await expect(page.getByTestId('difficulty')).toBeVisible();
  await page.getByTestId('difficulty-back').click();

  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  expect(await getState(page)).toEqual(saved);
});

test('Keep Going after Easy New Game does not show the picker', async ({ page }) => {
  await openMenu(page);
  await startNewGame(page, 'easy');
  await waitIdle(page);
  await page.getByTestId('home').click();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  expect(await getScreen(page)).toBe('game');
  await expect(page.getByTestId('difficulty')).toHaveCount(0);
  expect((await getState(page))?.difficulty).toBe('easy');
});

test('Settings three-way persists across reload and does not retcon a saved Easy run', async ({
  page,
}) => {
  await openMenu(page);
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  await expect(page.getByTestId('settings-difficulty-normal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('settings-sound')).toBeVisible();
  await expectTouchTarget(page, 'settings-difficulty-easy');
  await expectTouchTarget(page, 'settings-difficulty-normal');
  await expectTouchTarget(page, 'settings-difficulty-hard');

  await page.getByTestId('settings-home').click();
  await startNewGame(page, 'easy');
  await waitIdle(page);
  const easySeed = (await getState(page))?.seed;
  expect((await getState(page))?.difficulty).toBe('easy');

  await page.getByTestId('home').click();
  await page.getByTestId('menu-settings').click();
  await page.getByTestId('settings-difficulty-hard').click();
  await expect(page.getByTestId('settings-difficulty-hard')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('settings-home').click();

  await page.getByTestId('menu-continue').click();
  expect(await getScreen(page)).toBe('game');
  expect((await getState(page))?.difficulty).toBe('easy');
  expect((await getState(page))?.seed).toBe(easySeed);

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('settings-difficulty-hard')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('settings-difficulty-easy')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('settings-home').click();
  await page.getByTestId('menu-continue').click();
  expect((await getState(page))?.difficulty).toBe('easy');
});
