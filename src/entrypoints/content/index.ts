import { browser } from 'wxt/browser';
import { createIdFactory } from '../../core';
import { connectAgentBridge } from '../../capture/bridge';
import { PROTOCOL_VERSION, parseResult } from '../../protocol';
import { hostWidgetRoot } from '../../ui/widget-root';

/**
 * Content script (PRD 8.1): runs at `document_start` in the isolated world,
 * hosts the widget root and connects the secure bridge to the main-world agent.
 * The UI stub pings the service worker, which routes the command to the agent.
 * Contains no business logic beyond wiring.
 */
export default defineContentScript({
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
        root.setStatus('agent connected');
        const response: unknown = await browser.runtime.sendMessage({
          type: 'command.ping',
          version: PROTOCOL_VERSION,
          correlationId: createId(),
          payload: {},
        });
        const parsed = parseResult(response);
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
