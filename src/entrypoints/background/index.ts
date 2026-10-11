import { browser } from 'wxt/browser';
import {
  createIdFactory,
  foldCaptureEvents,
  toTabId,
  type CaptureEvent,
  type InstalledReason,
  type PageSnapshot,
} from '../../core';
import { buildSessionExport } from '../../capture/export';
import { runFirstRun } from '../../capture/onboarding/first-run-flow';
import { TabNetworkController } from '../../capture/network/tab-network-controller';
import { PanelBroadcaster, PANEL_PORT_NAME, TabSessionStore } from '../../capture/pipeline';
import { createCommandRouter, TabSessionRegistry, toCommandResponse } from '../../capture/session';
import { SettingsService } from '../../capture/settings/settings-service';
import { SiteAccessService } from '../../capture/site-access/site-access-service';
import {
  ClearOrchestrator,
  createBackgroundClearExecutor,
  createPageClearExecutor,
} from '../../capture/storage';
import {
  createChromePorts,
  createPermissionsPort,
  createSiteScriptsPort,
  type BrowserApi,
  type PermissionsApi,
  type SiteScriptsApi,
} from '../../platform/chrome';
import { PROTOCOL_VERSION, parseCommand, parseEvent } from '../../protocol';

/** Origin of a URL, or undefined when it cannot be parsed. */
function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

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
  const network = new TabNetworkController({ tabs: ports.tabs, rules: ports.networkRules });
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

  // Reconcile on every service worker startup: registrations are not durable
  // across a worker restart, so re-register every actually-granted origin and
  // drop anything stale (never assume the previous registrations persisted).
  void siteAccess.sync();

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

  const router = createCommandRouter({
    registry,
    network,
    snapshot: (tabId) => snapshotFor(tabId),
    clear: (tabId, request) =>
      new ClearOrchestrator({
        page: createPageClearExecutor(ports.scripting, tabId),
        background: createBackgroundClearExecutor(ports.browsingData),
      }).clear(request),
    exportReport: async (tabId, format) =>
      buildSessionExport(
        {
          snapshot: await snapshotFor(tabId),
          userAgent: navigator.userAgent,
          extensionVersion: browser.runtime.getManifest().version,
        },
        format,
      ),
    resolveThrottle: (profile) => network.setThrottle(profile),
    siteAccess,
    tabUrl: async (tabId) => {
      const tab = await ports.tabs.get(tabId);
      return tab.ok ? tab.value.url : undefined;
    },
  });

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

  const sendAgentConfig = async (
    tabId: number,
    port: { postMessage(message: unknown): void },
  ): Promise<void> => {
    const loaded = await settings.load();
    const current = loaded.ok ? loaded.value : undefined;
    const tab = await ports.tabs.get(toTabId(tabId));
    const origin = tab.ok && tab.value.url !== undefined ? originOf(tab.value.url) : undefined;
    const profile =
      current !== undefined && origin !== undefined ? current.perOriginProfiles[origin] : undefined;
    port.postMessage({
      type: 'panel.agentConfig',
      version: PROTOCOL_VERSION,
      correlationId: createId(),
      payload: {
        captureLevel: current?.captureLevel ?? 'standard',
        bodyCapture: profile?.bodyCapture ?? false,
        redactionRules: (current?.redactionRules ?? []).map((rule) => ({
          name: rule.name,
          pattern: rule.pattern,
          ...(rule.replacement === undefined ? {} : { replacement: rule.replacement }),
        })),
        latencyMs: 0,
      },
    });
  };

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
    void sendAgentConfig(tabId, port);

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
    void ports.tabs.query({}).then((tabs) => {
      if (tabs.ok) {
        void network.sync(tabs.value.map((tab) => Number(tab.id)));
      }
    });
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void sessions.clear(toTabId(tabId));
    void network.cleanup(toTabId(tabId));
    broadcasters.delete(tabId);
  });
});
