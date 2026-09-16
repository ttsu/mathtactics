import { expect, test, type Page } from '@playwright/test';
import { traySlotCenter } from '../game/board/layout';
import { DESIGN_WIDTH, MIN_TOUCH_TARGET } from '../game/state/designSpace';
import type { Cell } from '../sim/core/coords';

// Task 19/20: shop is part of a run. Clear a non-final wave (inline `waves:`), overlay ▶ opens
// the shop, buying a tile then ▶ Next wave lands in planning with that tile in the tray.
// Reloading inside the shop resumes via Continue with the same offers and the same slot still
// bought. Task 20 adds the real cards, NEW stickers, unaffordable refusal, and 60pt targets.

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

const ZERO_COIN_SHOP = [
  'name: e2e unaffordable shop',
  'mode: run',
  'phase: shop',
  'baseValue: 1',
  'coins: 0',
  'board:',
  '  - "C . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
  'shop:',
  '  - { slot: "tile:0", kind: tile, tileId: "add:2", price: 4, bought: false }',
  '  - { slot: "tile:1", kind: tile, tileId: "sub:3", price: 4, bought: false }',
  '  - { slot: "tile:2", kind: tile, tileId: "mul:6", price: 9, bought: false }',
  '  - { slot: cannon, kind: cannon, price: 10, bought: false, available: true }',
  '  - { slot: upgrade, kind: upgrade, price: 12, bought: false, fromValue: 1, toValue: 2 }',
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

async function expectTouchTarget(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box?.width, testId).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(box?.height, testId).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
}

async function openShopFromClear(page: Page) {
  await loadScenario(page, NEAR_CLEAR);
  await endTurnAndSkip(page);
  expect((await getState(page)).phase).toBe('waveCleared');
  await page.getByTestId('wave-next').click();
  expect(await getScreen(page)).toBe('shop');
}

type Pt = { x: number; y: number };

async function cellPoint(page: Page, cell: Cell): Promise<Pt> {
  return page.evaluate((c) => window.__GAME__!.cellToClient(c), cell);
}

async function trayPoint(page: Page, index: number): Promise<Pt> {
  const box = await page.locator('#board-root canvas').boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  const scale = box.width / DESIGN_WIDTH;
  const center = traySlotCenter(index, 0);
  return { x: box.x + center.x * scale, y: box.y + center.y * scale };
}

async function mouseDrag(page: Page, from: Pt, to: Pt) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

test('clearing a wave opens the shop; buying a tile then Next wave puts it in the tray', async ({
  page,
}) => {
  await openShopFromClear(page);
  expect((await getState(page)).phase).toBe('shop');
  await expect(page.getByTestId('shop')).toBeVisible();
  await expect(page.getByTestId('shop-offer-tile:0')).toBeVisible();
  await expect(page.getByTestId('shop-offer-tile:1')).toBeVisible();
  await expect(page.getByTestId('shop-offer-tile:2')).toBeVisible();
  await expect(page.getByTestId('shop-offer-cannon')).toBeVisible();
  await expect(page.getByTestId('shop-offer-upgrade')).toBeVisible();

  const beforeBuy = await getState(page);
  expect(page.getByTestId('shop-wallet')).toBeVisible();
  await expect(page.getByTestId('shop-wallet')).toContainText(String(beforeBuy.coins));
  const tileOffer = beforeBuy.shop!.offers.find((offer) => offer.slot === 'tile:0');
  expect(tileOffer?.kind).toBe('tile');

  await page.getByTestId('shop-offer-tile:0').click();
  const afterBuy = await getState(page);
  expect(afterBuy.shop?.offers.find((offer) => offer.slot === 'tile:0')?.bought).toBe(true);
  expect(afterBuy.tray.length).toBe(1);
  expect(afterBuy.pieces[afterBuy.tray[0]!]?.tileId).toBe(
    tileOffer && tileOffer.kind === 'tile' ? tileOffer.tileId : undefined,
  );
  expect(afterBuy.coins).toBe(beforeBuy.coins - (tileOffer?.price ?? 0));

  const trayBeforeSecondTap = afterBuy.tray.length;
  const coinsBeforeSecondTap = afterBuy.coins;
  await page.getByTestId('shop-offer-tile:0').click({ force: true });
  const afterSecondTap = await getState(page);
  expect(afterSecondTap.tray.length).toBe(trayBeforeSecondTap);
  expect(afterSecondTap.coins).toBe(coinsBeforeSecondTap);

  await page.getByTestId('shop-next').click();
  await page.waitForFunction(() => window.__GAME__!.isIdle());
  expect(await getScreen(page)).toBe('game');
  const planning = await getState(page);
  expect(planning.phase).toBe('planning');
  expect(planning.waveIndex).toBe(1);
  expect(planning.tray.length).toBe(1);

  const from = await trayPoint(page, 0);
  const to = await cellPoint(page, { lane: 0, col: 3 });
  await mouseDrag(page, from, to);
  const placed = await getState(page);
  expect(placed.tray).toEqual([]);
  expect(placed.board.cells[0]![3]).toBe(planning.tray[0]);
});

