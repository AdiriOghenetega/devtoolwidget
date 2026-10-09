import { describe, expect, it, vi } from 'vitest';
import { createPermissionsPort, type PermissionsApi } from './permissions-adapter';

describe('createPermissionsPort', () => {
  it('delegates each call and normalises origins', async () => {
    const listeners = new Set<(permissions: { origins?: readonly string[] }) => void>();
    const api: PermissionsApi = {
      permissions: {
        contains: () => Promise.resolve(true),
        request: () => Promise.resolve(false),
        remove: () => Promise.resolve(undefined),
        getAll: () => Promise.resolve({ origins: ['https://a.test'] }),
        onRemoved: {
          addListener: (listener) => listeners.add(listener),
          removeListener: (listener) => listeners.delete(listener),
        },
      },
    };
    const port = createPermissionsPort(api);

    expect(await port.contains(['https://a.test'])).toEqual({ ok: true, value: true });
    expect(await port.request(['https://a.test'])).toEqual({ ok: true, value: false });
    expect((await port.remove(['https://a.test'])).ok).toBe(true);
    expect(await port.getAll()).toEqual({ ok: true, value: ['https://a.test'] });

    const observed = vi.fn();
    const unsubscribe = port.onRemoved(observed);
    for (const listener of [...listeners]) {
      listener({ origins: ['https://b.test'] });
    }
    unsubscribe();
    expect(observed).toHaveBeenCalledWith(['https://b.test']);
    expect(listeners.size).toBe(0);
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
