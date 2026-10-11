import {
  err,
  ok,
  presetToClearRequest,
  type BuiltExport,
  type ClearReport,
  type ClearRequest,
  type ExportFormat,
  type PageSnapshot,
  type Result,
  type TabId,
  type ThrottleProfile,
  type ThrottleResolution,
} from '../../core';
import { platformError, type PlatformError } from '../../platform/ports/errors';
import { PROTOCOL_VERSION, type CommandMessage, type ResultMessage } from '../../protocol';
import type { TabNetworkController } from '../network/tab-network-controller';
import type { SiteAccessService } from '../site-access/site-access-service';
import type { TabSessionRegistry } from './session-registry';

/** Context a routed command runs in. */
export interface CommandContext {
  readonly tabId?: TabId;
}

/** The outcome of routing a command. */
export type CommandOutcome = Result<ResultMessage, PlatformError>;

/** A typed command router used by the service worker (PRD 8.1). */
export interface CommandRouter {
  handle(command: CommandMessage, context: CommandContext): Promise<CommandOutcome>;
}

/** Dependencies for {@link createCommandRouter}. */
export interface CommandRouterDeps {
  readonly registry: TabSessionRegistry;
  /** Tab-scoped network controls (hard reload, disable cache). */
  readonly network: TabNetworkController;
  /** Puts the current page snapshot on the per-tab session store. */
  readonly snapshot: (tabId: TabId) => Promise<PageSnapshot>;
  /** Runs a clear request for a tab through the page and background executors. */
  readonly clear: (tabId: TabId, request: ClearRequest) => Promise<ClearReport>;
  /** Builds a redacted report for a tab in the requested format. */
  readonly exportReport: (tabId: TabId, format: ExportFormat) => Promise<BuiltExport>;
  /** Resolves a throttle profile to its soft/deep support. */
  readonly resolveThrottle: (profile: ThrottleProfile) => ThrottleResolution;
  /** The current tab's URL, used for the origin-scoped clear preset. */
  readonly tabUrl: (tabId: TabId) => Promise<string | undefined>;
  /** Per-origin optional access: request/register and revoke/unregister. */
  readonly siteAccess: Pick<SiteAccessService, 'grant' | 'revoke'>;
}

function originOf(url: string | undefined): string | undefined {
  if (url === undefined) {
    return undefined;
  }
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * Routes a validated command to its handler (PRD 8.1). Expected failures return
 * `err`; unknown commands return an `unsupported` error. Handlers orchestrate the
 * injected controllers and ports — no browser API is touched here.
 */
export function createCommandRouter(deps: CommandRouterDeps): CommandRouter {
  return {
    async handle(command, context) {
      const tabId = context.tabId;
      const needTab = (): TabId | PlatformError =>
        tabId ?? platformError('invalid-argument', 'This command needs a tab context');

      switch (command.type) {
        case 'command.ping': {
          if (tabId !== undefined) {
            const updated = await deps.registry.upsert(tabId, { agentConnected: true });
            if (!updated.ok) {
              return err(updated.error);
            }
          }
          return ok({
            type: 'result.ping',
            version: PROTOCOL_VERSION,
            correlationId: command.correlationId,
            payload: { pong: true },
          });
        }
        case 'command.hardReload': {
          const id = needTab();
          if (typeof id !== 'number') {
            return err(id);
          }
          const reloaded = await deps.network.hardReload(id);
          if (!reloaded.ok) {
            return err(reloaded.error);
          }
          return ok({
            type: 'result.hardReload',
            version: PROTOCOL_VERSION,
            correlationId: command.correlationId,
            payload: { reloaded: true },
          });
        }
        case 'command.setThrottle': {
          const profile = deps.resolveThrottle(command.payload.profile).profile;
          return ok({
            type: 'result.setThrottle',
            version: PROTOCOL_VERSION,
            correlationId: command.correlationId,
            payload: { profile },
          });
        }
        case 'command.toggleDisableCache': {
          const id = needTab();
          if (typeof id !== 'number') {
            return err(id);
          }
          const applied = await deps.network.setDisableCache(id, command.payload.enabled);
          if (!applied.ok) {
            return err(applied.error);
          }
          return ok({
            type: 'result.toggleDisableCache',
            version: PROTOCOL_VERSION,
            correlationId: command.correlationId,
            payload: { enabled: command.payload.enabled },
          });
        }
        case 'command.clearStorage': {
          const id = needTab();
          if (typeof id !== 'number') {
            return err(id);
          }
          const request = presetToClearRequest(
            command.payload.preset,
            originOf(await deps.tabUrl(id)),
          );
          const report = await deps.clear(id, request);
          return ok({
            type: 'result.clearStorage',
            version: PROTOCOL_VERSION,
            correlationId: command.correlationId,
            payload: { preset: command.payload.preset, cleared: report.ok },
          });
        }
        case 'command.getSnapshot': {
          const id = needTab();
          if (typeof id !== 'number') {
            return err(id);
          }
          return ok({
            type: 'result.getSnapshot',
            version: PROTOCOL_VERSION,
            correlationId: command.correlationId,
            payload: await deps.snapshot(id),
          });
        }
        case 'command.exportReport': {
          const id = needTab();
          if (typeof id !== 'number') {
            return err(id);
          }
          const built = await deps.exportReport(id, command.payload.format);
          return ok({
            type: 'result.exportReport',
            version: PROTOCOL_VERSION,
            correlationId: command.correlationId,
            payload: {
              format: command.payload.format,
              filename: built.filename,
              content: built.content,
            },
          });
        }
        case 'command.grantAccess': {
          const origin = await resolveOrigin(command.payload.origin, tabId, deps);
          if (origin === undefined) {
            return err(platformError('invalid-argument', 'No origin to grant access to'));
          }
          const granted = await deps.siteAccess.grant(origin);
          if (!granted.ok) {
            return err(granted.error);
          }
          return ok({
            type: 'result.grantAccess',
            version: PROTOCOL_VERSION,
            correlationId: command.correlationId,
            payload: { origin, status: granted.value },
          });
        }
        case 'command.revokeAccess': {
          const origin = await resolveOrigin(command.payload.origin, tabId, deps);
          if (origin === undefined) {
            return err(platformError('invalid-argument', 'No origin to revoke access from'));
          }
          const revoked = await deps.siteAccess.revoke(origin);
          if (!revoked.ok) {
            return err(revoked.error);
          }
          return ok({
            type: 'result.revokeAccess',
            version: PROTOCOL_VERSION,
            correlationId: command.correlationId,
            payload: { origin, revoked: true },
          });
        }
      }
    },
  };
}

/** Resolves the access origin from the command payload or the tab's current URL. */
async function resolveOrigin(
  payloadOrigin: string | undefined,
  tabId: TabId | undefined,
  deps: CommandRouterDeps,
): Promise<string | undefined> {
  if (payloadOrigin !== undefined) {
    return payloadOrigin;
  }
  if (tabId === undefined) {
    return undefined;
  }
  return originOf(await deps.tabUrl(tabId));
}
