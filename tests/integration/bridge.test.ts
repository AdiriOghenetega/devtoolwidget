import { describe, expect, it } from 'vitest';
import { installAgentBridge, type AgentWindow } from '../../src/capture/bridge/agent-bridge';
import { connectAgentBridge, type ContentWindow } from '../../src/capture/bridge/content-bridge';
import { createCommit, createHandshake } from '../../src/capture/bridge/handshake';
import { createCommandRouter } from '../../src/capture/session/command-router';
import { TabSessionRegistry } from '../../src/capture/session/session-registry';
import { TabNetworkController } from '../../src/capture/network/tab-network-controller';
import { aSnapshot, createIdFactory, ok, toTabId } from '../../src/core';
import { createFakePorts } from '../../src/platform/fakes';
import { PROTOCOL_VERSION, parseMessage } from '../../src/protocol';

/** Lets a delivered `MessageChannel` message be processed (port delivery is async). */
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Waits until `predicate` holds, so async port delivery is not a race. */
async function until(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeoutMs) {
    await flush();
  }
}

/**
 * A deterministic window that models capture-before-bubble dispatch and port
 * transfer, so the two bridge halves can be integrated without a real browser.
 */
class TestWindow implements AgentWindow, ContentWindow {
  readonly #listeners = new Set<{
    readonly listener: (event: MessageEvent) => void;
    readonly capture: boolean;
  }>();

  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (type === 'message') {
      this.#listeners.add({ listener, capture: options === true });
    }
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') {
      for (const entry of [...this.#listeners]) {
        if (entry.listener === listener) {
          this.#listeners.delete(entry);
        }
      }
    }
  }

  postMessage(message: unknown, _targetOrigin: string, transfer?: readonly Transferable[]): void {
    const state = { stopped: false };
    const event = {
      data: message,
      ports: transfer ?? [],
      stopImmediatePropagation: () => {
        state.stopped = true;
      },
    } as unknown as MessageEvent;
    const ordered = [...this.#listeners].sort((a, b) => Number(b.capture) - Number(a.capture));
    for (const entry of ordered) {
      entry.listener(event);
      if (state.stopped) {
        break;
      }
    }
  }
}

describe('agent bridge handshake and ping', () => {
  it('hides the handshake from page listeners and answers ping end to end', async () => {
    const window = new TestWindow();
    const pageList: unknown[] = [];
    const agent = installAgentBridge({ target: window });
    // A page listener added after the agent's capturing listener.
    window.addEventListener('message', (event: MessageEvent) => {
      pageList.push(event.data);
    });

    const createId = createIdFactory({ now: () => 1, random: () => 0 });
    const connection = await connectAgentBridge({
      target: window,
      createId,
      createChannel: () => new MessageChannel(),
      createRandom: () => 0.5,
      parseMessage,
      timeoutMs: 200,
      retryMs: 100,
      maxAttempts: 3,
    });

    expect(connection.ok).toBe(true);
    if (!connection.ok) {
      return;
    }
    await until(() => agent.connected);
    expect(agent.connected).toBe(true);
    expect(connection.value.nonce).toBe(agent.nonce);

    // The page listener never observed the handshake (nonce missing).
    expect(
      pageList.some((data) => typeof data === 'object' && data !== null && 'nonce' in data),
    ).toBe(false);

    // Service-worker hop: the router handles ping and records the session.
    const ports = createFakePorts();
    const registry = new TabSessionRegistry(ports.storage, () => 1_000);
    const network = new TabNetworkController({ tabs: ports.tabs, rules: ports.networkRules });
    const router = createCommandRouter({
      registry,
      network,
      snapshot: () => Promise.resolve(aSnapshot().build()),
      clear: () =>
        Promise.resolve({ ok: true, bytesFreed: 0, results: [], failures: [], warnings: [] }),
      exportReport: () => Promise.resolve({ filename: 'report.md', content: '' }),
      resolveThrottle: (profile) => network.setThrottle(profile),
      siteAccess: {
        grant: () => Promise.resolve(ok('already-granted')),
        revoke: () => Promise.resolve(ok(undefined)),
      },
      tabUrl: () => Promise.resolve(undefined),
    });
    const routed = await router.handle(
      { type: 'command.ping', version: PROTOCOL_VERSION, correlationId: 'c1', payload: {} },
      { tabId: toTabId(7) },
    );
    expect(routed.ok).toBe(true);
    if (routed.ok) {
      expect(routed.value.type).toBe('result.ping');
    }
    const session = await registry.get(toTabId(7));
    expect(session.ok).toBe(true);
    if (session.ok) {
      expect(session.value?.agentConnected).toBe(true);
    }

    // Agent hop over the transferred port. The agent does not answer commands
    // over the port (ADR 0018): the port carries capture events outward only, so
    // a request times out rather than receiving a pong.
    const noReply = await connection.value.request({ type: 'command.ping', payload: {} });
    expect(noReply.ok).toBe(false);
    if (!noReply.ok) {
      expect(noReply.error.code).toBe('timeout');
    }

    connection.value.dispose();
    agent.dispose();
  });

  it('re-adopts the current handshake when an earlier attempt is abandoned (G7)', async () => {
    const window = new TestWindow();
    const agent = installAgentBridge({ target: window });

    // First attempt: the content script gives up before committing and closes
    // its branch (this is what a too-short retry window does at document_start).
    const first = new MessageChannel();
    window.postMessage(createHandshake('nonce-1'), '*', [first.port2]);
    await until(() => agent.nonce === 'nonce-1');
    first.port1.close();

    // Second attempt: a fresh channel the content script is still waiting on.
    const second = new MessageChannel();
    window.postMessage(createHandshake('nonce-2'), '*', [second.port2]);
    await until(() => agent.nonce === 'nonce-2');
    second.port1.postMessage(createCommit('nonce-2'));
    await until(() => agent.connected);

    expect(agent.connected).toBe(true);
    expect(agent.nonce).toBe('nonce-2');
    agent.dispose();
  });

  it('returns unsupported for a command the agent cannot handle', async () => {
    const window = new TestWindow();
    installAgentBridge({ target: window });
    const connection = await connectAgentBridge({
      target: window,
      createId: createIdFactory({ now: () => 1, random: () => 0 }),
      createChannel: () => new MessageChannel(),
      createRandom: () => 0.5,
      parseMessage,
      timeoutMs: 200,
      retryMs: 100,
    });
    expect(connection.ok).toBe(true);
    if (!connection.ok) {
      return;
    }

    const result = await connection.value.request({
      type: 'command.getSnapshot',
      payload: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // No agent reply over the port (ADR 0018) -> the request times out.
      expect(result.error.code).toBe('timeout');
    }
  });

  it('times out when no agent is present', async () => {
    const window = new TestWindow();
    const connection = await connectAgentBridge({
      target: window,
      createId: createIdFactory({ now: () => 1, random: () => 0 }),
      createChannel: () => new MessageChannel(),
      createRandom: () => 0.5,
      parseMessage,
      timeoutMs: 50,
      retryMs: 10,
      maxAttempts: 2,
    });
    expect(connection.ok).toBe(false);
    if (!connection.ok) {
      expect(connection.error.code).toBe('timeout');
    }
  });
});
