import { defineConfig, devices } from '@playwright/test';

// These checks run against the actual production bundle, not Vite's dev mode.
// In particular, a dev-only synthetic route must be unreachable in the build
// uploaded to GitHub Pages.
export default defineConfig({
  testDir: './tests/production',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  projects: [
    { name: 'production-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'production-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } }
  ],
  webServer: {
    command: 'npx vite preview --port=4175 --strictPort --host=127.0.0.1',
    url: 'http://127.0.0.1:4175/nbr-taxpay/',
    reuseExistingServer: false,
    timeout: 60_000
  }
});
