import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { traySlotCenter } from '../game/board/layout';
import { DESIGN_WIDTH } from '../game/state/designSpace';

// Task 10: the playback Director — HUD commits lag until their events play, tap-to-skip per lane,
// skipAnimation/isIdle, and Replay. Asserts on structured state (TR §14); screenshots are for the
// human legibility check only.

// Three armed lanes, all exact kills or an exit; lane 1's robot is out of reach so the level
// doesn't clear and the run stays in planning (Replay needs planning).
const MULTI_LANE = [
  'name: e2e playback',
  'baseValue: 1',
  'tray: [add:4]',
  'board:',
  '  - "C +2 . R3 . . . ."', // lane 0: 1 + 2 = 3 → exact kill, +2 coins
  '  - ". . . . . . . R9"', // lane 1: unarmed
  '  - "C x3 +1 . . R4 . ."', // lane 2: 1 × 3 + 1 = 4 → exact kill, +2 coins
  '  - "C . . . . . . ."', // lane 3: the ball exits
  '  - ". . . . . . . ."',
].join('\n');

async function load(page: Page, yaml: string) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yaml);
}

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState()!);
const getDisplay = (page: Page) => page.evaluate(() => window.__GAME__!.getDisplay());
const isIdle = (page: Page) => page.evaluate(() => window.__GAME__!.isIdle());

async function trayPoint(page: Page, index: number) {
  const box = await page.locator('#board-root canvas').boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  const scale = box.width / DESIGN_WIDTH;
  const center = traySlotCenter(index, 0);
  return { x: box.x + center.x * scale, y: box.y + center.y * scale };
}

test('HUD coins lag until playback; skipAnimation commits them and leaves the board idle', async ({
  page,
}) => {
  const yaml = readFileSync(
    resolve('scenarios/core/exact-kill-order-of-operations.scenario.yaml'),
    'utf8',
  );
  await load(page, yaml);
  const coinsBefore = (await getDisplay(page)).coins;

  const afterEndTurn = await page.evaluate(() => {
    const events = window.__GAME__!.endTurn();
    return { events: events.length, display: window.__GAME__!.getDisplay() };
  });
  expect(afterEndTurn.events).toBeGreaterThan(0);
  expect(afterEndTurn.display.coins).toBe(coinsBefore);
  expect((await getState(page)).coins).toBe(coinsBefore + 2);
  expect(await isIdle(page)).toBe(false);

  await page.evaluate(() => window.__GAME__!.skipAnimation());

  expect((await getDisplay(page)).coins).toBe((await getState(page)).coins);
  expect(await isIdle(page)).toBe(true);
});

test('left alone, playback commits coins lane by lane and finishes by itself', async ({ page }) => {
  await load(page, MULTI_LANE);
  await page.evaluate(() => window.__GAME__!.endTurn());

  // Lane 0's reward lands while later lanes are still to play.
  await page.waitForFunction(() => window.__GAME__!.getDisplay().coins === 2);
  expect(await isIdle(page)).toBe(false);
  await expect(page.getByTestId('end-turn')).toBeDisabled();

  await page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 20_000 });
  expect((await getDisplay(page)).coins).toBe(4);
  await expect(page.getByTestId('end-turn')).toBeEnabled();
});

test('installing a state mid-playback abandons it without touching the new HUD values', async ({
  page,
}) => {
  await load(page, MULTI_LANE);
  await page.evaluate(() => window.__GAME__!.endTurn());
  // Let lane 0 get under way, but not reach its coin reward.
  await page.waitForTimeout(300);
  expect((await getDisplay(page)).coins).toBe(0);

  await page.evaluate(
    (text) => window.__GAME__!.loadScenario(text),
    MULTI_LANE.replace('baseValue: 1', 'baseValue: 1\ncoins: 7'),
  );
  // Give the abandoned sequence's timers a few frames to (not) fire.
  await page.waitForTimeout(300);

  const state = await getState(page);
  expect(state.coins).toBe(7);
  expect(await getDisplay(page)).toEqual({
    coins: state.coins,
    baseHp: state.baseHp,
    waveIndex: state.waveIndex,
  });
  expect(await isIdle(page)).toBe(true);
});