test('reloading inside the shop resumes the same offers with the same slot bought', async ({
  page,
}) => {
  await openShopFromClear(page);
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

test('NEW stickers appear only for never-offered tile types', async ({ page }, testInfo) => {
  await openShopFromClear(page);
  const first = await getState(page);
  const firstTiles = first.shop!.offers.flatMap((offer) =>
    offer.kind === 'tile' ? [offer.tileId] : [],
  );
  expect(firstTiles.length).toBeGreaterThan(0);
  for (const offer of first.shop!.offers) {
    if (offer.kind === 'tile') {
      await expect(page.getByTestId(`shop-new-${offer.slot}`)).toBeVisible();
    }
  }
  await expect(page.getByTestId('shop-new-cannon')).toHaveCount(0);
  await expect(page.getByTestId('shop-new-upgrade')).toHaveCount(0);

  const withNew = await page.getByTestId('shop').screenshot();
  await testInfo.attach('shop-with-new', { body: withNew, contentType: 'image/png' });
  await page.screenshot({ path: '/opt/cursor/artifacts/shop-with-new.png' });

  await page.getByTestId('shop-next').click();
  await page.waitForFunction(() => window.__GAME__!.isIdle());

  await loadScenario(page, NEAR_CLEAR);
  await endTurnAndSkip(page);
  await page.getByTestId('wave-next').click();
  await expect(page.getByTestId('shop')).toBeVisible();

  const second = await getState(page);
  for (const offer of second.shop!.offers) {
    if (offer.kind === 'tile' && firstTiles.includes(offer.tileId)) {
      await expect(page.getByTestId(`shop-new-${offer.slot}`)).toHaveCount(0);
    }
  }

  const withoutRepeatNew = await page.getByTestId('shop').screenshot();
  await testInfo.attach('shop-without-repeat-new', {
    body: withoutRepeatNew,
    contentType: 'image/png',
  });
  await page.screenshot({ path: '/opt/cursor/artifacts/shop-without-repeat-new.png' });
});

test('unaffordable tap shakes nothing: wallet and getState stay put', async ({ page }) => {
  await loadScenario(page, ZERO_COIN_SHOP);
  expect(await getScreen(page)).toBe('shop');
  const before = await getState(page);
  expect(before.coins).toBe(0);
  await expect(page.getByTestId('shop-offer-tile:0')).toBeEnabled();
  await page.getByTestId('shop-offer-tile:0').click();
  const after = await getState(page);
  expect(after).toEqual(before);
  await expect(page.getByTestId('shop-wallet')).toContainText('0');
});

test('shop cards, wallet, and Next wave are at least 60pt', async ({ page }) => {
  await openShopFromClear(page);
  for (const id of [
    'shop-offer-tile:0',
    'shop-offer-tile:1',
    'shop-offer-tile:2',
    'shop-offer-cannon',
    'shop-offer-upgrade',
    'shop-next',
  ]) {
    await expectTouchTarget(page, id);
  }
});
