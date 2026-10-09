import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toMillis, toTabId } from '../../core';
import { createMockBrowser } from '../../../tests/platform/mock-browser';
import { createChromePorts } from './adapters';

const textSchema = z.string();

describe('chrome adapters branch coverage', () => {
  it('reads and writes session storage', async () => {
    const ports = createChromePorts(createMockBrowser().api);
    const definition = { version: 1, schema: textSchema };

    const written = await ports.storage.write('session', 'k', definition, 'v');
    expect(written.ok).toBe(true);

    const read = await ports.storage.read('session', 'k', definition);
    expect(read).toEqual({ ok: true, value: 'v' });
  });

  it('queries tabs by url and updates them', async () => {
    const mock = createMockBrowser();
    const ports = createChromePorts(mock.api);
    mock.addTab({ id: 1, url: 'https://example.com', active: false });

    const byUrl = await ports.tabs.query({ url: 'https://example.com' });
    expect(byUrl.ok).toBe(true);
    if (byUrl.ok) {
      expect(byUrl.value).toHaveLength(1);
    }

    const updated = await ports.tabs.update(toTabId(1), {
      url: 'https://example.org',
      active: true,
    });
    expect(updated.ok).toBe(true);
  });

  it('injects a script with args, world and allFrames', async () => {
    const ports = createChromePorts(createMockBrowser().api);
    const result = await ports.scripting.executeScript({
      target: { tabId: toTabId(1), allFrames: true },
      func: (...args: readonly unknown[]) => args.length,
      args: [1, 2],
      world: 'MAIN',
    });
    expect(result.ok).toBe(true);
  });

  it('clears browsing data without origins or since', async () => {
    const ports = createChromePorts(createMockBrowser().api);
    const result = await ports.browsingData.remove({ dataToRemove: ['cookies'] });
    expect(result.ok).toBe(true);
  });

  it('reads command descriptions and shortcuts', async () => {
    const mock = createMockBrowser();
    mock.setCommands([{ name: 'toggle', description: 'Toggle panel', shortcut: 'Ctrl+K' }]);
    const ports = createChromePorts(mock.api);

    const commands = await ports.commands.getAll();
    expect(commands.ok).toBe(true);
    if (commands.ok) {
      expect(commands.value[0]?.shortcut).toBe('Ctrl+K');
    }
  });

  it('opens the side panel for a window', async () => {
    const ports = createChromePorts(createMockBrowser().api);
    const result = await ports.sidePanel.open({ windowId: 5 });
    expect(result.ok).toBe(true);
  });

  it('times out or succeeds on the clock', async () => {
    const ports = createChromePorts(createMockBrowser().api);
    await ports.clock.delay(toMillis(0));
    expect(ports.clock.now()).toBeGreaterThan(0);
  });
});
