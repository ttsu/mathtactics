import { defineConfig, devices } from '@playwright/test';

// TR §16.1: WebKit, 1180×820 viewport, DPR 2, isMobile/hasTouch — closest Playwright iPad
// landscape descriptor as a base, with viewport/DPR overridden to the design space.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // 'list' for readable local/CI console output; 'html' (never auto-opened) so
  // playwright-report/ actually exists for ci.yml's on-failure artifact upload — 'list' alone
  // writes no report directory at all, which would leave that step no-op/empty.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'webkit',
      use: {
        ...devices['iPad (gen 11) landscape'],
        viewport: { width: 1180, height: 820 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: 'VITE_TEST_HANDLE=1 npx vite build && npx vite preview --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    // Subpath verification server (task 02 req. 6): a plain build (no test handle, own
    // outDir so it can't race with the build above) served mounted under /pr/pr-0/ — the
    // shape a real PR preview is served at in production. See e2e/subpath.spec.ts.
    {
      command:
        'npx vite build --outDir dist-subpath-test && npx tsx scripts/serve-subpath.ts --dir dist-subpath-test --port 4174 --prefix /pr/pr-0/',
      url: 'http://localhost:4174/pr/pr-0/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
