import { expect, test, type Page } from '@playwright/test';
import { MIN_TOUCH_TARGET } from '../game/state/designSpace';

// Task 14: save/resume, main menu, and ⌂ Home. Asserts on structured state (TR §14); screenshots
// are for the human legibility check only.

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

test('New Run autosaves; reload resumes in planning with no lost progress', async ({ page }) => {
  await openMenu(page);
  // Nothing to continue yet: New Run is the big button, Puzzles the small one, no Continue.
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
  await expectTouchTarget(page, 'menu-new-run');
  await expectTouchTarget(page, 'menu-puzzles');

  await page.getByTestId('menu-new-run').click();
  expect(await getScreen(page)).toBe('game');
  await waitIdle(page);
  const afterSpawn = await getState(page);
  expect(afterSpawn?.board.robots.length).toBeGreaterThan(0);

  await expectTouchTarget(page, 'end-turn');
  await page.getByTestId('end-turn').click();
  await waitIdle(page);
  const beforeReload = await getState(page);

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await expectTouchTarget(page, 'menu-continue');

  await page.getByTestId('menu-continue').click();
  expect(await getScreen(page)).toBe('game');
  expect(await getState(page)).toEqual(beforeReload);
  expect(await page.evaluate(() => window.__GAME__!.isIdle())).toBe(true);
});

test('Puzzles never touches the saved run; Home returns to it without confirmation', async ({
  page,
}) => {
  await openMenu(page);
  await page.getByTestId('menu-new-run').click();
  await waitIdle(page);
  const savedRun = await getState(page);

  await expectTouchTarget(page, 'home');
  await page.getByTestId('home').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toBeVisible();

  await page.getByTestId('menu-puzzles').click();
  expect(await getScreen(page)).toBe('game');
  expect((await getState(page))?.mode).toBe('level');

  await page.getByTestId('home').click();
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toBeVisible();

  await page.getByTestId('menu-continue').click();
  expect(await getState(page)).toEqual(savedRun);
});

test('reload mid-playback resumes in planning with the resolved state (no reload exploit)', async ({
  page,
}) => {
  await openMenu(page);
  await page.getByTestId('menu-new-run').click();
  await waitIdle(page);

  // Dispatch End Turn but do not skip its animation, then reload immediately — the resolved
  // state is already saved (TR §10.4: saved before playback finishes).
  await page.evaluate(() => window.__GAME__!.dispatch({ type: 'endTurn' }));
  const resolved = await getState(page);

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await page.getByTestId('menu-continue').click();

  expect(await getScreen(page)).toBe('game');
  expect(await getState(page)).toEqual(resolved);
  expect(await page.evaluate(() => window.__GAME__!.isIdle())).toBe(true);
});

test('a lost run is cleared: Continue disappears after its playback finishes', async ({
  page,
}, testInfo) => {
  await openMenu(page);
  await page.waitForTimeout(600); // let the pop-in finish before the screenshot
  await page.screenshot({ path: testInfo.outputPath('menu-no-continue.png') });

  const yaml = [
    'name: e2e run lost',
    'mode: run',
    'baseValue: 0',
    'baseHp: 5',
    'board:',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . ."',
    '  - ". R8 . . . . . ."',
    '  - ". . . . . . . ."',
    '  - ". . . . . . . ."',
    'waves:',
    '  - id: only-wave',
    '    spawns:',
    '      - { turn: 1, lane: 0, robot: basic, hp: [1, 1] }',
  ].join('\n');
  await page.evaluate((text) => window.__GAME__!.loadScenario(text), yaml);
  await page.evaluate(() => window.__GAME__!.dispatch({ type: 'endTurn' }));
  await page.evaluate(() => window.__GAME__!.skipAnimation());

  expect((await getState(page))?.phase).toBe('lost');
  expect(await getScreen(page)).toBe('lost');

  await page.reload();
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  expect(await getScreen(page)).toBe('menu');
  await expect(page.getByTestId('menu-continue')).toHaveCount(0);
});

test('every menu and HUD button is at least 60pt in both dimensions', async ({ page }) => {
  await openMenu(page);
  await page.waitForTimeout(600);
  await expectTouchTarget(page, 'menu-new-run');
  await expectTouchTarget(page, 'menu-puzzles');

  await page.getByTestId('menu-new-run').click();
  await waitIdle(page);
  for (const testId of ['home', 'replay', 'undo', 'end-turn']) {
    await expectTouchTarget(page, testId);
  }

  await page.getByTestId('home').click();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.waitForTimeout(600); // let the pop-in finish (it scales the buttons)
  await expectTouchTarget(page, 'menu-continue');
  await expectTouchTarget(page, 'menu-new-run');
  await expectTouchTarget(page, 'menu-puzzles');
});

test('⌂ Home hides in place during playback, so the HUD row never shifts', async ({ page }) => {
  await openMenu(page);
  await page.getByTestId('menu-new-run').click();
  await waitIdle(page);

  // Measured inside the page, a couple of frames after `dispatch`, in one go — so the "playback"
  // numbers are guaranteed to come from mid-playback, not from after it finished.
  const measureHud = (endTurnFirst: boolean) =>
    page.evaluate(async (endTurn) => {
      if (endTurn) window.__GAME__!.dispatch({ type: 'endTurn' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const bar = document.querySelector('[data-testid="hud-bar"]')!;
      const stats = [...bar.querySelectorAll<HTMLElement>('.hud-stat')];
      const origin = (element: Element | undefined) => {
        const rect = element!.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      };
      const home = bar.querySelector<HTMLButtonElement>('[data-testid="home"]')!;
      return {
        idle: window.__GAME__!.isIdle(),
        homeVisibility: getComputedStyle(home).visibility,
        homeDisabled: home.disabled,
        home: origin(home),
        dots: origin(bar.querySelector('[data-testid="level-dots"]')!),
        heart: origin(stats.find((stat) => stat.textContent?.includes('♥'))),
        coins: origin(stats.find((stat) => stat.textContent?.includes('🪙'))),
      };
    }, endTurnFirst);

  const planning = await measureHud(false);
  expect(planning).toMatchObject({ idle: true, homeVisibility: 'visible', homeDisabled: false });

  const playing = await measureHud(true);
  expect(playing).toMatchObject({ idle: false, homeVisibility: 'hidden', homeDisabled: true });
  // ♥/🪙 widths follow their digits, so origins are compared — nothing may slide sideways.
  expect({ ...playing, idle: true, homeVisibility: 'visible', homeDisabled: false }).toEqual(
    planning,
  );

  await page.evaluate(() => window.__GAME__!.skipAnimation());
  await waitIdle(page);
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.getByTestId('home')).toBeEnabled();
});
