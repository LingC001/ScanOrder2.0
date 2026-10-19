import { defineConfig, devices } from '@playwright/test';

const port = process.env.WEB_PORT ?? '4173';
const baseURL = process.env.WEB_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 7000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL,
    launchOptions: { channel: process.env.PLAYWRIGHT_CHANNEL },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node apps/api/dist/main.js',
      url: `${process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000'}/api/foods`,
      reuseExistingServer: false,
    },
    {
      command: `node apps/web/node_modules/vite/bin/vite.js preview apps/web --host 127.0.0.1 --port ${port}`,
      url: baseURL,
      reuseExistingServer: false,
    },
  ],
});
