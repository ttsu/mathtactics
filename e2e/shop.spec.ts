import { expect, test, type Page } from '@playwright/test';

// Task 19: shop is part of a run. Clear a non-final wave (inline `waves:`), overlay ▶ opens the
// shop, buying a tile then ▶ Next wave lands in planning with that tile in the tray. Reloading
// inside the shop resumes via Continue with the same offers and the same slot still bought.

const TWO_WAVES = [
  'waves:',
  '  - id: e2e-wave-1',
  '    spawns:',
  '      - { turn: 1, lane: 0, robot: basic, hp: [1, 1] }',
  '  - id: e2e-wave-2',
  '    spawns:',
  '      - { turn: 1, lane: 1, robot: basic, hp: [4, 4] }',
];

const NEAR_CLEAR = [
  'name: e2e shop',
  'mode: run',
  'baseValue: 5',
  'coins: 20',
  'board:',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - "C R5 . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  ...TWO_WAVES,
].join('\n');

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState()!);
const getScreen = (page: Page) => page.evaluate(() => window.__GAME__!.getScreen());

async function loadScenario(page: Page, yamlText: string) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yamlText);
}

async function endTurnAndSkip(page: Page) {
  const result = await page.evaluate(() => window.__GAME__!.dispatch({ type: 'endTurn' }));
  expect(result).toEqual({ ok: true });
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await page.waitForFunction(() => window.__GAME__!.isIdle());
}

test('clearing a wave opens the shop; buying a tile then Next wave puts it in the tray', async ({
  page,
}) => {
  await loadScenario(page, NEAR_CLEAR);
  await endTurnAndSkip(page);
  expect((await getState(page)).phase).toBe('waveCleared');

  await page.getByTestId('wave-next').click();
  expect(await getScreen(page)).toBe('shop');
  expect((await getState(page)).phase).toBe('shop');
  await expect(page.getByTestId('shop')).toBeVisible();
  await expect(page.getByTestId('shop-offer-tile:0')).toBeVisible();

  const beforeBuy = await getState(page);
  const tileOffer = beforeBuy.shop!.offers.find((offer) => offer.slot === 'tile:0');
  expect(tileOffer?.kind).toBe('tile');

  await page.getByTestId('shop-offer-tile:0').click();
  const afterBuy = await getState(page);
  expect(afterBuy.shop?.offers.find((offer) => offer.slot === 'tile:0')?.bought).toBe(true);
  expect(afterBuy.tray.length).toBe(1);
  expect(afterBuy.pieces[afterBuy.tray[0]!]?.tileId).toBe(
    tileOffer && tileOffer.kind === 'tile' ? tileOffer.tileId : undefined,
  );

  await page.getByTestId('shop-next').click();
  await page.waitForFunction(() => window.__GAME__!.isIdle());
  expect(await getScreen(page)).toBe('game');
  const planning = await getState(page);
  expect(planning.phase).toBe('planning');
  expect(planning.waveIndex).toBe(1);
  expect(planning.tray.length).toBe(1);
});

test('reloading inside the shop resumes the same offers with the same slot bought', async ({
  page,
}) => {
  await loadScenario(page, NEAR_CLEAR);
  await endTurnAndSkip(page);
  await page.getByTestId('wave-next').click();
  await page.getByTestId('shop-offer-tile:0').click();

  const beforeReload = await getState(page);
  expect(beforeReload.phase).toBe('shop');
  expect(beforeReload.shop?.offers.find((offer) => offer.slot === 'tile:0')?.bought).toBe(true);

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  expect(await getScreen(page)).toBe('menu');
  await page.getByTestId('menu-continue').click();

  expect(await getScreen(page)).toBe('shop');
  const resumed = await getState(page);
  expect(resumed.phase).toBe('shop');
  expect(resumed.shop).toEqual(beforeReload.shop);
  expect(resumed.shop?.offers.find((offer) => offer.slot === 'tile:0')?.bought).toBe(true);
  await expect(page.getByTestId('shop-offer-tile:0')).toBeDisabled();
});
