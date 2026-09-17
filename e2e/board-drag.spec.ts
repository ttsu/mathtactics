import { expect, test, type Page } from '@playwright/test';
import { traySlotCenter } from '../game/board/layout';
import { DESIGN_WIDTH } from '../game/state/designSpace';
import type { Cell } from '../sim/core/coords';

// Task 09 req. 6: real pointer (mouse) and touch drags on the Phaser board, located via
// `__GAME__.cellToClient`, asserting on structured state (TR §14).

const SCENARIO = [
  'name: e2e board drag',
  'baseValue: 3',
  'tray: [add:4, mul:3, sub:2]',
  'board:',
  '  - ". +5 . . . R7 . ."', // lane 0: a tile on (0,1); robot locks (0,5)
  '  - "C +2 . . . . . ."', // lane 1: cannon, a tile on (1,1)
  '  - ". . . . R9 . -2 ."', // lane 2: robot locks (2,4); (2,6) occupied; (1,4)/(1,6) empty
  '  - ". . . . . . . ."',
  '  - ". . . . . . . ."',
].join('\n');

type Pt = { x: number; y: number };

async function loadBoard(page: Page) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), SCENARIO);
}

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

/** Real mouse events (Phaser's MouseManager) — press, move in steps, release. */
async function mouseDrag(page: Page, from: Pt, to: Pt) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** Touch events dispatched on the canvas (Phaser's TouchManager). Playwright has no touch-drag
 * API and WebKit has no `Touch` constructor, so the touches come from WebKit's
 * `document.createTouch`/`createTouchList` and are delivered as real `TouchEvent`s. */
type TouchEnd = 'touchend' | 'touchcancel' | 'none';

async function dispatchTouch(
  page: Page,
  from: Pt,
  to: Pt,
  { end = 'touchend', identifier = 1 }: { end?: TouchEnd; identifier?: number } = {},
) {
  await page.evaluate(
    ({ from, to, end, identifier }) => {
      // WebKit's legacy factories — the only way to build a `Touch`/`TouchList` there.
      type LegacyTouchDocument = Document & {
        createTouch(
          view: Window,
          target: EventTarget,
          identifier: number,
          pageX: number,
          pageY: number,
          screenX: number,
          screenY: number,
        ): Touch;
        createTouchList(...touches: Touch[]): TouchList;
      };
      const doc = document as LegacyTouchDocument;
      const canvas = document.querySelector('#board-root canvas')!;
      const fire = (type: string, p: { x: number; y: number }, active: boolean) => {
        const touch = doc.createTouch(window, canvas, identifier, p.x, p.y, p.x, p.y);
        const current = active ? doc.createTouchList(touch) : doc.createTouchList();
        canvas.dispatchEvent(
          new TouchEvent(type, {
            touches: current as unknown as Touch[],
            targetTouches: current as unknown as Touch[],
            changedTouches: doc.createTouchList(touch) as unknown as Touch[],
            bubbles: true,
            cancelable: true,
          }),
        );
      };
      fire('touchstart', from, true);
      if (end === 'none') return;
      const steps = 8;
      for (let i = 1; i <= steps; i += 1) {
        fire(
          'touchmove',
          { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps },
          true,
        );
      }
      fire(end, to, false);
    },
    { from, to, end, identifier },
  );
}

async function touchDrag(
  page: Page,
  from: Pt,
  to: Pt,
  { end = 'touchend' }: { end?: Exclude<TouchEnd, 'none'> } = {},
) {
  await dispatchTouch(page, from, to, { end });
}

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState()!);

test('dragging a tray tile onto a cell places it (mouse)', async ({ page }) => {
  await loadBoard(page);
  const before = await getState(page);
  const pieceId = before.tray[0]!;

  await mouseDrag(page, await trayPoint(page, 0), await cellPoint(page, { lane: 2, col: 3 }));

  const after = await getState(page);
  expect(after.board.cells[2]![3]).toBe(pieceId);
  expect(after.tray).not.toContain(pieceId);
  expect(after.undo).toHaveLength(1);
});

test('dragging a tray tile onto a cell places it (touch)', async ({ page }) => {
  await loadBoard(page);
  const pieceId = (await getState(page)).tray[1]!;

  await touchDrag(page, await trayPoint(page, 1), await cellPoint(page, { lane: 3, col: 6 }));

  const after = await getState(page);
  expect(after.board.cells[3]![6]).toBe(pieceId);
  expect(after.tray).not.toContain(pieceId);
});

test('dropping onto a locked or occupied cell changes nothing and is not re-routed', async ({
  page,
}) => {
  await loadBoard(page);
  const before = await getState(page);

  // Middle-lane targets with an empty cell directly above each: the finger's cell alone decides.
  await mouseDrag(page, await trayPoint(page, 0), await cellPoint(page, { lane: 2, col: 4 }));
  await touchDrag(page, await trayPoint(page, 0), await cellPoint(page, { lane: 2, col: 6 }));
  await mouseDrag(
    page,
    await cellPoint(page, { lane: 1, col: 1 }),
    await cellPoint(page, { lane: 0, col: 5 }),
  );

  expect(await getState(page)).toEqual(before);
  await expect(page.getByTestId('undo')).toBeDisabled();
});

test('a cancelled touch abandons the drag instead of dropping', async ({ page }) => {
  await loadBoard(page);
  const before = await getState(page);

  await touchDrag(page, await trayPoint(page, 0), await cellPoint(page, { lane: 3, col: 3 }), {
    end: 'touchcancel',
  });

  expect(await getState(page)).toEqual(before);
});

