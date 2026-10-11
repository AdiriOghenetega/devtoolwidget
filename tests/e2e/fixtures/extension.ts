import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test as base, type BrowserContext, type Worker } from '@playwright/test';
import { EXTENSION_PATH, FIXTURE_HOST_PATTERN, isHeaded, NOOP_EXTENSION_PATH } from '../constants';

/** The extra fixtures the extension harness exposes to specs. */
export interface ExtensionFixtures {
  readonly context: BrowserContext;
  readonly extensionId: string;
  readonly serviceWorker: Worker;
  /** A persistent context with the minimal no-op baseline extension loaded. */
  readonly noopContext: BrowserContext;
  /** A persistent context with no extension at all (baseline reference). */
  readonly bareContext: BrowserContext;
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
 * Only the benchmark uses these (to toggle the agent/content series); every other
 * spec relies on the extension's own `SiteAccessService` registration, which the
 * test-side manifest overlay below pre-grants.
 */
export const CONTENT_SCRIPTS: readonly ContentScriptRegistration[] = [
  {
    id: 'devtoolwidget-agent',
    js: ['agent.js'],
    matches: [FIXTURE_HOST_PATTERN],
    runAt: 'document_start',
    world: 'MAIN',
    persistAcrossSessions: false,
  },
  {
    id: 'devtoolwidget-content',
    js: ['content-scripts/content.js'],
    matches: [FIXTURE_HOST_PATTERN],
    runAt: 'document_start',
    persistAcrossSessions: false,
  },
];

/**
 * Minimal `chrome.scripting` surface the harness drives from the worker.
 */
interface ExtensionGlobal {
  readonly chrome: {
    scripting: {
      getRegisteredContentScripts(): Promise<readonly { id: string }[]>;
    };
  };
}

/** Resolves the running MV3 service worker, waiting for it if it is still cold. */
async function firstServiceWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  return existing ?? (await context.waitForEvent('serviceworker'));
}

/**
 * Launches a persistent Chromium context with the given unpacked extension
 * loaded. Shared by the extension fixture and the no-op ablation baseline so
 * both use identical browser flags.
 */
export async function launchPersistentExtension(
  userDataDir: string,
  extensionPath: string,
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: !isHeaded(),
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
}

/** Launches a persistent Chromium context with no extension loaded. */
export async function launchBareContext(userDataDir: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: !isHeaded(),
    viewport: { width: 1280, height: 800 },
  });
}

