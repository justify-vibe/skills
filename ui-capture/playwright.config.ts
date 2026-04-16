import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.UI_CAPTURE_PORT || 5178);
const ROOT_URL = process.env.UI_CAPTURE_BASE_URL || `http://localhost:${PORT}`;
const PING_URL = process.env.UI_CAPTURE_URL || `${ROOT_URL}/index.html`;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: ROOT_URL,
    video: { mode: 'on', size: { width: 1170, height: 2532 } },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    launchOptions: { slowMo: Number(process.env.UI_CAPTURE_SLOWMO || 50) },
  },
  webServer: process.env.UI_CAPTURE_NO_SERVER ? undefined : {
    command: process.env.UI_CAPTURE_SERVE || 'node scripts/serve-static.js',
    url: PING_URL,
    timeout: 30_000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'iphone-15-pro-3x',
      use: {
        ...devices['iPhone 15 Pro'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'pixel-7-pro-3x',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 3,
      },
    },
  ],
  outputDir: 'playwright-artifacts',
});
