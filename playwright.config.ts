import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra o build de produção servido por `vite preview`.
 * O webServer é iniciado automaticamente pelo Playwright.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173',
    url: 'http://localhost:4173',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
