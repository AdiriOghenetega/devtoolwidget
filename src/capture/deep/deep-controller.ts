import { ok, type Result, type TabId } from '../../core';
import {
  platformError,
  type PlatformError,
  type DebuggerPort,
  type PermissionsPort,
} from '../../platform/ports';

/** The Debugger protocol version to request on attach. */
export const DEEP_ATTACH_VERSION = '1.3';

/**
 * CDP domains enabled for Deep mode. `Network`, `Log` and `Performance` expose
 * an `enable` command; `Emulation` has **no** `enable` command (verified against
 * the DevTools Protocol, 2026-10) - it is used directly via
 * `Emulation.setCPUThrottlingRate`.
 */
export const DEEP_ENABLE_COMMANDS = ['Network.enable', 'Log.enable', 'Performance.enable'] as const;

/** Network throttling conditions passed to `Network.emulateNetworkConditions`. */
export interface DeepNetworkConditions {
  readonly offline: boolean;
  readonly latency: number;
  /** Bytes per second; -1 disables the limit. */
  readonly downloadThroughput: number;
  readonly uploadThroughput: number;
}

/** Dependencies for {@link DeepController}. */
export interface DeepControllerDeps {
  readonly debugger: DebuggerPort;
  /** Optional host-permission gate for the `debugger` permission. */
  readonly permissions?: PermissionsPort;
}

const DEBUGGER_PERMISSION = 'debugger';

function looksLikeDevTools(message: string): boolean {
  return /already attached|another debugger|devtools/i.test(message);
}

/**
 * Deep mode (PRD FR-12) behind the DebuggerPort: requests the optional
 * `debugger` permission only when enabled, attaches per tab, enables the CDP
 * domains, applies true network and CPU throttling, and detaches cleanly. It
 * detects an already-attached DevTools session and refuses rather than conflict.
 */
export class DeepController {
  readonly #debugger: DebuggerPort;
  readonly #permissions: PermissionsPort | undefined;
  readonly #attached = new Set<TabId>();

  constructor(deps: DeepControllerDeps) {
    this.#debugger = deps.debugger;
    this.#permissions = deps.permissions;
  }

  /** True when this controller has an attached debugger session for the tab. */
  isAttached(tabId: TabId): boolean {
    return this.#attached.has(tabId);
  }

  /**
   * Enables Deep mode for a tab: requests the `debugger` permission if needed,
   * attaches, and enables the CDP domains.
   */
  async enable(tabId: TabId): Promise<Result<void, PlatformError>> {
    if (this.#permissions !== undefined) {
      const contained = await this.#permissions.contains([DEBUGGER_PERMISSION]);
      if (!contained.ok) {
        return contained;
      }
      if (!contained.value) {
        const requested = await this.#permissions.request([DEBUGGER_PERMISSION]);
        if (!requested.ok) {
          return requested;
        }
        if (!requested.value) {
          return {
            ok: false,
            error: platformError('permission-denied', 'Debugger permission was declined'),
          };
        }
      }
    }

    const attached = await this.#debugger.attach({ tabId }, DEEP_ATTACH_VERSION);
    if (!attached.ok) {
      if (looksLikeDevTools(attached.error.message)) {
        return {
          ok: false,
          error: platformError(
            'unsupported',
            'DevTools is already attached to this tab; close it before enabling Deep mode',
          ),
        };
      }
      return attached;
    }

    for (const method of DEEP_ENABLE_COMMANDS) {
      const enabled = await this.#debugger.sendCommand({ tabId }, method);
      if (!enabled.ok) {
        await this.#debugger.detach({ tabId });
        return { ok: false, error: enabled.error };
      }
    }
    this.#attached.add(tabId);
    return ok(undefined);
  }

  /** Attaches a listener for CDP events (including a detach signal). */
  onEvent(handler: (tabId: TabId, method: string, params?: unknown) => void): () => void {
    return this.#debugger.onEvent((source, method, params) => {
      if (method === 'Inspector.detached' || method === 'Debugger.detach') {
        this.#attached.delete(source.tabId);
      }
      handler(source.tabId, method, params);
    });
  }

  /** Applies true network throttling via `Network.emulateNetworkConditions`. */
  async setNetworkThrottle(
    tabId: TabId,
    conditions: DeepNetworkConditions,
  ): Promise<Result<void, PlatformError>> {
    const result = await this.#debugger.sendCommand({ tabId }, 'Network.emulateNetworkConditions', {
      offline: conditions.offline,
      latency: conditions.latency,
      downloadThroughput: conditions.downloadThroughput,
      uploadThroughput: conditions.uploadThroughput,
    });
    return result.ok ? ok(undefined) : { ok: false, error: result.error };
  }

  /** Applies CPU throttling via `Emulation.setCPUThrottlingRate` (rate >= 1). */
  async setCpuThrottle(tabId: TabId, rate: number): Promise<Result<void, PlatformError>> {
    if (rate < 1) {
      return {
        ok: false,
        error: platformError('invalid-argument', 'CPU throttle rate must be >= 1'),
      };
    }
    const result = await this.#debugger.sendCommand({ tabId }, 'Emulation.setCPUThrottlingRate', {
      rate,
    });
    return result.ok ? ok(undefined) : { ok: false, error: result.error };
  }

  /** Toggles the HTTP cache via `Network.setCacheDisabled`. */
  async setCacheDisabled(tabId: TabId, disabled: boolean): Promise<Result<void, PlatformError>> {
    const result = await this.#debugger.sendCommand({ tabId }, 'Network.setCacheDisabled', {
      cacheDisabled: disabled,
    });
    return result.ok ? ok(undefined) : { ok: false, error: result.error };
  }

  /** Detaches the debugger session for a tab (mode off, close, navigation, suspend). */
  async disable(tabId: TabId): Promise<Result<void, PlatformError>> {
    if (!this.#attached.has(tabId)) {
      return ok(undefined);
    }
    const detached = await this.#debugger.detach({ tabId });
    this.#attached.delete(tabId);
    return detached;
  }

  /** Detaches every attached tab (extension suspend / dispose). */
  async dispose(): Promise<void> {
    for (const tabId of [...this.#attached]) {
      await this.#debugger.detach({ tabId });
      this.#attached.delete(tabId);
    }
  }
}
