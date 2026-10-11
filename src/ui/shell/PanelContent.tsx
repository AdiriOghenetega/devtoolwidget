import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ActionRef } from '../../core';
import { t } from '../i18n';
import { Tabs, type TabItem } from '../design-system/primitives/Tabs';
import { ConsoleScreen } from '../screens/ConsoleScreen';
import { NetworkScreen } from '../screens/NetworkScreen';
import { Overview } from '../screens/Overview';
import { PerformanceScreen } from '../screens/PerformanceScreen';
import type { OverviewStore } from '../state';

/** Props for {@link PanelContent}. */
export interface PanelContentProps {
  readonly store: OverviewStore;
  readonly dispatch: (action: ActionRef) => void;
  readonly onRetry?: () => void;
}

/**
 * The panel's tabbed content: Overview plus the console, network and performance
 * detail screens, all fed from the shared {@link OverviewStore} signals (PRD
 * FR-2, FR-3, FR-4, FR-5). Screens are read-only here; the quick actions and
 * finding actions are dispatched back over the panel port. The storage and
 * snapshots tabs arrive with their command handlers (Slices C).
 */
export function PanelContent({ store, dispatch, onRetry }: PanelContentProps): JSX.Element {
  const [preserveLog, setPreserveLog] = useState(false);

  const tabs: readonly TabItem[] = [
    {
      id: 'overview',
      label: t('overview.title'),
      panel: (
        <Overview
          store={store}
          dispatch={dispatch}
          {...(onRetry === undefined ? {} : { onRetry })}
        />
      ),
    },
    {
      id: 'console',
      label: t('console.title'),
      panel: (
        <ConsoleScreen
          entries={store.console.value}
          preserveLog={preserveLog}
          onPreserveLogChange={setPreserveLog}
        />
      ),
    },
    {
      id: 'network',
      label: t('network.title'),
      panel: <NetworkScreen entries={store.network.value} />,
    },
    {
      id: 'performance',
      label: t('performance.title'),
      panel: <PerformanceScreen vitals={store.vitals.value} longTasks={store.longTasks.value} />,
    },
  ];

  return <Tabs tabs={tabs} ariaLabel={t('tabs.label')} />;
}
