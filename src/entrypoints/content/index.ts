import { browser } from 'wxt/browser';
import { createIdFactory } from '../../core';
import { connectAgentBridge } from '../../capture/bridge';
import { PROTOCOL_VERSION, parseCommandResponse } from '../../protocol';
import { hostWidgetRoot } from '../../ui/widget-root';

/**
 * Content script (PRD 8.1): runs at `document_start` in the isolated world,
 * hosts the widget root and connects the secure bridge to the main-world agent.
 * It forwards the agent's batched capture events to the service worker and pings
 * it so the panel knows the bridge is live. Contains no business logic beyond
 * wiring.
 */
export default defineContentScript({
  registration: 'runtime',
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main(ctx) {
    const root = hostWidgetRoot();
    const createId = createIdFactory({ now: () => Date.now(), random: () => Math.random() });
    let dispose: (() => void) | undefined;

    void connectAgentBridge({
      target: window,
      createId,
      createChannel: () => new MessageChannel(),
      createRandom: () => Math.random(),
    })
      .then(async (connection) => {
        if (!connection.ok) {
          root.setStatus('agent unavailable');
          return;
        }
        dispose = () => {
          connection.value.dispose();
        };
        connection.value.onEvent((message) => {
          void browser.runtime.sendMessage(message).catch(() => undefined);
        });
        root.setStatus('agent connected');
        const response: unknown = await browser.runtime.sendMessage({
          type: 'command.ping',
          version: PROTOCOL_VERSION,
          correlationId: createId(),
          payload: {},
        });
        const parsed = parseCommandResponse(response);
        root.setStatus(parsed.ok ? 'pong' : 'ping failed');
      })
      .catch(() => {
        root.setStatus('bridge error');
      });

    ctx.onInvalidated(() => {
      dispose?.();
    });
  },
});
