import { expect, test, type Page } from '@playwright/test';
import { MIN_TOUCH_TARGET } from '../game/state/designSpace';
import { startNewGame } from './helpers/newGame';
import { parseGameData } from '../sim/data/load';
import { laneHintValues } from '../sim/core/hints';
import type { Lane } from '../sim/core/coords';
import { loadRawGameData } from '../tests/helpers/loadDataFiles';

const data = parseGameData(loadRawGameData());

// Task 24: Settings screen (hints + difficulty) and planning-hint numerals on the board.
// Task 31: Sound row (`settings-sound`), default on, persists, preview on enable.

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState());
const getScreen = (page: Page) => page.evaluate(() => window.__GAME__!.getScreen());
const getHints = (page: Page) => page.evaluate(() => window.__GAME__!.getHints());
const waitIdle = (page: Page) =>
  page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });

const HINT_BOARD = [
  'name: e2e planning hints',
  'baseValue: 1',
  'tray: [add:4]',
  'board:',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - "C . . . . . . R20"',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
].join('\n');

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

async function turnHintsOnFromMenu(page: Page) {
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  await expect(page.getByTestId('settings-hints')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('settings-hints').click();
  await expect(page.getByTestId('settings-hints')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('settings-home').click();
  expect(await getScreen(page)).toBe('menu');
}

test('Settings is on the menu with or without a resumable run; Sound row is on and pressed', async ({
  page,
}) => {
  await openMenu(page);
  await expect(page.getByTestId('menu-settings')).toBeVisible();
  await expectTouchTarget(page, 'menu-settings');
  const settingsBox = await page.getByTestId('menu-settings').boundingBox();
  const newGameBox = await page.getByTestId('menu-new-run').boundingBox();
  expect(settingsBox?.width, 'Settings is smaller than New Game').toBeLessThan(newGameBox!.width);
  expect(settingsBox?.height).toBeLessThan(newGameBox!.height);

  await page.getByTestId('menu-settings').click();
  expect(await getScreen(page)).toBe('settings');
  await expect(page.getByTestId('settings')).toBeVisible();
  await expect(page.getByTestId('settings-hints')).toBeVisible();
  await expect(page.getByTestId('settings-sound')).toBeVisible();
  await expect(page.getByTestId('settings-home')).toBeVisible();
  await expect(page.getByTestId('settings-difficulty-easy')).toBeVisible();
  await expect(page.getByTestId('settings-difficulty-normal')).toBeVisible();
  await expect(page.getByTestId('settings-difficulty-hard')).toBeVisible();
  await expect(page.getByTestId('settings-hints')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('settings-sound')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('settings-difficulty-normal')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('settings-sound')).toContainText(/sound/i);
  await expectTouchTarget(page, 'settings-hints');
  await expectTouchTarget(page, 'settings-sound');
  await expectTouchTarget(page, 'settings-home');

  await page.getByTestId('settings-home').click();
  await startNewGame(page);
  await waitIdle(page);
  await page.getByTestId('home').click();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await expect(page.getByTestId('menu-settings')).toBeVisible();
});

test('Menu → Settings → Hints on → Home → New Game → place a tile → getHints matches laneHintValues', async ({
  page,
}) => {
  await openMenu(page);
  await turnHintsOnFromMenu(page);

  await startNewGame(page);
  expect(await getScreen(page)).toBe('game');
  await waitIdle(page);

  // A fresh run has an empty tray (tiles come from the shop). Install a board with a tray tile
  // and dispatch placeTile so getHints can be asserted against laneHintValues.
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), HINT_BOARD);
  await waitIdle(page);

  const placed = await page.evaluate(() => {
    const state = window.__GAME__!.getState()!;
    const pieceId = state.tray[0];
    const lane = state.board.cannons.findIndex((armed) => armed);
    if (pieceId === undefined || lane < 0) {
      return { ok: false as const, error: 'no tray tile or armed lane' };
    }
    return window.__GAME__!.dispatch({
      type: 'placeTile',
      pieceId,
      to: { lane: lane as Lane, col: 1 },
    });
  });
  expect(placed).toEqual({ ok: true });

  const state = await getState(page);
  expect(state).not.toBeNull();
  const lane = state!.board.cannons.findIndex((armed) => armed) as Lane;
  const expected = laneHintValues(state!, lane, data).map((hint) => ({
    lane,
    col: hint.col,
    value: hint.value,
  }));
  expect(expected.length).toBeGreaterThan(0);

  await expect.poll(async () => getHints(page)).toEqual(expected);
});

test('getHints is empty with the same board when hints are off', async ({ page }) => {
  await openMenu(page);
  // Default: hints off.
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), HINT_BOARD);
  await waitIdle(page);
  await page.evaluate(() => {
    const state = window.__GAME__!.getState()!;
    const pieceId = state.tray[0]!;
    const lane = state.board.cannons.findIndex((armed) => armed);
    window.__GAME__!.dispatch({
      type: 'placeTile',
      pieceId,
      to: { lane: lane as Lane, col: 1 },
    });
  });
  expect(await getHints(page)).toEqual([]);
});

test('Hints on survives reload', async ({ page }) => {
  await openMenu(page);
  await turnHintsOnFromMenu(page);

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('settings-hints')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('settings-sound')).toHaveAttribute('aria-pressed', 'true');
});

test('Sound off survives reload; turning it on records preview', async ({ page }) => {
  await openMenu(page);
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('settings-sound')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('settings-sound').click();
  await expect(page.getByTestId('settings-sound')).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('settings-sound')).toHaveAttribute('aria-pressed', 'false');

  await page.evaluate(() => window.__GAME__!.clearLastCues());
  await page.getByTestId('settings-sound').click();
  await expect(page.getByTestId('settings-sound')).toHaveAttribute('aria-pressed', 'true');
  const cues = await page.evaluate(() => window.__GAME__!.getLastCues());
  expect(cues.some((cue) => cue.name === 'preview')).toBe(true);
});

test('New Game plays uiTap into getLastCues', async ({ page }) => {
  await openMenu(page);
  await page.evaluate(() => window.__GAME__!.clearLastCues());
  await page.getByTestId('menu-new-run').click();
  await expect(page.getByTestId('difficulty')).toBeVisible();
  const cues = await page.evaluate(() => window.__GAME__!.getLastCues());
  expect(cues.some((cue) => cue.name === 'uiTap')).toBe(true);
});
