import { browser } from 'wxt/browser';
import {
  createIdFactory,
  foldCaptureEvents,
  toTabId,
  type CaptureEvent,
  type InstalledReason,
  type PageSnapshot,
} from '../../core';
import { runFirstRun } from '../../capture/onboarding/first-run-flow';
import { PanelBroadcaster, PANEL_PORT_NAME, TabSessionStore } from '../../capture/pipeline';
import { createCommandRouter, TabSessionRegistry, toCommandResponse } from '../../capture/session';
import { SettingsService } from '../../capture/settings/settings-service';
import { SiteAccessService } from '../../capture/site-access/site-access-service';
import {
  createChromePorts,
  createPermissionsPort,
  createSiteScriptsPort,
  type BrowserApi,
  type PermissionsApi,
  type SiteScriptsApi,
} from '../../platform/chrome';
import { parseCommand, parseEvent } from '../../protocol';

function toInstalledReason(reason: string | undefined): InstalledReason {
  if (reason === 'install' || reason === 'update') {
    return reason;
  }
  return 'unknown';
}

/**
 * Background service worker (PRD 8.1). Wires the platform adapters, the per-tab
 * session registry, the typed command router, the settings service, the
 * site-access service, the first-run flow and the panel broadcasters. Contains
 * no business logic.
 *
 * Inbound runtime messages are capture events (stored per tab, then pushed to any
 * open panel) or commands (routed and answered). A panel connects over a
 * long-lived port to receive `panel.snapshot` then `panel.delta` (PRD 8.4).
 */
export default defineBackground(() => {
  const ports = createChromePorts(browser as unknown as BrowserApi);
  const registry = new TabSessionRegistry(ports.storage);
  const sessions = new TabSessionStore(ports.storage);
  const router = createCommandRouter({ registry });
  const settings = new SettingsService(ports.storage);
  const createId = createIdFactory({ now: () => Date.now(), random: () => Math.random() });
  const broadcasters = new Map<number, Set<PanelBroadcaster>>();
  const siteAccess = new SiteAccessService({
    permissions: createPermissionsPort(browser as unknown as PermissionsApi),
    siteScripts: createSiteScriptsPort(browser as unknown as SiteScriptsApi),
  });

  siteAccess.onRevoked(() => {
    // The service unregisters the scripts; nothing else to do here yet.
  });

  const snapshotFor = async (tabId: number): Promise<PageSnapshot> => {
    const stored = await sessions.snapshot(toTabId(tabId));
    const session = stored.ok ? stored.value : undefined;
    return foldCaptureEvents({
      tabId: toTabId(tabId),
      capturedAt: ports.clock.now(),
      url: session?.url ?? '',
      events: session?.events ?? [],
    });
  };

  const pushToPanels = (tabId: number, events: readonly CaptureEvent[]): void => {
    const set = broadcasters.get(tabId);
    if (set === undefined) {
      return;
    }
    for (const broadcaster of set) {
      for (const event of events) {
        broadcaster.push(event);
      }
    }
  };

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const event = parseEvent(message);
    if (event.ok) {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        const batch = event.value.payload;
        void sessions
          .applyBatch({
            tabId: toTabId(tabId),
            sequence: batch.sequence,
            dropped: batch.dropped,
            events: batch.events,
          })
          .then((applied) => {
            if (applied.ok && applied.value) {
              pushToPanels(tabId, batch.events);
            }
          });
      }
      return false;
    }

    const parsed = parseCommand(message);
    if (!parsed.ok) {
      return false;
    }
    const tabId = sender.tab?.id;
    void router
      .handle(parsed.value, tabId === undefined ? {} : { tabId: toTabId(tabId) })
      .then((outcome) => {
        sendResponse(toCommandResponse(parsed.value.correlationId, outcome));
      });
    return true;
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== PANEL_PORT_NAME) {
      return;
    }
    const tabId = port.sender?.tab?.id;
    if (tabId === undefined) {
      return;
    }
    const broadcaster = new PanelBroadcaster({
      getSnapshot: () => snapshotFor(tabId),
      createId,
      send: (message) => {
        port.postMessage(message);
      },
    });
    const set = broadcasters.get(tabId) ?? new Set<PanelBroadcaster>();
    set.add(broadcaster);
    broadcasters.set(tabId, set);
    void broadcaster.open();

    port.onMessage.addListener((message: unknown) => {
      const parsed = parseCommand(message);
      if (!parsed.ok) {
        return;
      }
      void router.handle(parsed.value, { tabId: toTabId(tabId) }).then((outcome) => {
        port.postMessage(toCommandResponse(parsed.value.correlationId, outcome));
      });
    });
    port.onDisconnect.addListener(() => {
      broadcaster.close();
      set.delete(broadcaster);
      if (set.size === 0) {
        broadcasters.delete(tabId);
      }
    });
  });

  browser.runtime.onInstalled.addListener((details) => {
    void runFirstRun(settings, toInstalledReason(details.reason));
    void siteAccess.sync();
  });

  browser.runtime.onStartup.addListener(() => {
    void siteAccess.sync();
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void sessions.clear(toTabId(tabId));
    broadcasters.delete(tabId);
  });
});
