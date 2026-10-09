import { err, ok, type Result, type TabId } from '../../core';
import { platformError, type PlatformError } from '../../platform/ports/errors';
import { PROTOCOL_VERSION, type CommandMessage, type ResultMessage } from '../../protocol';
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
}

/**
 * Routes a validated command to its handler. Expected failures return `err`;
 * unknown commands return an `unsupported` error. Handlers orchestrate the
 * platform ports and the session registry — no browser API is touched here.
 */
export function createCommandRouter(deps: CommandRouterDeps): CommandRouter {
  return {
    async handle(command, context) {
      switch (command.type) {
        case 'command.ping': {
          if (context.tabId !== undefined) {
            const updated = await deps.registry.upsert(context.tabId, { agentConnected: true });
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
        default:
          return err(platformError('unsupported', `No handler for "${command.type}"`));
      }
    },
  };
}