test('an orphaned touchstart does not freeze later tile drags', async ({ page }) => {
  await loadBoard(page);
  const start = await trayPoint(page, 0);
  await dispatchTouch(page, start, start, { end: 'none' });

  const pieceId = (await getState(page)).tray[1]!;
  await touchDrag(page, await trayPoint(page, 1), await cellPoint(page, { lane: 3, col: 6 }));

  const after = await getState(page);
  expect(after.board.cells[3]![6]).toBe(pieceId);
  expect(after.tray).not.toContain(pieceId);
});

test('a mouse press left down does not freeze later touch drags', async ({ page }) => {
  await loadBoard(page);
  const start = await trayPoint(page, 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  const pieceId = (await getState(page)).tray[1]!;
  await touchDrag(page, await trayPoint(page, 1), await cellPoint(page, { lane: 3, col: 6 }));

  const after = await getState(page);
  expect(after.board.cells[3]![6]).toBe(pieceId);
  expect(after.tray).not.toContain(pieceId);
});

test('a cancelled touch does not freeze a later drag', async ({ page }) => {
  await loadBoard(page);
  await touchDrag(page, await trayPoint(page, 0), await cellPoint(page, { lane: 3, col: 3 }), {
    end: 'touchcancel',
  });

  const pieceId = (await getState(page)).tray[1]!;
  await touchDrag(page, await trayPoint(page, 1), await cellPoint(page, { lane: 4, col: 2 }));

  const after = await getState(page);
  expect(after.board.cells[4]![2]).toBe(pieceId);
});

test('Undo restores the board and disables itself when history is empty', async ({ page }) => {
  await loadBoard(page);
  const before = await getState(page);
  const undo = page.getByTestId('undo');
  await expect(undo).toBeDisabled();

  await mouseDrag(page, await trayPoint(page, 2), await cellPoint(page, { lane: 4, col: 2 }));
  await expect(undo).toBeEnabled();
  await undo.click();

  const after = await getState(page);
  expect(after.board).toEqual(before.board);
  expect(after.tray).toEqual(before.tray);
  await expect(undo).toBeDisabled();
});

test('cell tiles move between cells and back to the tray; cannons move between slots', async ({
  page,
}) => {
  await loadBoard(page);
  const tileOnBoard = (await getState(page)).board.cells[1]![1]!;

  await touchDrag(
    page,
    await cellPoint(page, { lane: 1, col: 1 }),
    await cellPoint(page, { lane: 3, col: 4 }),
  );
  let state = await getState(page);
  expect(state.board.cells[1]![1]).toBeNull();
  expect(state.board.cells[3]![4]).toBe(tileOnBoard);

  await mouseDrag(page, await cellPoint(page, { lane: 3, col: 4 }), await trayPoint(page, 5));
  state = await getState(page);
  expect(state.board.cells[3]![4]).toBeNull();
  expect(state.tray.at(-1)).toBe(tileOnBoard);

  await touchDrag(
    page,
    await cellPoint(page, { lane: 1, col: 0 }),
    await cellPoint(page, { lane: 4, col: 0 }),
  );
  state = await getState(page);
  expect(state.board.cannons).toEqual([false, false, false, false, true]);
});

test('a tile under a robot cannot be picked up, and a tap in place dispatches nothing', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.evaluate(
    (text) => window.__GAME__!.loadScenario(text),
    SCENARIO.replace('R7 ', 'R7[x3] '),
  );
  const before = await getState(page);

  await mouseDrag(
    page,
    await cellPoint(page, { lane: 0, col: 5 }),
    await cellPoint(page, { lane: 2, col: 2 }),
  );
  const tile = await cellPoint(page, { lane: 1, col: 1 });
  await mouseDrag(page, tile, tile);

  expect(await getState(page)).toEqual(before);
});

test('a second pointer is ignored while a drag is in progress', async ({ page }) => {
  await loadBoard(page);
  const before = await getState(page);
  const first = before.tray[0]!;

  // Mouse starts a real drag of tray tile 0 (moved off the press point); meanwhile a
  // touch tries to drag tray tile 1 elsewhere and must be ignored.
  const start = await trayPoint(page, 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y + 20, { steps: 4 });
  await touchDrag(page, await trayPoint(page, 1), await cellPoint(page, { lane: 3, col: 3 }));
  const target = await cellPoint(page, { lane: 2, col: 2 });
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();

  const after = await getState(page);
  expect(after.board.cells[3]![3]).toBeNull();
  expect(after.board.cells[2]![2]).toBe(first);
  expect(after.undo).toHaveLength(1);
});

test('End Turn resolves the turn and the board re-syncs', async ({ page }) => {
  await loadBoard(page);
  await mouseDrag(page, await trayPoint(page, 0), await cellPoint(page, { lane: 1, col: 2 }));

  await page.getByTestId('end-turn').click();

  const state = await getState(page);
  expect(state.lastTurnEvents.length).toBeGreaterThan(0);
  expect(state.undo).toEqual([]);
  // The turn plays back first (task 10); skip it, then planning resumes.
  expect(await page.evaluate(() => window.__GAME__!.isIdle())).toBe(false);
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  expect(await page.evaluate(() => window.__GAME__!.isIdle())).toBe(true);
  await expect(page.getByTestId('undo')).toBeDisabled();
  await expect(page.getByTestId('end-turn')).toBeEnabled();
});

test('legibility screenshot of a loaded board', async ({ page }, testInfo) => {
  await loadBoard(page);
  await page.waitForTimeout(300); // let settle tweens finish
  await page.screenshot({ path: testInfo.outputPath('board-legibility.png') });
});
