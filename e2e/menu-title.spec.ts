import { expect, test } from '@playwright/test';

test('main menu title is MATH VS ROBOTS with tiles, a slammed VS, and robots', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await expect(page.getByTestId('main-menu')).toBeVisible();

  const title = page.getByTestId('menu-title');
  await expect(title).toHaveAccessibleName('MATH VS ROBOTS');
  await expect(page.getByTestId('menu-title-tile')).toHaveCount(4);
  await expect(page.getByTestId('menu-title-robot')).toHaveCount(6);
  await expect(page.getByTestId('menu-title-vs')).toHaveText('VS');

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

  const math = await page.locator('.menu-title-math').boundingBox();
  const robots = await page.locator('.menu-title-robots').boundingBox();
  expect(math, 'MATH row').not.toBeNull();
  expect(robots, 'ROBOTS row').not.toBeNull();
  if (!math || !robots) return;
  expect(math.y + math.height).toBeGreaterThan(robots.y);
  expect(robots.y + robots.height).toBeGreaterThan(math.y);
  expect(math.x + math.width).toBeLessThan(robots.x);
  expect(robots.x - (math.x + math.width)).toBeGreaterThan(80);
});
