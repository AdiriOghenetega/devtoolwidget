import type { LauncherPlacement } from './geometry';

/**
 * The shell's persisted state, expressed as an interface so the UI layer stays
 * free of the platform storage port; the content script injects an adapter
 * backed by the storage port.
 */
export interface ShellPersistence {
  loadLauncher(origin: string): Promise<LauncherPlacement | undefined>;
  saveLauncher(origin: string, placement: LauncherPlacement): Promise<void>;
  isSiteDisabled(origin: string): Promise<boolean>;
  setSiteDisabled(origin: string, disabled: boolean): Promise<void>;
}
