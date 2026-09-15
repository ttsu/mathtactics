import { expect, test, type Page } from '@playwright/test';
import presentation from '../data/presentation.json' with { type: 'json' };
import { DESIGN_WIDTH } from '../game/state/designSpace';

// Task 15: run-mode playback — advance, detonation (with the ♥ count-down), spawn, waiting
// ghosts, and the planning-phase danger glow. Asserts on structured state (TR §14); screenshots
// are for the human legibility check only (written to the test's output dir under the gitignored
// `test-results/`, never committed).

const EMPTY = '. . . . . . . .';

/** A col-1 robot with more HP than the base has left: it detonates for its full remaining HP,
 * taking `baseHp` negative — exercises the display clamp at 0 (task 15 req. 3). */
const COL1_DETONATES = [
  'name: e2e col1 detonate clamps base HP display at 0',
  'mode: run',
  'baseValue: 0',
  'baseHp: 5',
  'board:',
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
  '  - ". R20 . . . . . ."',
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
].join('\n');

/** Two robots due in the same lane on the same turn: one spawns, one waits off-board as a ghost
 * (task 15 req. 4). */
const SPAWN_COLLISION = [
  'name: e2e waiting robot renders as a ghost',
  'mode: run',
  'baseValue: 0',
  'board:',
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
  'pendingSpawns:',
  '  - { turn: 2, lane: 1, hp: 3 }',
  '  - { turn: 2, lane: 1, hp: 3 }',
].join('\n');

/** Lane 0: a follower (col 2) advances into the detonator's (col 1) now-empty cell in the same
 * advance beat. A far-future pending spawn keeps the wave "open" so this stays a normal turn. */
const ADVANCE_AND_DETONATE = [
  'name: e2e advance and detonate',
  'mode: run',
  'baseValue: 0',
  'baseHp: 100',
  'board:',
  '  - ". R5 R3 . . . . ."',
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
  'pendingSpawns:',
  '  - { turn: 99, lane: 4, hp: 1 }',
].join('\n');

async function load(page: Page, yaml: string) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yaml);
}

/** A run in progress with robots, board tiles and tray tiles, a low base and some coins — the
 * board and HUD a New Run must not be played over. Its first robot is `robot:0` in lane 2, col 3:
 * the id a new run's first robot reuses, but far from where that one spawns. */
const OLD_RUN = [
  'name: e2e old run under a New Run',
  'mode: run',
  'baseValue: 1',
  'baseHp: 5',
  'coins: 17',
  'tray: [add:3, mul:2]',
  'board:',
  `  - "${EMPTY}"`,
  `  - "${EMPTY}"`,
  '  - "C +2 . R4 . . . ."',
  `  - "${EMPTY}"`,
  '  - ". . . . . R9 . ."',
  'pendingSpawns:',
  '  - { turn: 99, lane: 4, hp: 1 }',
].join('\n');

const getState = (page: Page) => page.evaluate(() => window.__GAME__!.getState()!);
const getDisplay = (page: Page) => page.evaluate(() => window.__GAME__!.getDisplay());
const isIdle = (page: Page) => page.evaluate(() => window.__GAME__!.isIdle());

test('a col-1 detonation counts the HUD base HP down and never shows below 0', async ({ page }) => {
  await load(page, COL1_DETONATES);
  const baseHpBefore = (await getDisplay(page)).baseHp;
  expect(baseHpBefore).toBe(5);

  await page.evaluate(() => window.__GAME__!.endTurn());
  // The HUD hasn't moved yet — its BaseDamaged beat hasn't played.
  expect((await getDisplay(page)).baseHp).toBe(baseHpBefore);
  expect(await isIdle(page)).toBe(false);

  await page.evaluate(() => window.__GAME__!.skipAnimation());
  const state = await getState(page);
  expect(state.baseHp).toBeLessThan(0);
  expect((await getDisplay(page)).baseHp).toBe(Math.max(0, state.baseHp));
  expect(await isIdle(page)).toBe(true);
});

