import type { LauncherPlacement } from './geometry';

/**
 * The persistence contract the shell needs (PRD FR-1): the launcher placement and
 * the per-site disabled flag. It lives in `core` so the lazy shell and the
 * `document_start` launcher share one definition, and so the content bootstrap
 * never imports `ui` (ADR 0019). The content script injects an adapter backed by
 * the platform storage port.
 */
export interface ShellPersistence {
  loadLauncher(origin: string): Promise<LauncherPlacement | undefined>;
  saveLauncher(origin: string, placement: LauncherPlacement): Promise<void>;
  isSiteDisabled(origin: string): Promise<boolean>;
  setSiteDisabled(origin: string, disabled: boolean): Promise<void>;
}
