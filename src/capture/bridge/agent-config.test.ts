import { describe, expect, it } from 'vitest';
import { AGENT_CONFIG_MESSAGE, BRIDGE_CHANNEL, toMillis, type NetworkEntry } from '../../core';
import type { ClockPort } from '../../platform/ports';
import { CaptureAgent } from '../agent/capture-agent';
import { installAgentBridge, type AgentWindow } from '../bridge/agent-bridge';
import { createAgentConfig } from '../bridge/agent-config';
import { createCommit, createHandshake } from '../bridge/handshake';
import type { FetchLike, FetchResponseLike } from '../network/network-collector';

/** A window that records window-level listeners and delivers messages to them. */
class TestWindow implements AgentWindow {
  readonly #listeners = new Set<(event: MessageEvent) => void>();

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.#listeners.add(listener);
  }

  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void {
    this.#listeners.delete(listener);
  }

  /** Delivers a message as the page would (no transferred port). */
  postMessage(data: unknown): void {
    const event = {
      data,
      ports: [] as readonly unknown[],
      stopImmediatePropagation: () => undefined,
    };
    for (const listener of [...this.#listeners]) {
      listener(event as unknown as MessageEvent);
    }
  }

  /** Delivers a message carrying a port, as the content script does. */
  postHandshake(data: unknown, port: unknown): void {
    const event = {
      data,
      ports: [port],
      stopImmediatePropagation: () => undefined,
    };
    for (const listener of [...this.#listeners]) {
      listener(event as unknown as MessageEvent);
    }
  }
}

function clock(): ClockPort {
  return { now: () => toMillis(1_000), delay: () => Promise.resolve() };
}

function response(init: { body?: string }): FetchResponseLike {
  return {
    url: 'https://x.test/data',
    status: 200,
    redirected: false,
    headers: { forEach: () => undefined },
    clone: () => ({ text: () => Promise.resolve(init.body ?? '') }),
  };
}

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

async function until(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeoutMs) {
    await flush();
  }
}

/** Builds a wired agent (bridge config -> CaptureAgent) and returns its handle. */
async function connectedAgent(body: string): Promise<{
  readonly window: TestWindow;
  readonly port1: MessagePort;
  readonly entries: NetworkEntry[];
  readonly fetch: () => Promise<unknown>;
  readonly flush: () => void;
  readonly configured: () => number;
}> {
  const window = new TestWindow();
  const bridge = installAgentBridge({ target: window });
  const entries: NetworkEntry[] = [];
  let scheduled: (() => void) | undefined;
  const target: {
    fetch?: FetchLike;
    addEventListener: () => undefined;
    removeEventListener: () => undefined;
  } = {
    fetch: () => Promise.resolve(response({ body })),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  const agent = new CaptureAgent({
    clock: clock(),
    console: {},
    target,
    emit: (batch) => {
      for (const event of batch.events) {
        if (event.channel === 'network') {
          entries.push(event.entry);
        }
      }
    },
    schedule: (callback) => {
      scheduled = callback;
      return () => {
        scheduled = undefined;
      };
    },
  });
  let configured = 0;
  bridge.onConnect(() => {
    agent.start();
  });
  bridge.onConfig((message) => {
    configured += 1;
    agent.applyConfig(message.config);
  });

  const channel = new MessageChannel();
  window.postHandshake(createHandshake('n1'), channel.port2);
  await until(() => bridge.nonce === 'n1');
  channel.port1.postMessage(createCommit('n1'));
  await until(() => bridge.connected);

  return {
    window,
    port1: channel.port1,
    entries,
    fetch: async () => {
      const patched = target.fetch;
      await patched?.('https://x.test/data');
      await Promise.resolve();
    },
    configured: () => configured,
    flush: () => {
      const current = scheduled;
      scheduled = undefined;
      current?.();
    },
  };
}

describe('agent.config (G13)', () => {
  it('applies a settings change over the port without a page reload', async () => {
    const agent = await connectedAgent('the body');

    agent.port1.postMessage(
      createAgentConfig({
        captureLevel: 'standard',
        bodyCapture: true,
        redactionRules: [],
        latencyMs: 0,
      }),
    );
    await until(() => agent.configured() === 1);

    await agent.fetch();
    agent.flush();

    const entry = agent.entries.at(-1);
    expect(entry?.bodyPreview).toBeDefined();
  });

  it('rejects an invalid config and keeps the last safe config', async () => {
    const agent = await connectedAgent('the body');

    agent.port1.postMessage(
      createAgentConfig({
        captureLevel: 'standard',
        bodyCapture: true,
        redactionRules: [],
        latencyMs: 0,
      }),
    );
    await until(() => agent.configured() === 1);

    // Invalid config: negative latency is rejected by the guard, so no handler runs
    // and the agent keeps the config above.
    agent.port1.postMessage({
      channel: BRIDGE_CHANNEL,
      message: AGENT_CONFIG_MESSAGE,
      config: { captureLevel: 'standard', bodyCapture: true, redactionRules: [], latencyMs: -1 },
    });
    await flush();

    expect(agent.configured()).toBe(1);

    await agent.fetch();
    agent.flush();
    expect(agent.entries.at(-1)?.bodyPreview).toBeDefined();
  });

  it('does not accept config injected by a hostile page over the window', async () => {
    const agent = await connectedAgent('the body');

    agent.window.postMessage({
      channel: BRIDGE_CHANNEL,
      message: AGENT_CONFIG_MESSAGE,
      config: { captureLevel: 'deep', bodyCapture: true, redactionRules: [], latencyMs: 5_000 },
    });
    await flush();

    expect(agent.configured()).toBe(0);
  });
});
