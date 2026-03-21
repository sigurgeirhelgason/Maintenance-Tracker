// Playwright configuration for the Maintenance Tracker frontend.
//
// Prerequisites (run once from the `frontend/` directory):
//   npm install --save-dev @playwright/test
//   npx playwright install chromium
//
// Run all e2e tests:
//   TEST_USERNAME=you@example.com TEST_PASSWORD=secret npx playwright test
//
// Run just the vendor-select regression test:
//   TEST_USERNAME=you@example.com TEST_PASSWORD=secret npx playwright test e2e/editTask.spec.js
//
// Run headed (visible browser):
//   ... npx playwright test --headed
//
// Both the Vite dev server (port 3000) and the Django backend (port 8000) must be
// running before executing these tests.

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  // All test files live under frontend/e2e/
  testDir: './e2e',

  // Give each test up to 30 s before it is considered timed out.
  timeout: 30_000,

  // Retry once on CI to reduce flakiness from cold-start timing.
  retries: process.env.CI ? 1 : 0,

  use: {
    // Vite dev server address (port is set in vite.config.js).
    baseURL: 'http://localhost:3000',

    // Run headless by default; pass --headed on the CLI to see the browser.
    headless: true,

    // Capture a screenshot on failure for post-mortem debugging.
    screenshot: 'only-on-failure',

    // Record a video on failure.
    video: 'retain-on-failure',

    // Capture browser console logs (used by the test itself via page.on('console', ...)).
    // No extra flag needed — page.on() works regardless of this setting.
  },

  // Use a single Chromium worker by default so sessions don't interfere.
  workers: 1,

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  // Folder for test artifacts (screenshots, videos, traces).
  outputDir: './e2e/test-results',
});
