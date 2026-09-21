import { expect, test, type Page } from '@playwright/test';

// Task 34: the Add-to-Home-Screen hint. The WebKit project runs an iPad descriptor, so `isIOS()`
// is true and `isStandalone()` is false here — the exact case the hint is for.

async function gotoMenu(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();
}

test('offers the Home Screen hint on the menu in an iPad browser tab', async ({ page }) => {
  await gotoMenu(page);
  await expect(page.getByTestId('home-screen-hint')).toBeVisible();
  await expect(page.getByTestId('home-screen-hint')).toContainText('Add to Home Screen');
});

test('stays dismissed across a reload', async ({ page }) => {
  await gotoMenu(page);
  await page.getByTestId('home-screen-hint-dismiss').click();
  await expect(page.getByTestId('home-screen-hint')).not.toBeVisible();

  await page.reload();
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('home-screen-hint')).not.toBeVisible();
});

test('stays out of the way when already installed to the Home Screen', async ({ page }) => {
  // Standing in for an installed launch: iOS Safari sets `navigator.standalone` there, and the
  // page cannot be asked to report `display-mode: standalone` from a normal tab.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
  });

  await gotoMenu(page);
  await expect(page.getByTestId('home-screen-hint')).not.toBeVisible();
});
