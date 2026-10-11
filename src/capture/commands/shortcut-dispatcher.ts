import {
  resolveBindings,
  shouldHandleShortcut,
  type CommandId,
  type KeyboardContext,
  type TargetLike,
} from '../../core';
import type { CommandsPort, Unsubscribe } from '../../platform/ports';

/** Maps a manifest command name to a {@link CommandId}, or `undefined`. */
const MANIFEST_COMMANDS: Readonly<Record<string, CommandId>> = {
  'toggle-panel': 'toggle-panel',
  'clear-site-data': 'clear-site-data',
  'hard-reload': 'hard-reload',
};

/** Dependencies for {@link createShortcutDispatcher}. */
export interface ShortcutDispatcherDeps {
  readonly commands: CommandsPort;
  readonly dispatch: (id: CommandId) => void;
  readonly customBindings?: Readonly<Record<string, string | null>>;
}

/** Routes manifest commands and in-page keydowns to the command handler. */
export interface ShortcutDispatcher {
  /** Handles a page keydown; returns true when a shortcut was handled. */
  handleKey(event: KeyboardContext, target: TargetLike | null | undefined): boolean;
  /** Subscribes to manifest command events; returns an unsubscribe function. */
  onManifestCommand(handler: (id: CommandId) => void): Unsubscribe;
  dispose(): void;
}

/**
 * Integration point for FR-13: manifest commands and in-page shortcuts both
 * route to the same command handler. In-page keydowns are focus-safe, so a
 * shortcut never fires while the user types in a page input.
 */
export function createShortcutDispatcher(deps: ShortcutDispatcherDeps): ShortcutDispatcher {
  const bindings = resolveBindings(deps.customBindings ?? {});
  const subscriptions: Unsubscribe[] = [];

  const subscribe = (handler: (id: CommandId) => void): Unsubscribe => {
    const unsubscribe = deps.commands.onCommand((name) => {
      const id = MANIFEST_COMMANDS[name];
      if (id !== undefined) {
        handler(id);
      }
    });
    subscriptions.push(unsubscribe);
    return unsubscribe;
  };

  // Register the dispatcher's own handler so manifest commands route on creation.
  subscribe(deps.dispatch);

  return {
    handleKey(event, target) {
      const id = shouldHandleShortcut(event, target, bindings);
      if (id === undefined) {
        return false;
      }
      deps.dispatch(id);
      return true;
    },
    onManifestCommand: (handler) => subscribe(handler),
    dispose() {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      subscriptions.length = 0;
    },
  };
}
