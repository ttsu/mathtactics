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

// Task 03: the manifest, its icons and the apple-touch-icon aren't fetched on page load, so
// resolve them explicitly — they must stay inside the preview's subpath.
test('manifest and icons resolve from a subpath', async ({ page }) => {
  await page.goto(SUBPATH_URL);

  const hrefs = await page
    .locator('link[rel="manifest"], link[rel="apple-touch-icon"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  expect(hrefs).toHaveLength(2);

  const manifestUrl = hrefs.find((href) => href.endsWith('.webmanifest')) ?? '';
  const manifest = (await (await page.request.get(manifestUrl)).json()) as {
    start_url: string;
    scope: string;
    icons: { src: string }[];
  };
  const urls = [
    ...hrefs,
    new URL(manifest.start_url, manifestUrl).href,
    ...manifest.icons.map((icon) => new URL(icon.src, manifestUrl).href),
  ];
  for (const url of urls) {
    expect(url.startsWith(SUBPATH_URL), url).toBe(true);
    expect((await page.request.get(url)).status(), url).toBe(200);
  }
  expect(new URL(manifest.scope, manifestUrl).href).toBe(SUBPATH_URL);
});