test('a spawn collision leaves one robot on the board and one waiting as a ghost', async ({
  page,
}) => {
  await load(page, SPAWN_COLLISION);
  await page.evaluate(() => window.__GAME__!.endTurn());
  await page.evaluate(() => window.__GAME__!.skipAnimation());

  expect(await isIdle(page)).toBe(true);
  const state = await getState(page);
  expect(state.board.robots).toHaveLength(2);
  expect(state.board.robots).toContainEqual(expect.objectContaining({ lane: 1, col: 7 }));
  expect(state.board.robots).toContainEqual(expect.objectContaining({ lane: 1, col: null }));
});

test('Replay re-plays a run-mode turn (advance + detonate) without touching state or HUD', async ({
  page,
}) => {
  await load(page, ADVANCE_AND_DETONATE);
  const replay = page.getByTestId('replay');
  await expect(replay).toBeDisabled(); // no turn played yet

  await page.evaluate(() => window.__GAME__!.endTurn());
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await expect(replay).toBeEnabled();

  const state = await getState(page);
  const display = await getDisplay(page);
  expect(state.baseHp).toBe(95); // 100 - the col-1 robot's remaining HP (5)

  await replay.click();
  expect(await isIdle(page)).toBe(false);
  await expect(replay).toBeDisabled();
  await expect(page.getByTestId('end-turn')).toBeDisabled();

  // Mid-replay: state and HUD haven't moved even though the count-down beat is ticking visually.
  await page.waitForTimeout(700);
  expect(await getState(page)).toEqual(state);
  expect(await getDisplay(page)).toEqual(display);

  await page.evaluate(() => window.__GAME__!.skipAnimation());
  expect(await isIdle(page)).toBe(true);
  expect(await getState(page)).toEqual(state);
  expect(await getDisplay(page)).toEqual(display);
  await expect(replay).toBeEnabled();
});

test('newRun spawns the first wave and finishes playback on its own', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await page.waitForFunction(() => window.__GAME__ !== undefined);

  const result = await page.evaluate(() =>
    window.__GAME__!.dispatch({ type: 'newRun', seed: 'e2e-run-seed' }),
  );
  expect(result.ok).toBe(true);

  await page.waitForFunction(() => window.__GAME__!.isIdle(), undefined, { timeout: 10_000 });
  const state = await getState(page);
  expect(state!.mode).toBe('run');
  expect(state!.phase).toBe('planning');
});

test('legibility screenshots (advance, detonation mid-count, ghost robot, danger glow)', async ({
  page,
}, testInfo) => {
  // Danger glow: a robot already on column 1, in planning — no turn taken.
  await load(page, ADVANCE_AND_DETONATE);
  await page.waitForTimeout(350); // let the pulse rise off its minimum
  await page.screenshot({ path: testInfo.outputPath('danger-glow.png') });

  // Advance beat: both robots moving at once, ~200ms into the 400ms advance beat.
  const start = Date.now();
  await page.evaluate(() => window.__GAME__!.endTurn());
  await page.waitForTimeout(Math.max(0, 200 - (Date.now() - start)));
  await page.screenshot({ path: testInfo.outputPath('advance-beat.png') });

  // Detonation mid-count: the RobotDetonated flash beat (500ms) has played, the BaseDamaged
  // count-down (550ms) is under way.
  await page.waitForTimeout(Math.max(0, 1100 - (Date.now() - start)));
  await page.screenshot({ path: testInfo.outputPath('detonation-mid-count.png') });
  await page.evaluate(() => window.__GAME__!.skipAnimation());

  // Waiting ghost: at rest, just right of column 7.
  await load(page, SPAWN_COLLISION);
  await page.evaluate(() => window.__GAME__!.endTurn());
  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await page.waitForTimeout(100);
  await page.screenshot({ path: testInfo.outputPath('ghost-robot.png') });
});

/** The HUD ♥ glyph's centre in design points (TR §11.2: the design space maps onto the canvas),
 * measured on the ♥ character itself — the point the detonation number should fly to. */
