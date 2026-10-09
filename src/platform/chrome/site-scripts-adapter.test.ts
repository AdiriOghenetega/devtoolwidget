import { describe, expect, it } from 'vitest';
import type { SiteScriptDescriptor } from '../ports/site-scripts';
import { createSiteScriptsPort, type SiteScriptsApi } from './site-scripts-adapter';

const descriptors: readonly SiteScriptDescriptor[] = [
  {
    id: 'dwsite:content:https://a.test',
    matches: ['https://a.test/*'],
    js: ['content-scripts/content.js'],
    runAt: 'document_start',
  },
  {
    id: 'dwsite:agent:https://a.test',
    matches: ['https://a.test/*'],
    js: ['agent.js'],
    runAt: 'document_start',
    world: 'MAIN',
  },
];

function createApi(): { readonly api: SiteScriptsApi; readonly store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  const api: SiteScriptsApi = {
    scripting: {
      registerContentScripts: (scripts) => {
        for (const script of scripts) {
          store.set((script as { id: string }).id, script);
        }
        return Promise.resolve(undefined);
      },
      unregisterContentScripts: (filter) => {
        for (const id of filter?.ids ?? []) {
          store.delete(id);
        }
        return Promise.resolve(undefined);
      },
      getRegisteredContentScripts: () => Promise.resolve([...store.values()]),
    },
  };
  return { api, store };
}

describe('createSiteScriptsPort', () => {
  it('registers, lists and unregisters scripts', async () => {
    const { api, store } = createApi();
    const port = createSiteScriptsPort(api);

    expect((await port.register(descriptors)).ok).toBe(true);
    expect(store.size).toBe(2);

    const listed = await port.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.map((script) => script.id)).toContain(descriptors[1]?.id);
    }

    expect((await port.unregister([descriptors[0]?.id ?? ''])).ok).toBe(true);
    expect(store.size).toBe(1);
  });

  it('skips empty registration and unregistration, and tolerates malformed entries', async () => {
    const { api, store } = createApi();
    store.set('garbage', { nope: true });
    const port = createSiteScriptsPort(api);

    expect((await port.register([])).ok).toBe(true);
    expect((await port.unregister([])).ok).toBe(true);

    const listed = await port.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value[0]).toEqual({ id: '', matches: [] });
    }
  });

  it('maps registration failures to errors', async () => {
    const api: SiteScriptsApi = {
      scripting: {
        registerContentScripts: () => Promise.reject(new Error('is not a function')),
        unregisterContentScripts: () => Promise.resolve(undefined),
        getRegisteredContentScripts: () => Promise.resolve([]),
      },
    };
    const failed = await createSiteScriptsPort(api).register(descriptors);
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.code).toBe('unsupported');
    }
  });
});
