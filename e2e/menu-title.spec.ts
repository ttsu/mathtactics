import { expect, test } from '@playwright/test';

test('main menu title is MATH VS ROBOTS with tiles, a slammed VS, and robots', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();

  const title = page.getByTestId('menu-title');
  await expect(page).toHaveTitle('Math vs. Robots');
  await expect(title).toHaveAccessibleName('Math vs. Robots');
  const appleTitle = await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content');
  expect(appleTitle).toBe('Math vs. Robots');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest = (await (await page.request.get(new URL(manifestHref!, page.url()).href)).json()) as {
    name: string;
    short_name: string;
  };
  expect(manifest.name).toBe('Math vs. Robots');
  expect(manifest.short_name).toBe('Math vs. Robots');
  await expect(page.getByTestId('menu-title-tile')).toHaveCount(4);
  await expect(page.getByTestId('menu-title-robot')).toHaveCount(6);
  await expect(page.getByTestId('menu-title-vs')).toHaveText('VS');
  await expect(page.getByTestId('menu-hero')).toHaveCount(0);

  const tileLetters = await page.getByTestId('menu-title-tile').allTextContents();
  expect(tileLetters.map((text) => text.replace(/[^A-Z]/g, '')).join('')).toBe('MATH');
  const robotLetters = await page.locator('.menu-title-robot-body').allTextContents();
  expect(robotLetters.join('')).toBe('ROBOTS');

  const vsFont = await page
    .getByTestId('menu-title-vs')
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(vsFont).toMatch(/Permanent Marker/i);

  const vsAnimation = await page
    .getByTestId('menu-title-vs')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(vsAnimation).toBe('title-slam');

  const firstTileDelay = await page
    .getByTestId('menu-title-tile')
    .first()
    .evaluate((el) => getComputedStyle(el).animationDelay);
  const vsDelay = await page
    .getByTestId('menu-title-vs')
    .evaluate((el) => getComputedStyle(el).animationDelay);
  expect(Number.parseFloat(firstTileDelay)).toBeGreaterThan(Number.parseFloat(vsDelay));

  const mathLast = await page.getByTestId('menu-title-tile').last().boundingBox();
  const robotsFirst = await page.getByTestId('menu-title-robot').first().boundingBox();
  expect(mathLast, 'H tile').not.toBeNull();
  expect(robotsFirst, 'R robot').not.toBeNull();
  if (!mathLast || !robotsFirst) return;
  expect(mathLast.y + mathLast.height).toBeGreaterThan(robotsFirst.y);
  expect(robotsFirst.y + robotsFirst.height).toBeGreaterThan(mathLast.y);
  expect(mathLast.x + mathLast.width).toBeLessThan(robotsFirst.x);
  const gap = robotsFirst.x - (mathLast.x + mathLast.width);
  expect(gap).toBeGreaterThan(20);

  const mathFirst = await page.getByTestId('menu-title-tile').first().boundingBox();
  expect(mathFirst, 'M tile').not.toBeNull();
  if (!mathFirst) return;
  expect(mathFirst.x).toBeLessThan(160);

  const vs = await page.getByTestId('menu-title-vs').boundingBox();
  expect(vs, 'VS').not.toBeNull();
  if (!vs) return;
  expect(mathLast.x + mathLast.width).toBeGreaterThan(vs.x);
  expect(robotsFirst.x).toBeLessThan(vs.x + vs.width);
  expect(Math.abs(vs.x + vs.width / 2 - (mathLast.x + mathLast.width + gap / 2))).toBeLessThan(40);
});
