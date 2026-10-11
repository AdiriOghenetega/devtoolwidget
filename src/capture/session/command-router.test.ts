import { describe, expect, it, vi } from 'vitest';
import { aSnapshot, toTabId } from '../../core';
import {
  createFakePermissionsPort,
  createFakePorts,
  createFakeSiteScriptsPort,
} from '../../platform/fakes';
import { PROTOCOL_VERSION, type CommandMessage } from '../../protocol';
import { TabNetworkController } from '../network/tab-network-controller';
import { SiteAccessService } from '../site-access/site-access-service';
import { createCommandRouter, type CommandRouterDeps } from './command-router';
import { TabSessionRegistry } from './session-registry';

const TAB = toTabId(7);

function makeRouter(overrides: Partial<CommandRouterDeps> = {}) {
  const ports = createFakePorts();
  ports.tabs.addTab({ id: 7, active: true, url: 'https://a.test/page?token=secret' });
  const registry = new TabSessionRegistry(ports.storage, () => 1_000);
  const network = new TabNetworkController({ tabs: ports.tabs, rules: ports.networkRules });
  const permissions = createFakePermissionsPort();
  const siteScripts = createFakeSiteScriptsPort();
  const siteAccess = new SiteAccessService({ permissions, siteScripts });
  const deps: CommandRouterDeps = {
    registry,
    network,
    siteAccess,
    snapshot: () => Promise.resolve(aSnapshot().build()),
    clear: () =>
      Promise.resolve({ ok: true, bytesFreed: 0, results: [], failures: [], warnings: [] }),
    exportReport: () => Promise.resolve({ filename: 'report.md', content: '# report' }),
    resolveThrottle: (profile) => network.setThrottle(profile),
    tabUrl: () => Promise.resolve('https://a.test/page?token=secret'),
    ...overrides,
  };
  return { router: createCommandRouter(deps), ports, registry, permissions, siteScripts };
}

function command<T extends CommandMessage['type']>(
  type: T,
  payload: Extract<CommandMessage, { type: T }>['payload'],
): CommandMessage {
  return { type, version: PROTOCOL_VERSION, correlationId: 'c1', payload } as CommandMessage;
}

describe('command router handlers', () => {
  it('hard-reloads the tab bypassing the cache', async () => {
    const { router, ports } = makeRouter();
    const reload = vi.spyOn(ports.tabs, 'reload');

    const outcome = await router.handle(command('command.hardReload', {}), { tabId: TAB });

    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.value.type === 'result.hardReload') {
      expect(outcome.value.payload.reloaded).toBe(true);
    }
    expect(reload).toHaveBeenCalledWith(TAB, { bypassCache: true });
  });

  it('resolves a throttle profile and echoes it', async () => {
    const { router } = makeRouter();
    const outcome = await router.handle(command('command.setThrottle', { profile: 'slow-3g' }), {
      tabId: TAB,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.value.type === 'result.setThrottle') {
      expect(outcome.value.payload.profile).toBe('slow-3g');
    }
  });

  it('toggles the disable-cache session rule for the tab', async () => {
    const { router, ports } = makeRouter();

    const outcome = await router.handle(command('command.toggleDisableCache', { enabled: true }), {
      tabId: TAB,
    });

    expect(outcome.ok).toBe(true);
    const rules = await ports.networkRules.getSessionRules();
    expect(rules.ok).toBe(true);
    if (rules.ok) {
      expect(rules.value.some((rule) => rule.condition.tabIds?.includes(TAB))).toBe(true);
    }
  });

  it('clears the origin from the tab URL for the fresh-visitor preset', async () => {
    const clear = vi.fn().mockResolvedValue({
      ok: true,
      bytesFreed: 0,
      results: [],
      failures: [],
      warnings: [],
    });
    const { router } = makeRouter({ clear });

    const outcome = await router.handle(
      command('command.clearStorage', { preset: 'fresh-visitor' }),
      { tabId: TAB },
    );

    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.value.type === 'result.clearStorage') {
      expect(outcome.value.payload).toEqual({ preset: 'fresh-visitor', cleared: true });
    }
    expect(clear).toHaveBeenCalledWith(
      TAB,
      expect.objectContaining({ scope: 'origin', origin: 'https://a.test' }),
    );
  });

  it('returns the current page snapshot', async () => {
    const { router } = makeRouter();
    const outcome = await router.handle(command('command.getSnapshot', {}), { tabId: TAB });
    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.value.type === 'result.getSnapshot') {
      expect(Array.isArray(outcome.value.payload.console)).toBe(true);
    }
  });

  it('returns the built report for the requested format', async () => {
    const exportReport = vi.fn().mockResolvedValue({ filename: 'x.json', content: '{}' });
    const { router } = makeRouter({ exportReport });

    const outcome = await router.handle(command('command.exportReport', { format: 'json' }), {
      tabId: TAB,
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.value.type === 'result.exportReport') {
      expect(outcome.value.payload).toEqual({
        format: 'json',
        filename: 'x.json',
        content: '{}',
      });
    }
    expect(exportReport).toHaveBeenCalledWith(TAB, 'json');
  });

  it('rejects a tab-scoped command with no tab context', async () => {
    const { router } = makeRouter();
    const outcome = await router.handle(command('command.hardReload', {}), {});
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('invalid-argument');
    }
  });

  it('grants access: requests the origin and registers its scripts', async () => {
    const { router, siteScripts } = makeRouter();

    const outcome = await router.handle(command('command.grantAccess', {}), { tabId: TAB });

    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.value.type === 'result.grantAccess') {
      expect(outcome.value.payload).toEqual({ origin: 'https://a.test', status: 'granted' });
    }
    const registered = await siteScripts.list();
    expect(registered.ok).toBe(true);
    if (registered.ok) {
      const ids = registered.value.map((script) => script.id);
      expect(ids).toContain('dwsite:content:https://a.test');
      expect(ids).toContain('dwsite:agent:https://a.test');
    }
  });

  it('revokes access with an explicit origin and unregisters its scripts', async () => {
    const { router, permissions, siteScripts } = makeRouter();
    permissions.grant(['https://b.test']);
    await router.handle(command('command.grantAccess', { origin: 'https://b.test' }), {});

    const outcome = await router.handle(
      command('command.revokeAccess', { origin: 'https://b.test' }),
      {},
    );

    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.value.type === 'result.revokeAccess') {
      expect(outcome.value.payload).toEqual({ origin: 'https://b.test', revoked: true });
    }
    const registered = await siteScripts.list();
    if (registered.ok) {
      expect(registered.value.map((script) => script.id)).not.toContain(
        'dwsite:content:https://b.test',
      );
    }
  });

  it('rejects granting with neither an origin nor a tab', async () => {
    const { router } = makeRouter();
    const outcome = await router.handle(command('command.grantAccess', {}), {});
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('invalid-argument');
    }
  });
});
