import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toMillis, toTabId } from '../../src/core';
import type { NetworkRule, PlatformPorts, StorageSpace } from '../../src/platform/ports';

/** Control helpers a contract harness exposes so setup works for fakes and mocks. */
export interface PlatformHarness {
  readonly ports: PlatformPorts;
  seedTab(tab: { id: number; url?: string; title?: string; active?: boolean }): void;
  seedStoredValue(space: StorageSpace, key: string, raw: unknown): void;
  seedSessionRule(rule: NetworkRule): void;
  setCommands(commands: readonly { readonly name: string; readonly shortcut?: string }[]): void;
  setDebuggerResponse(method: string, response: unknown): void;
  emitCommand(command: string): void;
  advanceClock(milliseconds: number): Promise<void>;
}

/** Options a contract harness factory accepts. */
export interface PlatformHarnessOptions {
  readonly storageQuotaBytes?: number;
}

export type PlatformHarnessFactory = (options?: PlatformHarnessOptions) => PlatformHarness;

const textSchema = z.string();

const pingRule: NetworkRule = {
  id: 1,
  priority: 1,
  action: { type: 'block' },
  condition: { urlFilter: 'example.com' },
};

/**
 * The shared behaviour suite for every platform implementation (fakes and the
 * Chrome adapters over a mocked browser). Each `it` runs against both, so the
 * fakes and the real adapters cannot drift in observable behaviour.
 */
