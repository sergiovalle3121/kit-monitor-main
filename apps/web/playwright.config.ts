import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, API_ORIGIN, SESSION_SECRET } from './e2e/fixtures/constants';

/**
 * Playwright config for the apps/web golden-path E2E suite.
 *
 * The suite runs against the real Next.js dev server but stubs the backend at
 * the network boundary (NEXT_PUBLIC_API_URL → API_ORIGIN, intercepted by the
 * in-memory fake in e2e/fixtures/mock-backend.ts). That keeps it hermetic and
 * deterministic: no NestJS, no database.
 *
 * Artifacts are written under e2e/ (and ignored via e2e/.gitignore) so we don't
 * have to touch the repo-root .gitignore.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // Generous upper bounds (NOT sleeps): `next dev` compiles routes on demand the
  // first time they're visited, which can spike under full-suite memory load.
  // Assertions still resolve in ms on the happy path; the bound only protects
  // against compile/GC jitter so the suite stays deterministic.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Point the client data layer at the intercepted fake-backend origin.
      NEXT_PUBLIC_API_URL: API_ORIGIN,
      // Sign session cookies with the same secret the test process uses.
      AXOS_SESSION_SECRET: SESSION_SECRET,
      PORT: '3000',
      BROWSER: 'none',
    },
  },
});
