import { defineConfig } from '@playwright/test';
import { FIXTURE_ORIGIN, REPO_ROOT } from './constants';

const isCi = Boolean(process.env.CI);

/**
 * Playwright configuration for the extension end-to-end suite.
 *
 * The extension is Chromium MV3 only, so a single project runs against a
 * persistent context that has the unpacked build loaded (see
 * `fixtures/extension.ts`). Tests run serially because every spec drives the one
 * shared extension instance and the bad-site fixture.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: isCi ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: FIXTURE_ORIGIN,
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium-extension' }],
  webServer: {
    command: 'node tests/fixtures/bad-site/server.ts',
    cwd: REPO_ROOT,
    url: `${FIXTURE_ORIGIN}/ok`,
    reuseExistingServer: !isCi,
    timeout: 30_000,
  },
});
