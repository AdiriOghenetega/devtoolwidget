import { resolve } from 'node:path';
import { DEFAULT_HOST, DEFAULT_PORT } from '../fixtures/bad-site/server.ts';

/** Repository root, derived from this file's location (`tests/e2e`). */
export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

/** Unpacked Chromium build the Playwright harness loads (see `pnpm build`). */
export const EXTENSION_PATH = resolve(REPO_ROOT, '.output', 'chrome-mv3');

/**
 * Minimal no-op MV3 extension (a single no-op `document_start` content script)
 * used by the `noop-content` ablation series to measure the fixed cost of
 * injecting any content script. Not part of the production build.
 */
export const NOOP_EXTENSION_PATH = resolve(REPO_ROOT, 'tests', 'benchmarks', 'noop-extension');

/** Port the bad-site fixture listens on, taken from the server's own default. */
export const FIXTURE_PORT = DEFAULT_PORT;

/** Origin of the bad-site fixture, used as Playwright's `baseURL`. */
export const FIXTURE_ORIGIN = `http://${DEFAULT_HOST}:${String(FIXTURE_PORT)}`;

/**
 * Match pattern for the fixture host. Match patterns ignore ports, so this
 * covers the fixture whatever port it runs on (G12).
 */
export const FIXTURE_HOST_PATTERN = `http://${DEFAULT_HOST}/*`;

/** Set to `1` to run the extension in a real (non-headless) browser window. */
export function isHeaded(): boolean {
  return process.env.E2E_HEADED === '1';
}
