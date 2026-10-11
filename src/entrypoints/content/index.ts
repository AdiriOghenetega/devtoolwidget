import { browser } from 'wxt/browser';
import {
  createIdFactory,
  DEFAULT_LAUNCHER_PLACEMENT,
  resolveBindings,
  shouldHandleShortcut,
  type ActionRef,
  type AgentConfig,
} from '../../core';
import { connectAgentBridge } from '../../capture/bridge';
import { createAgentConfig } from '../../capture/bridge/agent-config';
import { PANEL_PORT_NAME } from '../../capture/pipeline';
import {
  PROTOCOL_VERSION,
  parseCommandResponse,
  parseMessage,
  parsePanelMessage,
  type CommandInput,
} from '../../protocol';
import { createLauncher, LAUNCHER_CSS, type LauncherHandle } from './launcher';
import { createPanelFeed } from './panel-feed';
import { createShellPersistence } from './shell-persistence';
import { hostWidgetRoot } from './widget-root';

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

/**
 * Content script (PRD 8.1, ADR 0019). At `document_start` it does only the
 * secure bridge, the handshake and routing: it mounts the Shadow-DOM host,
 * connects the panel port (to relay the agent config) and forwards captured
 * batches. A tiny **vanilla-DOM launcher** is mounted at `DOMContentLoaded`; the
 * Preact shell, the signals-backed store and the panel are **loaded on the first
 * interaction** (launcher click or shortcut). This is deferred **execution**: WXT
 * inlines content-script dynamic imports, so the UI is not yet a separate chunk
 * (see the ADR 0019 amendment). It must not statically import Preact or `ui`
 * (enforced by dependency-cruiser and a unit test).
 */
export default defineContentScript({
  registration: 'runtime',
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main(ctx) {
    const root = hostWidgetRoot();
    const createId = createIdFactory({ now: () => Date.now(), random: () => Math.random() });
    const persistence = createShellPersistence();
    const feed = createPanelFeed();
    const port = browser.runtime.connect({ name: PANEL_PORT_NAME });
    let dispose: (() => void) | undefined;

    const origin = window.location.origin;
    const topFrame = window.top === window;
    const viewport = (): { readonly width: number; readonly height: number } => ({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // Runtime configuration relay (G13): the worker pushes the config on the panel
    // port; it is stored here and forwarded to the agent over the committed bridge.
    let latestConfig: AgentConfig | undefined;
    let agentChannel: { send(message: unknown): void } | undefined;
    const pushConfig = (): void => {
      if (agentChannel !== undefined && latestConfig !== undefined) {
        agentChannel.send(createAgentConfig(latestConfig));
      }
    };

    port.onMessage.addListener((message: unknown) => {
      const parsed = parsePanelMessage(message);
      if (!parsed.ok) {
        return;
      }
      if (parsed.value.type === 'panel.agentConfig') {
        latestConfig = parsed.value.payload;
        pushConfig();
        return;
      }
      feed.setConnected(true);
      feed.push(parsed.value);
    });
    port.onDisconnect.addListener(() => {
      feed.setConnected(false);
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
        agentChannel = connection.value;
        pushConfig();
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

    // The lazy UI handoff: import the shell only on first interaction; a later
    // interaction on the mounted shell re-opens its panel imperatively.
    let controller: { open(): void } | undefined;
    let mounting = false;
    let launcher: LauncherHandle | undefined;
    const dispatch = (action: ActionRef): void => {
      port.postMessage({
        ...toCommand(action),
        version: PROTOCOL_VERSION,
        correlationId: createId(),
      });
    };
    const requestOpen = (): void => {
      if (controller !== undefined) {
        controller.open();
        return;
      }
      if (mounting) {
        return;
      }
      mounting = true;
      void import('./lazy-shell')
        .then((module) => {
          controller = module.mountLazyShell({
            root,
            origin,
            topFrame,
            persistence,
            feed,
            dispatch,
            onHandoff: () => {
              launcher?.dispose();
              launcher = undefined;
            },
          });
        })
        .catch(() => {
          mounting = false;
        });
    };

    // Mount the vanilla launcher at DOMContentLoaded (never at document_start), and
    // only in the top frame and when the site is not disabled.
    const mountLauncher = (): void => {
      if (!topFrame) {
        return;
      }
      void persistence.isSiteDisabled(origin).then((disabled) => {
        if (disabled || launcher !== undefined || controller !== undefined) {
          return;
        }
        const style = document.createElement('style');
        style.textContent = LAUNCHER_CSS;
        root.shadow.append(style);
        launcher = createLauncher({
          doc: document,
          viewport,
          placement: DEFAULT_LAUNCHER_PLACEMENT,
          onOpen: requestOpen,
          onPlacementChange: (next) => {
            void persistence.saveLauncher(origin, next);
          },
        });
        root.shadow.append(launcher.element);
        void persistence.loadLauncher(origin).then((saved) => {
          if (saved !== undefined) {
            launcher?.setPlacement(saved);
          }
        });
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
    } else {
      mountLauncher();
    }

    // In-page shortcut (FR-13) routes to the same lazy open, never a second mount.
    const bindings = resolveBindings({});
    const onKeydown = (event: KeyboardEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      if (shouldHandleShortcut(event, target, bindings) === 'toggle-panel') {
        event.preventDefault();
        requestOpen();
      }
    };
    document.addEventListener('keydown', onKeydown);

    ctx.onInvalidated(() => {
      dispose?.();
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('DOMContentLoaded', mountLauncher);
      launcher?.dispose();
      port.disconnect();
    });
  },
});
