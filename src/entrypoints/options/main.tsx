import { render } from 'preact';
import { browser } from 'wxt/browser';
import { createIdFactory, toHostOrigin } from '../../core';
import { createPermissionsPort, type PermissionsApi } from '../../platform/chrome';
import { PROTOCOL_VERSION, type CommandInput } from '../../protocol';
import { SiteAccessPage, type SiteAccessPorts } from '../../ui/options';

/**
 * Options page (G12, PRD 7). This is the only extension page with a user
 * gesture, so it is where `chrome.permissions.request` runs; the request is
 * issued synchronously inside the click before any other await. Registering and
 * unregistering the per-origin scripts stays in the worker (`command.grantAccess`
 * / `command.revokeAccess`), so no permission logic is duplicated here.
 */
const createId = createIdFactory({ now: () => Date.now(), random: () => Math.random() });
const permissions = createPermissionsPort(browser as unknown as PermissionsApi);

async function sendCommand(command: CommandInput): Promise<void> {
  await browser.runtime.sendMessage({
    ...command,
    version: PROTOCOL_VERSION,
    correlationId: createId(),
  });
}

const ports: SiteAccessPorts = {
  async listGranted() {
    const result = await permissions.getAll();
    return result.ok ? result.value : [];
  },
  async currentOrigin() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (url === undefined || !(url.startsWith('http://') || url.startsWith('https://'))) {
      return undefined;
    }
    return toHostOrigin(url);
  },
  async allow(origin) {
    // The permission request MUST run in the click gesture, so it is the first
    // thing this handler awaits (no await before it).
    const requested = await permissions.request([origin]);
    if (!requested.ok || !requested.value) {
      return 'denied';
    }
    await sendCommand({ type: 'command.grantAccess', payload: { origin } });
    return 'granted';
  },
  async revoke(origin) {
    await sendCommand({ type: 'command.revokeAccess', payload: { origin } });
  },
};

const root = document.getElementById('root');
if (root !== null) {
  render(<SiteAccessPage ports={ports} />, root);
}