test('a new turn dispatched mid-playback abandons the old sequence without committing it', async ({
  page,
}) => {
  await load(page, MULTI_LANE);
  // Level mode stays in planning (lane 1's robot survives), so a second End Turn is accepted.
  const display = await page.evaluate(() => {
    window.__GAME__!.endTurn();
    window.__GAME__!.endTurn();
    return window.__GAME__!.getDisplay();
  });
  // The first turn's +4 coins were never played, so they were never committed.
  expect(display.coins).toBe(0);

  await page.evaluate(() => window.__GAME__!.skipAnimation());
  expect((await getDisplay(page)).coins).toBe((await getState(page)).coins);
  expect(await isIdle(page)).toBe(true);
});

test('each tap on the canvas skips one lane, and taps never start a drag', async ({ page }) => {
  await load(page, MULTI_LANE);
  const before = await getState(page);
  const canvas = page.locator('#board-root canvas');
  await page.evaluate(() => window.__GAME__!.endTurn());
  expect((await getDisplay(page)).coins).toBe(0);

  await canvas.click({ position: { x: 40, y: 200 } });
  expect((await getDisplay(page)).coins).toBe(2); // lane 0 finished instantly
  expect(await isIdle(page)).toBe(false);

  await canvas.click({ position: { x: 40, y: 200 } });
  expect((await getDisplay(page)).coins).toBe(4); // lane 2 finished instantly
  expect(await isIdle(page)).toBe(false);

  // The last tap (lane 3) starts on a tray tile: it finishes playback but must not pick it up.
  const tile = await trayPoint(page, 0);
  await page.mouse.move(tile.x, tile.y);
  await page.mouse.down();
  await page.mouse.move(tile.x + 4, tile.y);
  await page.mouse.up();
  expect(await isIdle(page)).toBe(true);

  // A press held through the end of playback and dragged onto a cell dispatches nothing either.
  const cell = await page.evaluate(() => window.__GAME__!.cellToClient({ lane: 3, col: 4 }));
  await page.evaluate(() =>
    window.__GAME__!.dispatch({ type: 'moveCannon', fromLane: 3, toLane: 4 }),
  );
  await page.evaluate(() => window.__GAME__!.endTurn());
  await page.mouse.move(tile.x, tile.y);
  await page.mouse.down();
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await page.mouse.move(cell.x, cell.y, { steps: 8 });
  await page.mouse.up();

  const after = await getState(page);
  expect(after.tray).toEqual(before.tray);
  expect(after.board.cells[3]![4]).toBeNull();
});

test('Replay re-plays the last turn visually and leaves state and HUD untouched', async ({
  page,
}, testInfo) => {
  await load(page, MULTI_LANE);
  const replay = page.getByTestId('replay');
  await expect(replay).toBeDisabled(); // no turn played yet

  await page.evaluate(() => window.__GAME__!.endTurn());
  await expect(replay).toBeDisabled(); // not during playback
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await expect(replay).toBeEnabled();

  const state = await getState(page);
  const display = await getDisplay(page);

  await replay.click();
  expect(await isIdle(page)).toBe(false);
  await expect(replay).toBeDisabled();
  await expect(page.getByTestId('end-turn')).toBeDisabled();

  // Mid-replay: the pre-turn board is back on screen, but state and HUD haven't moved.
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: testInfo.outputPath('replay-mid.png') });
  expect(await getState(page)).toEqual(state);
  expect(await getDisplay(page)).toEqual(display);

  await page.evaluate(() => window.__GAME__!.skipAnimation());
  expect(await isIdle(page)).toBe(true);
  expect(await getState(page)).toEqual(state);
  expect(await getDisplay(page)).toEqual(display);
  await expect(replay).toBeEnabled();
});

test('legibility screenshots mid-playback (tile pop, exact kill)', async ({ page }, testInfo) => {
  const yaml = readFileSync(
    resolve('scenarios/core/exact-kill-order-of-operations.scenario.yaml'),
    'utf8',
  );
  await load(page, yaml);
  await page.waitForTimeout(300); // let settle tweens finish
  const start = Date.now();
  await page.evaluate(() => window.__GAME__!.endTurn());
  // With data/presentation.json pacing: the third tile pops at ~1.0 s, the exact kill at ~1.8 s.
  await page.waitForTimeout(Math.max(0, 1_060 - (Date.now() - start)));
  await page.screenshot({ path: testInfo.outputPath('playback-tile-pop.png') });
  await page.waitForTimeout(Math.max(0, 2_050 - (Date.now() - start)));
  await page.screenshot({ path: testInfo.outputPath('playback-exact-kill.png') });
});
