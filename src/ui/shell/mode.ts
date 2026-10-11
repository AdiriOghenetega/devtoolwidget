/** How the widget is presented. */
export type ShellMode = 'side-panel' | 'overlay';

/** What the platform reports about the Chrome side panel. */
export interface SidePanelCapability {
  readonly available: boolean;
  /** Opens the side panel for the tab, if the platform supports it. */
  readonly open?: () => Promise<{ readonly ok: boolean }>;
}

/**
 * Chooses the shell mode: the Chrome side panel when the platform supports it,
 * otherwise the in-page overlay (graceful fallback).
 */
export function resolveShellMode(capability: SidePanelCapability): ShellMode {
  return capability.available ? 'side-panel' : 'overlay';
}
