import { describe, expect, it } from 'vitest';
import { toTabId } from '../../core';
import { createFakePorts } from '../../platform/fakes';
import { TabNetworkController } from './tab-network-controller';

function setup() {
  const ports = createFakePorts();
  const controller = new TabNetworkController({ tabs: ports.tabs, rules: ports.networkRules });
  return { ports, controller };
}

describe('TabNetworkController', () => {
  it('hard reloads a tab with cache bypass', async () => {
    const { ports, controller } = setup();
    ports.tabs.addTab({ id: 1, url: 'https://a.test', active: true });

    const result = await controller.hardReload(toTabId(1));

    expect(result.ok).toBe(true);
  });

  it('toggles disable-cache idempotently and cleans up on close', async () => {
    const { ports, controller } = setup();

    await controller.setDisableCache(toTabId(1), true);
    expect(ports.networkRules.rules).toHaveLength(1);

    await controller.setDisableCache(toTabId(1), true); // duplicate toggle
    expect(ports.networkRules.rules).toHaveLength(1);

    await controller.setDisableCache(toTabId(1), false);
    expect(ports.networkRules.rules).toHaveLength(0);

    await controller.setDisableCache(toTabId(1), true);
    await controller.cleanup(toTabId(1)); // tab closed
    expect(ports.networkRules.rules).toHaveLength(0);
  });

  it('removes stale rules on restart sync', async () => {
    const { ports, controller } = setup();
    await controller.setDisableCache(toTabId(1), true);
    await controller.setDisableCache(toTabId(2), true);

    await controller.sync([1]); // tab 2 was closed while the worker was gone

    expect(ports.networkRules.rules.map((rule) => rule.id)).toEqual([1_000_001]);
  });

  it('resolves throttle support (soft vs deep)', () => {
    const { controller } = setup();
    expect(controller.setThrottle('offline').support).toBe('deep');
    expect(controller.setThrottle('slow-3g')).toEqual({
      profile: 'slow-3g',
      support: 'soft',
      softDelayMs: 2_000,
    });
  });
});
