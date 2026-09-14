import { defineConfig, devices } from '@playwright/test';

// TR §16.1: WebKit, 1180×820 viewport, DPR 2, isMobile/hasTouch — closest Playwright iPad
// landscape descriptor as a base, with viewport/DPR overridden to the design space.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
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
  webServer: {
    command: 'VITE_TEST_HANDLE=1 npx vite build && npx vite preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
