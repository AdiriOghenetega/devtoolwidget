import { z } from 'zod';
import { browser } from 'wxt/browser';
import type { LauncherPlacement, ShellPersistence } from '../../core';
import { createStoragePort, type BrowserApi } from '../../platform/chrome';

const placementSchema = z.object({
  edge: z.enum(['left', 'right', 'top', 'bottom']),
  offset: z.number().min(0).max(1),
});
const LAUNCHER_VERSION = 1;
const DISABLED_VERSION = 1;

/**
 * Per-origin shell persistence backed by the storage port (validated with Zod at
 * the storage trust boundary). A single adapter instance is injected into both
 * the `document_start` launcher and the lazily mounted shell, so the placement
 * and disabled-flag logic exists once (ADR 0019).
 */
export function createShellPersistence(): ShellPersistence {
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
    async saveLauncher(origin, placement: LauncherPlacement) {
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