export function runPlatformContract(label: string, create: PlatformHarnessFactory): void {
  describe(label, () => {
    it('round-trips a versioned value through storage', async () => {
      const { ports } = create();
      const definition = { version: 1, schema: textSchema };

      const written = await ports.storage.write('local', 'greeting', definition, 'hi');
      expect(written.ok).toBe(true);

      const read = await ports.storage.read('local', 'greeting', definition);
      expect(read).toEqual({ ok: true, value: 'hi' });
    });

    it('returns undefined for a missing key', async () => {
      const { ports } = create();
      const read = await ports.storage.read('session', 'absent', {
        version: 1,
        schema: textSchema,
      });
      expect(read).toEqual({ ok: true, value: undefined });
    });

    it('reports version-mismatch for stale stored data', async () => {
      const harness = create();
      harness.seedStoredValue('local', 'greeting', { version: 0, value: 'old' });

      const read = await harness.ports.storage.read('local', 'greeting', {
        version: 1,
        schema: textSchema,
      });
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe('version-mismatch');
      }
    });

    it('reports invalid-data for malformed stored data', async () => {
      const harness = create();
      harness.seedStoredValue('local', 'greeting', { nope: true });

      const read = await harness.ports.storage.read('local', 'greeting', {
        version: 1,
        schema: textSchema,
      });
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe('invalid-data');
      }
    });

    it('removes a stored value', async () => {
      const { ports } = create();
      const definition = { version: 1, schema: textSchema };
      await ports.storage.write('local', 'greeting', definition, 'hi');

      const removed = await ports.storage.remove('local', 'greeting');
      expect(removed.ok).toBe(true);

      const read = await ports.storage.read('local', 'greeting', definition);
      expect(read).toEqual({ ok: true, value: undefined });
    });

    it('fails with quota-exceeded when storage is full', async () => {
      const { ports } = create({ storageQuotaBytes: 20 });

      const written = await ports.storage.write(
        'local',
        'big',
        { version: 1, schema: textSchema },
        'x'.repeat(200),
      );
      expect(written.ok).toBe(false);
      if (!written.ok) {
        expect(written.error.code).toBe('quota-exceeded');
      }
    });

    it('resolves a delay after the clock advances', async () => {
      const harness = create();
      let resolved = false;
      const pending = harness.ports.clock.delay(toMillis(5)).then(() => {
        resolved = true;
      });

      await harness.advanceClock(5);
      await pending;

      expect(resolved).toBe(true);
    });

    it('reads a seeded tab and its active state', async () => {
      const harness = create();
      harness.seedTab({ id: 1, url: 'https://example.com', title: 'Example', active: true });

      const tab = await harness.ports.tabs.get(toTabId(1));
      expect(tab.ok).toBe(true);
      if (tab.ok) {
        expect(tab.value.url).toBe('https://example.com');
        expect(tab.value.active).toBe(true);
      }

      const active = await harness.ports.tabs.getActive();
      expect(active.ok).toBe(true);

      const queried = await harness.ports.tabs.query({ active: true });
      expect(queried.ok).toBe(true);
      if (queried.ok) {
        expect(queried.value).toHaveLength(1);
      }
    });

    it('reports not-found for an unknown tab', async () => {
      const { ports } = create();
      const tab = await ports.tabs.get(toTabId(999));
      expect(tab.ok).toBe(false);
      if (!tab.ok) {
        expect(tab.error.code).toBe('not-found');
      }
    });

    it('reloads and updates a tab', async () => {
      const harness = create();
      harness.seedTab({ id: 2, url: 'https://example.com', active: false });

      const reloaded = await harness.ports.tabs.reload(toTabId(2), { bypassCache: true });
      expect(reloaded.ok).toBe(true);

      const afterReload = await harness.ports.tabs.get(toTabId(2));
      expect(afterReload.ok).toBe(true);
      if (afterReload.ok) {
        expect(afterReload.value.status).toBe('loading');
      }

      const updated = await harness.ports.tabs.update(toTabId(2), { active: true });
      expect(updated.ok).toBe(true);
      if (updated.ok) {
        expect(updated.value.active).toBe(true);
      }
    });

    it('executes scripts and styles with a successful result', async () => {
      const { ports } = create();

      const script = await ports.scripting.executeScript({
        target: { tabId: toTabId(1) },
        func: () => 1,
      });
      expect(script.ok).toBe(true);

      const css = await ports.scripting.insertCss({ target: { tabId: toTabId(1) }, css: 'body{}' });
      expect(css.ok).toBe(true);
    });

    it('clears browsing data', async () => {
      const { ports } = create();
      const result = await ports.browsingData.remove({
        dataToRemove: ['cookies', 'localStorage'],
        origins: ['https://example.com'],
      });
      expect(result.ok).toBe(true);
    });

    it('adds and removes session network rules', async () => {
      const harness = create();
      harness.seedSessionRule(pingRule);

      const rules = await harness.ports.networkRules.getSessionRules();
      expect(rules.ok).toBe(true);
      if (rules.ok) {
        expect(rules.value.map((rule) => rule.id)).toContain(1);
      }

      const updated = await harness.ports.networkRules.updateSessionRules({ removeRuleIds: [1] });
      expect(updated.ok).toBe(true);

      const after = await harness.ports.networkRules.getSessionRules();
      expect(after.ok).toBe(true);
      if (after.ok) {
        expect(after.value).toHaveLength(0);
      }
    });

    it('attaches, detaches and reports unsupported debugger methods', async () => {
      const harness = create();

      expect((await harness.ports.debugger.attach({ tabId: toTabId(1) }, '1.3')).ok).toBe(true);
      expect((await harness.ports.debugger.detach({ tabId: toTabId(1) })).ok).toBe(true);

      const unsupported = await harness.ports.debugger.sendCommand(
        { tabId: toTabId(1) },
        'Nonexistent.method',
      );
      expect(unsupported.ok).toBe(false);
      if (!unsupported.ok) {
        expect(unsupported.error.code).toBe('unsupported');
      }

      harness.setDebuggerResponse('Runtime.evaluate', { result: 42 });
      const supported = await harness.ports.debugger.sendCommand(
        { tabId: toTabId(1) },
        'Runtime.evaluate',
      );
      expect(supported.ok).toBe(true);
    });

    it('lists commands and delivers command events', async () => {
      const harness = create();
      harness.setCommands([{ name: 'open-panel', shortcut: 'Ctrl+Shift+Y' }]);

      const commands = await harness.ports.commands.getAll();
      expect(commands.ok).toBe(true);
      if (commands.ok) {
        expect(commands.value[0]?.name).toBe('open-panel');
      }

      const received: string[] = [];
      const unsubscribe = harness.ports.commands.onCommand((command) => received.push(command));
      harness.emitCommand('open-panel');
      unsubscribe();
      harness.emitCommand('ignored');

      expect(received).toEqual(['open-panel']);
    });

    it('configures and opens the side panel', async () => {
      const { ports } = create();
      expect((await ports.sidePanel.setOptions({ tabId: toTabId(1), enabled: true })).ok).toBe(
        true,
      );
      expect((await ports.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })).ok).toBe(
        true,
      );
      expect((await ports.sidePanel.open({ tabId: toTabId(1) })).ok).toBe(true);
    });
  });
}
