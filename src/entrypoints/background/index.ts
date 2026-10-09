import { browser } from 'wxt/browser';
import { toTabId } from '../../core';
import { createCommandRouter, TabSessionRegistry } from '../../capture/session';
import { createChromePorts, type BrowserApi } from '../../platform/chrome';
import { parseCommand } from '../../protocol';

/**
 * Background service worker (PRD 8.1). Wires the platform adapters, the per-tab
 * session registry and the typed command router, and routes validated runtime
 * messages. Contains no business logic beyond wiring.
 */
export default defineBackground(() => {
  const ports = createChromePorts(browser as unknown as BrowserApi);
  const registry = new TabSessionRegistry(ports.storage);
  const router = createCommandRouter({ registry });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const parsed = parseCommand(message);
    if (!parsed.ok) {
      return false;
    }
    const tabId = sender.tab?.id;
    void router
      .handle(parsed.value, tabId === undefined ? {} : { tabId: toTabId(tabId) })
      .then((outcome) => {
        sendResponse(outcome);
      });
    return true;
  });
});