const heartCenter = (page: Page) =>
  page.evaluate((designWidth) => {
    const stats = [...document.querySelectorAll('[data-testid="hud-bar"] .hud-stat')];
    const heart = stats.find((stat) => stat.textContent?.includes('♥'))!;
    const text = [...heart.childNodes].find((node) => node.textContent?.includes('♥'))!;
    const index = text.textContent!.indexOf('♥');
    const range = document.createRange();
    range.setStart(text, index);
    range.setEnd(text, index + 1);
    const glyph = range.getBoundingClientRect();
    const canvas = document.querySelector('#board-root canvas')!.getBoundingClientRect();
    const scale = canvas.width / designWidth;
    return {
      x: (glyph.left + glyph.width / 2 - canvas.left) / scale,
      y: (glyph.top + glyph.height / 2 - canvas.top) / scale,
      idle: window.__GAME__!.isIdle(),
    };
  }, DESIGN_WIDTH);

test('the detonation number flies to where ♥ really is, and ♥ holds still during playback', async ({
  page,
}) => {
  await load(page, COL1_DETONATES);
  const planning = await heartCenter(page);
  expect(planning.idle).toBe(true);

  await page.evaluate(() => window.__GAME__!.endTurn());
  // Mid count-down: the detonation beat has played and ♥ is ticking from 5 towards 0.
  await page.waitForFunction(() => window.__GAME__!.getDisplay().baseHp < 5);
  const counting = await heartCenter(page);
  expect(counting.idle).toBe(false);
  expect({ x: counting.x, y: counting.y }).toEqual({ x: planning.x, y: planning.y });

  const { heartTargetX, heartTargetY } = presentation.playback.detonate;
  expect(Math.abs(planning.x - heartTargetX)).toBeLessThanOrEqual(6);
  expect(Math.abs(planning.y - heartTargetY)).toBeLessThanOrEqual(6);
});

test('New Run after Home never plays over the previous board or HUD', async ({ page }) => {
  await load(page, OLD_RUN);
  const old = await getState(page);
  const oldRobot0 = old.board.robots.find((robot) => robot.robotId === 'robot:0')!;
  expect(oldRobot0).toMatchObject({ lane: 2, col: 3 });
  const oldRobot0At = await page.evaluate((cell) => window.__GAME__!.cellToClient(cell), {
    lane: oldRobot0.lane,
    col: oldRobot0.col!,
  });
  const before = await page.evaluate(() => window.__GAME__!.renderedBoard());
  expect(before.robots).toHaveLength(2);
  expect(before.tiles).toHaveLength(3);

  await page.getByTestId('home').click();
  await expect(page.getByTestId('main-menu')).toBeVisible();

  // Tap New Run and look at the board a frame later, while its spawn is still playing.
  const mid = await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('[data-testid="menu-new-run"]')!.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const game = window.__GAME__!;
    return {
      idle: game.isIdle(),
      board: game.renderedBoard(),
      state: game.getState()!,
      display: game.getDisplay(),
    };
  });
  expect(mid.idle).toBe(false);
  expect(mid.state.phase).toBe('planning');
  // Nothing from the old run is drawn: no tiles (a new run has none), only the new run's robots,
  // and nothing sitting where the old `robot:0` stood.
  expect(mid.board.tiles).toEqual([]);
  const newRobotIds = mid.state.board.robots.map((robot) => robot.robotId);
  for (const robot of mid.board.robots) {
    expect(newRobotIds).toContain(robot.robotId);
    const distance = Math.hypot(robot.x - oldRobot0At.x, robot.y - oldRobot0At.y);
    expect(distance).toBeGreaterThan(20);
  }
  // …and the HUD already reads the new run, not the old ♥ 5 / 🪙 17.
  expect(mid.display).toEqual({
    coins: mid.state.coins,
    baseHp: mid.state.baseHp,
    waveIndex: mid.state.waveIndex,
  });
  await expect(page.getByTestId('hud-bar')).toContainText(`♥ ${mid.state.baseHp}`);

  await page.evaluate(() => window.__GAME__!.skipAnimation());
  const state = await getState(page);
  expect(await getDisplay(page)).toEqual({
    coins: state.coins,
    baseHp: state.baseHp,
    waveIndex: state.waveIndex,
  });
  const after = await page.evaluate(() => window.__GAME__!.renderedBoard());
  expect(after.robots.map((robot) => robot.robotId).sort()).toEqual(
    state.board.robots.map((robot) => robot.robotId).sort(),
  );
  expect(after.tiles).toEqual([]);
});
