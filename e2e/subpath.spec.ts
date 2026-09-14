import { expect, test } from '@playwright/test';

// Task 02 requirement 6: prove a production build works when served from a subpath, the
// shape PR previews are served at in production (mathtactics.timtsu.com/pr/pr-<N>/).
// Server is started by playwright.config.ts's second webServer entry: a plain build (no
// VITE_TEST_HANDLE) served by scripts/serve-subpath.ts under /pr/pr-0/ on its own port.
const SUBPATH_URL = 'http://localhost:4174/pr/pr-0/';

test('dist works when served from a subpath', async ({ page }) => {
  const failedRequests: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`(failed) ${request.url()} — ${request.failure()?.errorText}`);
  });

  await page.goto(SUBPATH_URL);
  await expect(page.locator('canvas')).toBeVisible();

  expect(failedRequests).toEqual([]);
});
