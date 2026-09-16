import { expect, test, type Page } from '@playwright/test';
import { BOARD_AREA, WORLD_HEIGHT, WORLD_WIDTH } from '../game/board/layout';
import { DESIGN_HEIGHT, DESIGN_WIDTH, MIN_TOUCH_TARGET } from '../game/state/designSpace';

// Task 03: Phaser/React layering, scaling and web shell. Runs before the test handle exists
// (task 05), so Phaser positions are derived from the canvas's client rect + layout constants.

const LANDSCAPE_SIZES = [
  { width: 1180, height: 820 },
  { width: 1366, height: 1024 },
  { width: 844, height: 390 },
];
const ALIGN_TOLERANCE_PX = 2;

async function canvasRect(page: Page) {
  const box = await page.locator('#board-root canvas').boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  return box;
}

/** Client position of design point (x, y) on the Phaser canvas. */
async function phaserPointToClient(page: Page, x: number, y: number) {
  const canvas = await canvasRect(page);
  const scale = canvas.width / DESIGN_WIDTH;
  return { x: canvas.x + x * scale, y: canvas.y + y * scale };
}

async function hudAnchorOffsets(page: Page) {
  const hud = await page.getByTestId('hud-bar').boundingBox();
  if (!hud) throw new Error('hud bar has no bounding box');
  // The HUD bar's bottom edge meets the top edge of the Phaser board area.
  const left = await phaserPointToClient(page, BOARD_AREA.x, BOARD_AREA.y);
  const right = await phaserPointToClient(page, BOARD_AREA.x + BOARD_AREA.width, BOARD_AREA.y);
  return [
    Math.abs(hud.x - left.x),
    Math.abs(hud.y + hud.height - left.y),
    Math.abs(hud.x + hud.width - right.x),
    Math.abs(hud.y + hud.height - right.y),
  ];
}

async function gotoApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
  await expect(page.locator('#ui-root')).toBeVisible();
}

/** Opens the app and taps ▶ Play on the main menu (task 11), so the HUD and board are showing. */
async function gotoGame(page: Page) {
  await gotoApp(page);
  await page.getByTestId('menu-puzzles').click();
  await expect(page.getByTestId('hud-bar')).toBeVisible();
}

test('canvas fills the 1180×820 viewport at 2× world resolution', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await gotoApp(page);

  const canvas = await canvasRect(page);
  expect(canvas.x).toBeCloseTo(0, 0);
  expect(canvas.y).toBeCloseTo(0, 0);
  expect(canvas.width).toBeCloseTo(1180, 0);
  expect(canvas.height).toBeCloseTo(820, 0);

  const backing = await page
    .locator('#board-root canvas')
    .evaluate((el: HTMLCanvasElement) => ({ width: el.width, height: el.height }));
  expect(backing).toEqual({ width: WORLD_WIDTH, height: WORLD_HEIGHT });
});

for (const size of LANDSCAPE_SIZES) {
  test(`board is letterboxed, undistorted and HUD-aligned at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await gotoGame(page);

    const canvas = await canvasRect(page);
    // Undistorted: design aspect ratio preserved.
    expect(canvas.width / canvas.height).toBeCloseTo(DESIGN_WIDTH / DESIGN_HEIGHT, 2);
    // Letterboxed: fits inside the viewport, fills one dimension, centred in the other.
    expect(canvas.width).toBeLessThanOrEqual(size.width + 0.5);
    expect(canvas.height).toBeLessThanOrEqual(size.height + 0.5);
    const fillsOne =
      Math.abs(canvas.width - size.width) < 1 || Math.abs(canvas.height - size.height) < 1;
    expect(fillsOne).toBe(true);
    expect(Math.abs(canvas.x - (size.width - canvas.width) / 2)).toBeLessThan(1);
    expect(Math.abs(canvas.y - (size.height - canvas.height) / 2)).toBeLessThan(1);

    for (const offset of await hudAnchorOffsets(page)) {
      expect(offset).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
    }
    await expect(page.getByTestId('rotate-overlay')).toHaveCount(0);
  });
}

test('HUD re-aligns after a live resize', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await gotoGame(page);
  await page.setViewportSize({ width: 844, height: 390 });

  await expect
    .poll(async () => Math.max(...(await hudAnchorOffsets(page))))
    .toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
  expect((await canvasRect(page)).height).toBeCloseTo(390, 0);
});

test.describe('iOS frame backdrop', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  test('stretches full width beside a height-limited canvas', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await gotoGame(page);

    const canvas = await canvasRect(page);
    const backdrop = page.getByTestId('frame-backdrop');
    await expect(backdrop).toBeVisible();

    const box = await backdrop.boundingBox();
    expect(box).toEqual({
      x: 0,
      y: canvas.y,
      width: 1600,
      height: canvas.height,
    });
    await expect(backdrop).toHaveCSS('background-image', /linear-gradient/);
  });

  test('stays hidden when the canvas already fills the viewport width', async ({ page }) => {
    for (const size of LANDSCAPE_SIZES) {
      await page.setViewportSize(size);
      await gotoGame(page);
      await expect(page.getByTestId('frame-backdrop')).toBeHidden();
    }
  });
});

test('rotate overlay covers the screen in portrait', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await gotoApp(page);

  const overlay = page.getByTestId('rotate-overlay');
  await expect(overlay).toBeVisible();
  expect(await overlay.boundingBox()).toEqual({ x: 0, y: 0, width: 820, height: 1180 });
  await expect(overlay).toHaveText('');
});

test('End Turn button is at least 60pt in both dimensions', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await gotoGame(page);

  const button = page.getByTestId('end-turn');
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
});

test('web shell metas and manifest are present, with relative start_url and scope', async ({
  page,
}) => {
  await gotoApp(page);

  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);

  const touchIconHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const touchIcon = await page.request.get(new URL(touchIconHref ?? '', page.url()).href);
  expect(touchIcon.status()).toBe(200);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(manifestHref ?? '', page.url()).href;
  const manifestResponse = await page.request.get(manifestUrl);
  expect(manifestResponse.status()).toBe(200);
  const manifest = (await manifestResponse.json()) as {
    start_url: string;
    scope: string;
    display: string;
    orientation: string;
    icons: { src: string; sizes: string }[];
  };
  expect(manifest).toMatchObject({
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'landscape',
  });
  expect(manifest.icons.map((icon) => icon.sizes).sort()).toEqual(['192x192', '512x512']);
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, manifestUrl).href);
    expect(response.status()).toBe(200);
  }

  const shellCss = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return {
      position: style.position,
      overflow: style.overflow,
      touchAction: style.touchAction,
      userSelect: style.webkitUserSelect,
    };
  });
  expect(shellCss).toEqual({
    position: 'fixed',
    overflow: 'clip',
    touchAction: 'none',
    userSelect: 'none',
  });
});
