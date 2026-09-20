import { expect, test, type Page } from '@playwright/test';
import { parseGameData } from '../sim/data/load';
import type { Lane } from '../sim/core/coords';
import type { Command, RunState, ShopOffer } from '../sim/core/types';
import { loadRawGameData } from '../tests/helpers/loadDataFiles';
import { nextShopChoice, planningCommands } from '../tests/helpers/sensiblePlayer';
import { startNewGame } from './helpers/newGame';

// Task 27: a full 10-wave run through the real menus, screens and shop. Planning turns use the
// sensible-player policy via `dispatch` plus `skipAnimation`. Shop visits tap a real affordable
// card (same buy priority as the balance bot) then ▶ Next wave. A reload inside the shop after
// wave 8 resumes via ▶ Continue with the same offers.
//
// The real New Game button seeds randomly, so `MAX_TURNS` is headroom over the measured
// sensible-player worst case (task 27: 92 End Turns on 10 waves).
const MAX_TURNS = 200;
const data = parseGameData(loadRawGameData());

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

async function dispatchAll(page: Page, commands: Command[]) {
  for (const cmd of commands) {
    const result = await page.evaluate((command) => window.__GAME__!.dispatch(command), cmd);
    expect(result.ok, `dispatch ${cmd.type} failed: ${JSON.stringify(result)}`).toBe(true);
  }
}

async function playOneTurn(page: Page) {
  const state = await getState(page);
  expect(state).not.toBeNull();
  const commands = planningCommands(state!, data);
  await dispatchAll(page, commands);
  const end = await page.evaluate(() => window.__GAME__!.dispatch({ type: 'endTurn' }));
  expect(end.ok).toBe(true);
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await waitIdle(page);
}

function shopSnapshot(state: RunState): ShopOffer[] {
  return state.shop?.offers ?? [];
}

async function buyAffordableCards(page: Page) {
  for (let i = 0; i < 8; i++) {
    const state = await getState(page);
    expect(state).not.toBeNull();
    const choice = nextShopChoice(state!);
    if (choice.kind === 'done') break;
    await page.getByTestId(`shop-offer-${choice.slot}`).click();
    const after = await getState(page);
    expect(after?.shop?.offers.find((offer) => offer.slot === choice.slot)?.bought).toBe(true);
  }
}

async function playUntilWon(page: Page, turnsStart: number, reloadAfterWave?: number) {
  let turns = turnsStart;
  let reloaded = reloadAfterWave === undefined;

  while ((await getScreen(page)) !== 'won' && (await getScreen(page)) !== 'lost') {
    expect(turns, 'ran out of turns before the run won').toBeLessThan(MAX_TURNS);

    const screen = await getScreen(page);
    const state = await getState(page);
    if (state?.phase === 'waveCleared') {
      await expect(page.getByTestId('wave-cleared')).toBeVisible();
      await page.getByTestId('wave-next').click();
      continue;
    }
    if (state?.phase === 'shop' || screen === 'shop') {
      await expect(page.getByTestId('shop')).toBeVisible();
      const afterWave = state?.shop?.afterWave;
      if (!reloaded && afterWave === reloadAfterWave) {
        const beforeReload = await getState(page);
        expect(beforeReload?.phase).toBe('shop');
        const offers = shopSnapshot(beforeReload!);

        await page.reload();
        await page.waitForFunction(() => window.__GAME__ !== undefined);
        expect(await getScreen(page)).toBe('menu');
        await expect(page.getByTestId('menu-continue')).toBeVisible();
        await page.getByTestId('menu-continue').click();
        expect(await getScreen(page)).toBe('shop');
        const resumed = await getState(page);
        expect(resumed?.phase).toBe('shop');
        expect(shopSnapshot(resumed!)).toEqual(offers);
        reloaded = true;
      }
      await buyAffordableCards(page);
      await page.getByTestId('shop-next').click();
      await waitIdle(page);
      continue;
    }
    expect(state?.phase).toBe('planning');
    await playOneTurn(page);
    turns++;
  }

  return turns;
}

test('a full run plays through the real menus and screens: New Game -> 10 waves -> win -> menu', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();

  await startNewGame(page);
  expect(await getScreen(page)).toBe('game');
  await waitIdle(page);

  const dots = page.getByTestId('level-dots');
  await expect(dots).toBeVisible();
  expect(await dots.locator('.level-dot').count()).toBe(10);
  const barBox = await page.getByTestId('hud-bar').boundingBox();
  const dotsBox = await dots.boundingBox();
  expect(barBox).not.toBeNull();
  expect(dotsBox).not.toBeNull();
  expect(dotsBox!.x + dotsBox!.width).toBeLessThanOrEqual(barBox!.x + barBox!.width);

  await playUntilWon(page, 0);

  const finalState = await getState(page);
  expect(finalState?.phase).toBe('won');
  expect(finalState?.waveIndex).toBe(9);
  await expect(page.getByTestId('won')).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath('run-won.png') });

  await page.getByTestId('won-menu').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});

test('reloading inside the shop after wave 8 resumes the same offers and the run completes', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await startNewGame(page);
  await waitIdle(page);

  await playUntilWon(page, 0, 8);

  expect((await getState(page))?.phase).toBe('won');
  await expect(page.getByTestId('won')).toBeVisible();
  await page.getByTestId('won-menu').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});

test('menu → Settings → Hints on → Home → New Game → place a tile → getHints() is non-empty', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();

  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  await expect(page.getByTestId('settings-hints')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('settings-hints').click();
  await expect(page.getByTestId('settings-hints')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('settings-home').click();
  expect(await getScreen(page)).toBe('menu');

  await startNewGame(page);
  expect(await getScreen(page)).toBe('game');
  await waitIdle(page);

  // A fresh run has an empty tray (tiles come from the shop). Install a board with a tray tile
  // and dispatch placeTile so getHints can be asserted (task 24 hook; testids unchanged).
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

  await expect.poll(async () => (await getHints(page)).length).toBeGreaterThan(0);
});
