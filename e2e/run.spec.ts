import { expect, test, type Page } from '@playwright/test';
import { parseGameData } from '../sim/data/load';
import type { Command, RunState, ShopOffer } from '../sim/core/types';
import { loadRawGameData } from '../tests/helpers/loadDataFiles';
import { nextShopChoice, planningCommands } from '../tests/helpers/sensiblePlayer';

// Task 21: a full 9-wave run through the real menus, screens and shop. Planning turns use the
// sensible-player policy via `dispatch` plus `skipAnimation`. Shop visits tap a real affordable
// card (same buy priority as the balance bot) then ▶ Next wave. A reload inside a mid-run shop
// resumes via ▶ Continue with the same offers.
//
// The real New Run button seeds randomly, so `MAX_TURNS` is headroom over the measured
// sensible-player worst case (task 21: 51 End Turns on 7 waves; re-measured for 9 in task 25).
const MAX_TURNS = 200;
const data = parseGameData(loadRawGameData());

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState());
const getScreen = (page: Page) => page.evaluate(() => window.__GAME__!.getScreen());
const waitIdle = (page: Page) =>
  page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });

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

test('a full run plays through the real menus and screens: New Run -> 9 waves -> win -> menu', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();

  await page.getByTestId('menu-new-run').click();
  expect(await getScreen(page)).toBe('game');
  await waitIdle(page);

  const dots = page.getByTestId('level-dots');
  await expect(dots).toBeVisible();
  expect(await dots.locator('.level-dot').count()).toBe(9);
  const barBox = await page.getByTestId('hud-bar').boundingBox();
  const dotsBox = await dots.boundingBox();
  expect(barBox).not.toBeNull();
  expect(dotsBox).not.toBeNull();
  expect(dotsBox!.x + dotsBox!.width).toBeLessThanOrEqual(barBox!.x + barBox!.width);

  await playUntilWon(page, 0);

  const finalState = await getState(page);
  expect(finalState?.phase).toBe('won');
  expect(finalState?.waveIndex).toBe(8);
  await expect(page.getByTestId('won')).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath('run-won.png') });

  await page.getByTestId('won-menu').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});

test('reloading inside a shop resumes the same offers and the run completes', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.getByTestId('menu-new-run').click();
  await waitIdle(page);

  await playUntilWon(page, 0, 3);

  expect((await getState(page))?.phase).toBe('won');
  await expect(page.getByTestId('won')).toBeVisible();
  await page.getByTestId('won-menu').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});
