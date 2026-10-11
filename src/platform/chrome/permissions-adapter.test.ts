import { describe, expect, it, vi } from 'vitest';
import { createPermissionsPort, type PermissionsApi } from './permissions-adapter';

describe('createPermissionsPort', () => {
  it('converts host origins to any-port match patterns on the way in', async () => {
    const contains = vi.fn(() => Promise.resolve(true));
    const request = vi.fn(() => Promise.resolve(false));
    const remove = vi.fn(() => Promise.resolve(undefined));
    const listeners = new Set<(permissions: { origins?: readonly string[] }) => void>();
    const api: PermissionsApi = {
      permissions: {
        contains,
        request,
        remove,
        getAll: () => Promise.resolve({ origins: ['https://a.test/*'] }),
        onRemoved: {
          addListener: (listener) => listeners.add(listener),
          removeListener: (listener) => listeners.delete(listener),
        },
      },
    };
    const port = createPermissionsPort(api);

    expect(await port.contains(['https://a.test:8443'])).toEqual({ ok: true, value: true });
    expect(contains).toHaveBeenCalledWith({ origins: ['https://a.test/*'] });
    await port.request(['https://a.test']);
    expect(request).toHaveBeenCalledWith({ origins: ['https://a.test/*'] });
    await port.remove(['https://a.test']);
    expect(remove).toHaveBeenCalledWith({ origins: ['https://a.test/*'] });

    const observed = vi.fn();
    const unsubscribe = port.onRemoved(observed);
    for (const listener of [...listeners]) {
      listener({ origins: ['https://b.test/*', '<all_urls>'] });
    }
    unsubscribe();
    expect(observed).toHaveBeenCalledWith(['https://b.test']);
    expect(listeners.size).toBe(0);
  });

  it('converts patterns back to host origins and drops wildcards', async () => {
    const api: PermissionsApi = {
      permissions: {
        contains: () => Promise.resolve(true),
        request: () => Promise.resolve(true),
        remove: () => Promise.resolve(undefined),
        getAll: () =>
          Promise.resolve({ origins: ['https://a.test/*', '<all_urls>', 'http://*/*'] }),
        onRemoved: { addListener: () => undefined, removeListener: () => undefined },
      },
    };
    const port = createPermissionsPort(api);

    expect(await port.getAll()).toEqual({ ok: true, value: ['https://a.test'] });
  });

  it('defaults to an empty origin list and maps failures to errors', async () => {
    const api: PermissionsApi = {
      permissions: {
        contains: () => Promise.reject(new Error('Permission denied')),
        request: () => Promise.resolve(true),
        remove: () => Promise.resolve(undefined),
        getAll: () => Promise.resolve({}),
        onRemoved: { addListener: () => undefined, removeListener: () => undefined },
      },
    };
    const port = createPermissionsPort(api);

    expect(await port.getAll()).toEqual({ ok: true, value: [] });
    const failed = await port.contains(['https://a.test']);
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.code).toBe('permission-denied');
    }
  });
});
