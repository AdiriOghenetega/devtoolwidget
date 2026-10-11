import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test as base, type BrowserContext, type Worker } from '@playwright/test';
import { EXTENSION_PATH, isHeaded } from '../constants';

/** The extra fixtures the extension harness exposes to specs. */
export interface ExtensionFixtures {
  readonly context: BrowserContext;
  readonly extensionId: string;
  readonly serviceWorker: Worker;
}

/** One `chrome.scripting.registerContentScripts` descriptor. */
export interface ContentScriptRegistration {
  readonly id: string;
  readonly js: readonly string[];
  readonly matches: readonly string[];
  readonly runAt: 'document_start';
  readonly world?: 'MAIN';
  readonly persistAcrossSessions: boolean;
}

/**
 * The extension's two runtime-registered bundles, as emitted by the WXT build.
 * They are registered from the worker in tests because WXT only adds
 * `registration: 'runtime'` scripts to the store, never to the static manifest.
 */
export const CONTENT_SCRIPTS: readonly ContentScriptRegistration[] = [
  {
    id: 'devtoolwidget-agent',
    js: ['agent.js'],
    matches: ['<all_urls>'],
    runAt: 'document_start',
    world: 'MAIN',
    persistAcrossSessions: false,
  },
  {
    id: 'devtoolwidget-content',
    js: ['content-scripts/content.js'],
    matches: ['<all_urls>'],
    runAt: 'document_start',
    persistAcrossSessions: false,
  },
];

/** Minimal `chrome.scripting` surface the harness drives from the worker. */
interface ScriptingGlobal {
  readonly chrome: {
    scripting: {
      registerContentScripts(scripts: readonly ContentScriptRegistration[]): Promise<void>;
    };
  };
}

/** Resolves the running MV3 service worker, waiting for it if it is still cold. */
async function firstServiceWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  return existing ?? (await context.waitForEvent('serviceworker'));
}

/**
 * The extension test fixture. It replaces Playwright's `context` with a
 * persistent Chromium context that has the unpacked build loaded, then exposes
 * the worker and its extension id.
 */
export const test = base.extend<ExtensionFixtures>({
  // Playwright requires the first fixture argument to be a destructuring
  // pattern; this fixture depends on nothing.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'devtoolwidget-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: !isHeaded(),
      viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    try {
      await use(context);
    } finally {
      await context.close();
      rmSync(userDataDir, { recursive: true, force: true });
    }
  },
  extensionId: async ({ context }, use) => {
    const worker = await firstServiceWorker(context);
    await use(new URL(worker.url()).host);
  },
  serviceWorker: async ({ context }, use) => {
    await use(await firstServiceWorker(context));
  },
});

/**
 * Registers the extension's runtime content scripts from the MV3 worker so they
 * inject on the next navigation. Needed by every spec that observes the
 * in-page widget; the extension does not self-register these yet.
 */
export async function registerExtensionScripts(serviceWorker: Worker): Promise<void> {
  await serviceWorker.evaluate(async (scripts) => {
    const api = (globalThis as unknown as ScriptingGlobal).chrome;
    await api.scripting.registerContentScripts(scripts);
  }, CONTENT_SCRIPTS);
}

export { expect };
