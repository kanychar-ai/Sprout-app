// Playwright config — drives the Sprout app shell over a local static server.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 402, height: 874 }, // iPhone 17 Pro logical screen (mobile layout, no desktop bezel)
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'python3 -m http.server 5173',
    url: 'http://localhost:5173/app/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
