import type { JSX } from 'preact';
import type { OverviewStore } from '../state';
import { Shell, type LoadPanel, type ShellControlsRef } from './Shell';
import type { ShellPersistence } from './persistence';

/** Props for {@link Widget}. */
export interface WidgetProps {
  readonly origin: string;
  readonly topFrame: boolean;
  readonly persistence: ShellPersistence;
  readonly loadPanel: LoadPanel;
  readonly store: OverviewStore;
  /** Opens the panel on mount when the first interaction handed off (ADR 0019). */
  readonly initialOpen?: boolean;
  /** Optional imperative controls the content script uses to re-open the panel. */
  readonly controls?: ShellControlsRef;
}

/**
 * The in-page widget root (PRD FR-1, FR-2): it renders the {@link Shell} with the
 * live health score and console-error count from the store, so the launcher badge
 * updates as capture event deltas arrive over the panel port.
 */
export function Widget({
  origin,
  topFrame,
  persistence,
  loadPanel,
  store,
  initialOpen,
  controls,
}: WidgetProps): JSX.Element {
  return (
    <Shell
      origin={origin}
      topFrame={topFrame}
      score={store.health.value.score}
      errorCount={store.consoleErrors.value}
      persistence={persistence}
      loadPanel={loadPanel}
      {...(initialOpen === undefined ? {} : { initialOpen })}
      {...(controls === undefined ? {} : { controls })}
    />
  );
}
