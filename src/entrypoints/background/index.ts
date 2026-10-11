import { browser } from 'wxt/browser';
import { toTabId, type InstalledReason } from '../../core';
import { runFirstRun } from '../../capture/onboarding/first-run-flow';
import { TabSessionStore } from '../../capture/pipeline';
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
 * site-access service and the first-run flow. Contains no business logic.
 *
 * Inbound messages are either capture events (stored per tab) or commands
 * (routed and answered with a single response envelope).
 */
export default defineBackground(() => {
  const ports = createChromePorts(browser as unknown as BrowserApi);
  const registry = new TabSessionRegistry(ports.storage);
  const sessions = new TabSessionStore(ports.storage);
  const router = createCommandRouter({ registry });
  const settings = new SettingsService(ports.storage);
  const siteAccess = new SiteAccessService({
    permissions: createPermissionsPort(browser as unknown as PermissionsApi),
    siteScripts: createSiteScriptsPort(browser as unknown as SiteScriptsApi),
  });

  siteAccess.onRevoked(() => {
    // The service unregisters the scripts; nothing else to do here yet.
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const event = parseEvent(message);
    if (event.ok) {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        void sessions.applyBatch({
          tabId: toTabId(tabId),
          sequence: event.value.payload.sequence,
          dropped: event.value.payload.dropped,
          events: event.value.payload.events,
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

  browser.runtime.onInstalled.addListener((details) => {
    void runFirstRun(settings, toInstalledReason(details.reason));
    void siteAccess.sync();
  });

  browser.runtime.onStartup.addListener(() => {
    void siteAccess.sync();
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void sessions.clear(toTabId(tabId));
  });
});
