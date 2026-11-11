import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'public.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4301',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'corepack pnpm start --host 127.0.0.1 --port 4301',
    url: 'http://127.0.0.1:4301',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