/** Closes a persistent context and removes its profile directory. */
export async function closePersistentExtension(
  context: BrowserContext,
  userDataDir: string,
): Promise<void> {
  await context.close();
  rmSync(userDataDir, { recursive: true, force: true });
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
    const extensionPath = await prepareE2EExtension();
    const context = await launchPersistentExtension(userDataDir, extensionPath);
    try {
      await use(context);
    } finally {
      await closePersistentExtension(context, userDataDir);
    }
  },
  // eslint-disable-next-line no-empty-pattern
  noopContext: async ({}, use) => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'devtoolwidget-noop-'));
    const context = await launchPersistentExtension(userDataDir, NOOP_EXTENSION_PATH);
    try {
      await use(context);
    } finally {
      await closePersistentExtension(context, userDataDir);
    }
  },
  // eslint-disable-next-line no-empty-pattern
  bareContext: async ({}, use) => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'devtoolwidget-bare-'));
    const context = await launchBareContext(userDataDir);
    try {
      await use(context);
    } finally {
      await closePersistentExtension(context, userDataDir);
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

let overlayPromise: Promise<string> | undefined;

/**
 * Prepares the test-only extension build: a copy of the production output whose
 * manifest has the fixture host as an install-time `host_permissions` grant.
 *
 * Playwright cannot drive the native permission prompt, and Chromium offers no
 * supported way to grant an optional host to an unpacked extension at runtime
 * from outside the extension, so E2E exercises *post-grant* behaviour (per-origin
 * registration, injection, listing, revoke) on a pre-granted build. The
 * production build on disk is never modified — asserted in `specs/fr-15.spec.ts`.
 */
export function prepareE2EExtension(): Promise<string> {
  overlayPromise ??= Promise.resolve().then(() => {
    const dir = mkdtempSync(join(tmpdir(), 'devtoolwidget-e2e-ext-'));
    cpSync(EXTENSION_PATH, dir, { recursive: true });
    const manifestPath = join(dir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      host_permissions?: string[];
    };
    manifest.host_permissions = [...(manifest.host_permissions ?? []), FIXTURE_HOST_PATTERN];
    writeFileSync(manifestPath, JSON.stringify(manifest));
    return dir;
  });
  return overlayPromise;
}

/**
 * Waits until the extension's own `SiteAccessService` has registered the granted
 * origin's scripts (it registers on install/startup, asynchronously). Specs call
 * this before navigating instead of registering anything themselves.
 */
export async function waitForSiteScripts(serviceWorker: Worker, minCount = 2): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const count = (await registeredScriptIds(serviceWorker)).length;
    if (count >= minCount) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${String(minCount)} registered site scripts`);
}

/** The ids of every dynamically registered content script in the worker. */
export function registeredScriptIds(serviceWorker: Worker): Promise<readonly string[]> {
  return serviceWorker.evaluate(async () => {
    const api = (globalThis as unknown as ExtensionGlobal).chrome;
    return (await api.scripting.getRegisteredContentScripts()).map((script) => script.id);
  });
}

/** Reads the `channel` of every capture event persisted in `storage.session`. */
export function storedChannelNames(serviceWorker: Worker): Promise<string[]> {
  return serviceWorker.evaluate(async () => {
    const api = (
      globalThis as unknown as {
        chrome: {
          storage: { session: { get(keys: null): Promise<Record<string, unknown>> } };
        };
      }
    ).chrome;
    const stored = await api.storage.session.get(null);
    const channels: string[] = [];
    for (const entry of Object.values(stored)) {
      const session = (entry as { value?: { events?: readonly { channel?: unknown }[] } }).value;
      for (const event of session?.events ?? []) {
        if (typeof event.channel === 'string') {
          channels.push(event.channel);
        }
      }
    }
    return channels;
  });
}

/** Reads the `bodyPreview` of every persisted network event. */
export function storedNetworkBodyPreviews(serviceWorker: Worker): Promise<string[]> {
  return serviceWorker.evaluate(async () => {
    const api = (
      globalThis as unknown as {
        chrome: {
          storage: { session: { get(keys: null): Promise<Record<string, unknown>> } };
        };
      }
    ).chrome;
    const stored = await api.storage.session.get(null);
    const previews: string[] = [];
    for (const entry of Object.values(stored)) {
      const session = (
        entry as {
          value?: {
            events?: readonly {
              channel?: unknown;
              entry?: { bodyPreview?: unknown };
            }[];
          };
        }
      ).value;
      for (const event of session?.events ?? []) {
        const preview = event.channel === 'network' ? event.entry?.bodyPreview : undefined;
        if (typeof preview === 'string') {
          previews.push(preview);
        }
      }
    }
    return previews;
  });
}

/** Reads the total stored capture events and the max dropped count per tab. */
export function storedSessionStats(
  serviceWorker: Worker,
): Promise<{ readonly events: number; readonly dropped: number }> {
  return serviceWorker.evaluate(async () => {
    const api = (
      globalThis as unknown as {
        chrome: {
          storage: { session: { get(keys: null): Promise<Record<string, unknown>> } };
        };
      }
    ).chrome;
    const stored = await api.storage.session.get(null);
    let events = 0;
    let dropped = 0;
    for (const entry of Object.values(stored)) {
      const session = (entry as { value?: { events?: readonly unknown[]; dropped?: unknown } })
        .value;
      if (Array.isArray(session?.events)) {
        events += session.events.length;
      }
      if (typeof session?.dropped === 'number' && session.dropped > dropped) {
        dropped = session.dropped;
      }
    }
    return { events, dropped };
  });
}

export { expect };
