import { expect, test } from '@playwright/test';

async function gotoApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('#board-root canvas')).toBeVisible();
}

test('shows an update banner when the server has a newer build', async ({ page }) => {
  await page.route('**/version.json*', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ buildId: 'newer-build' }),
    });
  });

  await gotoApp(page);
  await expect(page.getByTestId('update-banner')).toBeVisible();
  await expect(page.getByTestId('update-reload')).toHaveText('Reload');
});

test('re-prompts after dismiss when the app becomes visible again', async ({ page }) => {
  await page.route('**/version.json*', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ buildId: 'newer-build' }),
    });
  });

  await gotoApp(page);
  await expect(page.getByTestId('update-banner')).toBeVisible();
  await page.getByTestId('update-dismiss').click();
  await expect(page.getByTestId('update-banner')).not.toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(page.getByTestId('update-banner')).toBeVisible();
});
