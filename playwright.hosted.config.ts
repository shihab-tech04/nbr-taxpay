import { defineConfig, devices } from '@playwright/test';

const liveUrl = process.env.TAXPAY_HOSTED_BENEFICIARIES_URL;
if (!liveUrl) throw new Error('TAXPAY_HOSTED_BENEFICIARIES_URL is required.');
const target = new URL(liveUrl);
if (target.protocol !== 'https:' || target.hostname !== 'shihab-tech04.github.io' || target.pathname !== '/nbr-taxpay/') {
  throw new Error('Hosted acceptance is restricted to the deployed Korbritto TaxPay Pages root.');
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'beneficiaries-guest-hosted.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: target.href,
    trace: 'off',
  },
  projects: [
    {
      name: 'hosted-mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
});
