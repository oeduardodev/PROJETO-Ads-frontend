import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.STAGING_BASE_URL;
if (!baseURL || !/^http:\/\/127\.0\.0\.1:8080$/u.test(baseURL)) {
  throw new Error('STAGING_BASE_URL must be the loopback local staging web origin');
}

export default defineConfig({
  testDir: './acceptance',
  fullyParallel: false,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
  },
});
