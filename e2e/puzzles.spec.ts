import { expect, test, type Page } from '@playwright/test';
import type { Command } from '../sim/core/types';
import { MIN_TOUCH_TARGET } from '../game/state/designSpace';

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState()!);
const getScreen = (page: Page) => page.evaluate(() => window.__GAME__!.getScreen());

async function openMenu(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();
}

async function expectTouchTarget(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

test('Puzzles opens the book; Back returns to the menu', async ({ page }) => {
  await openMenu(page);
  await expectTouchTarget(page, 'menu-puzzles');
  await page.getByTestId('menu-puzzles').click();
  expect(await getScreen(page)).toBe('levelSelect');
  await expect(page.getByTestId('puzzle-select')).toBeVisible();
  await expect(page.getByTestId('puzzle-grid')).toBeVisible();
  await expectTouchTarget(page, 'puzzle-select-back');
  await expectTouchTarget(page, 'puzzle-warm-up');
  await expect(page.getByTestId('puzzle-lock-blue-room')).toBeVisible();

  await page.getByTestId('puzzle-select-back').click();
  expect(await getScreen(page)).toBe('menu');
});

test('tapping Warm Up starts it; Go wins wave 1 then the book shows a check', async ({ page }) => {
  await openMenu(page);
  await page.getByTestId('menu-puzzles').click();
  await page.getByTestId('puzzle-warm-up').click();
  expect(await getScreen(page)).toBe('game');
  expect((await getState(page)).mode).toBe('puzzle');
  expect((await getState(page)).puzzleId).toBe('warm-up');
  const hud = page.getByTestId('hud-bar');
  await expect(hud).toContainText('♥');
  await expect(hud).not.toContainText('🪙');

  await page.getByTestId('end-turn').click();
  await page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });
  expect((await getState(page)).phase).toBe('waveCleared');
  await expect(page.getByTestId('wave-cleared')).toBeVisible();
  await expect(page.getByTestId('wave-wallet')).toHaveCount(0);
});

test('clearing Plus Party writes a check mark on the book', async ({ page }) => {
  await openMenu(page);
  await page.getByTestId('menu-puzzles').click();
  await page.evaluate(() => {
    const commands: Command[] = [
      { type: 'loadPuzzle', puzzleId: 'plus-party' },
      { type: 'placeTile', pieceId: 'piece:0', to: { lane: 2 as const, col: 1 as const } },
      { type: 'placeTile', pieceId: 'piece:1', to: { lane: 2 as const, col: 2 as const } },
      { type: 'endTurn' },
      { type: 'nextWave' },
      { type: 'placeTile', pieceId: 'piece:2', to: { lane: 2 as const, col: 3 as const } },
      { type: 'placeTile', pieceId: 'piece:3', to: { lane: 2 as const, col: 4 as const } },
      { type: 'endTurn' },
    ];
    for (const command of commands) {
      window.__GAME__!.dispatch(command);
      if (command.type === 'endTurn') window.__GAME__!.skipAnimation();
    }
  });
  await page.waitForFunction(() => window.__GAME__!.getScreen() === 'won', undefined, {
    timeout: 20_000,
  });
  await page.getByTestId('won-menu').click();
  expect(await getScreen(page)).toBe('levelSelect');
  await expect(page.getByTestId('puzzle-check-plus-party')).toBeVisible();
});

test('a locked tile does not start a session', async ({ page }) => {
  await openMenu(page);
  await page.getByTestId('menu-puzzles').click();
  // aria-disabled is intentional (locked catalog stub) but the tile still
  // accepts a tap so it can shake — Playwright's actionability treats that as
  // not enabled, so force the tap the way a finger would.
  await page.getByTestId('puzzle-blue-room').click({ force: true });
  await expect(page.getByTestId('puzzle-blue-room')).toHaveClass(/is-shaking/);
  expect(await getScreen(page)).toBe('levelSelect');
  expect(await page.evaluate(() => window.__GAME__!.getState())).toBeNull();
});

test('lose offers Play again and never checks the book', async ({ page }) => {
  await openMenu(page);
  await page.getByTestId('menu-puzzles').click();
  await page.evaluate(() => {
    window.__GAME__!.dispatch({ type: 'loadPuzzle', puzzleId: 'occupied' });
    window.__GAME__!.skipAnimation();
    const loaded = window.__GAME__!.getState()!;
    window.__GAME__!.loadState({ ...loaded, baseHp: 1 });
    for (let i = 0; i < 6; i++) {
      window.__GAME__!.dispatch({ type: 'endTurn' });
      window.__GAME__!.skipAnimation();
      if (window.__GAME__!.getState()?.phase === 'lost') break;
    }
  });
  await page.waitForFunction(() => window.__GAME__!.getScreen() === 'lost', undefined, {
    timeout: 20_000,
  });
  await expect(page.getByTestId('lost-play-again')).toBeVisible();
  await expectTouchTarget(page, 'lost-play-again');
  await expectTouchTarget(page, 'lost-back');
  await page.getByTestId('lost-play-again').click();
  await page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });
  expect(await getScreen(page)).toBe('game');
  expect((await getState(page)).mode).toBe('puzzle');
  expect((await getState(page)).puzzleId).toBe('occupied');
  expect((await getState(page)).waveIndex).toBe(0);
  expect((await getState(page)).phase).toBe('planning');

  await page.getByTestId('home').click();
  expect(await getScreen(page)).toBe('levelSelect');
  await expect(page.getByTestId('puzzle-check-occupied')).toHaveCount(0);
});
