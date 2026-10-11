import { h, render } from 'preact';
import { z } from 'zod';
import { browser } from 'wxt/browser';
import { createIdFactory, type ActionRef } from '../../core';
import { connectAgentBridge } from '../../capture/bridge';
import { PANEL_PORT_NAME } from '../../capture/pipeline';
import { createStoragePort, type BrowserApi } from '../../platform/chrome';
import {
  PROTOCOL_VERSION,
  parseCommandResponse,
  parseMessage,
  parsePanelMessage,
  type CommandInput,
} from '../../protocol';
import { DESIGN_TOKENS_CSS } from '../../ui/design-system/tokens';
import { hostWidgetRoot } from '../../ui/widget-root';
import { createOverviewStore } from '../../ui/state';
import { createPanelLoader } from '../../ui/shell/panel-loader';
import { Widget } from '../../ui/shell/Widget';
import type { ShellPersistence } from '../../ui/shell/persistence';

const placementSchema = z.object({
  edge: z.enum(['left', 'right', 'top', 'bottom']),
  offset: z.number().min(0).max(1),
});
const LAUNCHER_VERSION = 1;
const DISABLED_VERSION = 1;

/** Maps a UI action onto its protocol command. */
function toCommand(action: ActionRef): CommandInput {
  switch (action.type) {
    case 'clearStorage':
      return { type: 'command.clearStorage', payload: { preset: action.preset } };
    case 'hardReload':
      return { type: 'command.hardReload', payload: {} };
    case 'setThrottle':
      return { type: 'command.setThrottle', payload: { profile: action.profile } };
    case 'toggleDisableCache':
      return { type: 'command.toggleDisableCache', payload: { enabled: action.enabled } };
    case 'exportReport':
      return { type: 'command.exportReport', payload: { format: action.format } };
  }
}

/** Per-origin shell persistence backed by the storage port. */
function shellPersistence(): ShellPersistence {
  const storage = createStoragePort(browser as unknown as BrowserApi);
  const key = (prefix: string, origin: string): string => `${prefix}:${origin}`;
  return {
    async loadLauncher(origin) {
      const read = await storage.read('local', key('launcher', origin), {
        version: LAUNCHER_VERSION,
        schema: placementSchema,
      });
      return read.ok ? read.value : undefined;
    },
    async saveLauncher(origin, placement) {
      await storage.write(
        'local',
        key('launcher', origin),
        { version: LAUNCHER_VERSION, schema: placementSchema },
        placement,
      );
    },
    async isSiteDisabled(origin) {
      const read = await storage.read('local', key('disabled', origin), {
        version: DISABLED_VERSION,
        schema: z.boolean(),
      });
      return read.ok && read.value === true;
    },
    async setSiteDisabled(origin, disabled) {
      await storage.write(
        'local',
        key('disabled', origin),
        { version: DISABLED_VERSION, schema: z.boolean() },
        disabled,
      );
    },
  };
}

/**
 * Content script (PRD 8.1): runs at `document_start` in the isolated world,
 * hosts the widget root, connects the secure bridge to the main-world agent and
 * mounts the in-page widget. It forwards captured batches to the service worker
 * and receives the panel's snapshot-then-deltas stream over a long-lived port.
 * Contains no business logic beyond wiring.
 */
export default defineContentScript({
  registration: 'runtime',
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main(ctx) {
    const root = hostWidgetRoot();
    const createId = createIdFactory({ now: () => Date.now(), random: () => Math.random() });
    const store = createOverviewStore();
    const port = browser.runtime.connect({ name: PANEL_PORT_NAME });
    let dispose: (() => void) | undefined;

    const style = document.createElement('style');
    style.textContent = DESIGN_TOKENS_CSS;
    root.shadow.append(style);
    const mount = document.createElement('div');
    mount.setAttribute('data-devtoolwidget', 'widget');
    root.shadow.append(mount);
    render(
      h(Widget, {
        origin: window.location.origin,
        topFrame: window.top === window,
        persistence: shellPersistence(),
        loadPanel: createPanelLoader({
          store,
          dispatch: (action) => {
            port.postMessage({
              ...toCommand(action),
              version: PROTOCOL_VERSION,
              correlationId: createId(),
            });
          },
        }),
        store,
      }),
      mount,
    );

    port.onMessage.addListener((message: unknown) => {
      const parsed = parsePanelMessage(message);
      if (parsed.ok) {
        store.applyPanelMessage(parsed.value);
        store.setConnection('connected');
      }
    });
    port.onDisconnect.addListener(() => {
      store.setConnection('disconnected');
    });

    void connectAgentBridge({
      target: window,
      createId,
      createChannel: () => new MessageChannel(),
      createRandom: () => Math.random(),
      parseMessage,
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
      port.disconnect();
      render(null, mount);
    });
  },
});
