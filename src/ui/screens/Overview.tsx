import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ActionRef, Finding, ThrottleProfile } from '../../core';
import { t } from '../i18n';
import { Badge } from '../design-system/primitives/Badge';
import { Button } from '../design-system/primitives/Button';
import { Dialog } from '../design-system/primitives/Dialog';
import { EmptyState } from '../design-system/primitives/EmptyState';
import { Select } from '../design-system/primitives/Select';
import { Switch } from '../design-system/primitives/Switch';
import type { OverviewStore } from '../state';

/** Props for {@link Overview}. */
export interface OverviewProps {
  readonly store: OverviewStore;
  readonly dispatch: (action: ActionRef) => void;
  readonly onRetry?: () => void;
}

const THROTTLE_OPTIONS: readonly { value: ThrottleProfile; label: string }[] = [
  { value: 'offline', label: 'Offline' },
  { value: 'slow-3g', label: 'Slow 3G' },
  { value: 'fast-3g', label: 'Fast 3G' },
  { value: '4g', label: '4G' },
];

function isDestructive(action: ActionRef): boolean {
  return action.type === 'clearStorage';
}

function FindingCard({
  finding,
  onAction,
}: {
  readonly finding: Finding;
  readonly onAction: (action: ActionRef) => void;
}): JSX.Element {
  return (
    <article class="dwt-finding">
      <header class="dwt-finding__head">
        <Badge severity={finding.severity} />
        <h3 class="dwt-finding__title">{finding.title}</h3>
      </header>
      <ul class="dwt-finding__evidence">
        {finding.evidence.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      <p class="dwt-finding__suggestion">{finding.suggestion}</p>
      {finding.actions.length > 0 && (
        <div class="dwt-finding__actions">
          {finding.actions.map((action, index) => (
            <Button
              key={index}
              onClick={() => {
                onAction(action);
              }}
            >
              {action.type}
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}

/**
 * The Overview screen (PRD FR-2): health score with a category breakdown, the
 * top three finding cards (evidence, suggestion, typed actions), live counters
 * and a quick-actions bar. Loading, empty, error and disconnected states are
 * shown explicitly.
 */
export function Overview({ store, dispatch, onRetry }: OverviewProps): JSX.Element {
  const [pending, setPending] = useState<ActionRef | undefined>(undefined);
  const [cacheDisabled, setCacheDisabled] = useState(false);
  const [throttle, setThrottle] = useState<ThrottleProfile>('4g');

  const request = (action: ActionRef): void => {
    if (isDestructive(action)) {
      setPending(action);
      return;
    }
    dispatch(action);
  };

  const status = store.connection.value;

  if (status === 'connecting' && store.isEmpty.value) {
    return <output class="dwt-overview__state">{t('overview.loading')}</output>;
  }
  if (status === 'error') {
    return (
      <div class="dwt-overview__state">
        <p>{t('overview.error')}</p>
        {onRetry !== undefined && <Button onClick={onRetry}>{t('overview.retry')}</Button>}
      </div>
    );
  }
  if (status === 'disconnected') {
    return (
      <div class="dwt-overview__state">
        <p>{t('overview.disconnected')}</p>
        {onRetry !== undefined && <Button onClick={onRetry}>{t('overview.retry')}</Button>}
      </div>
    );
  }
  if (store.isEmpty.value) {
    return <EmptyState description={t('overview.empty')} />;
  }

  const health = store.health.value;
  const breakdown: readonly (readonly [string, number])[] = [
    [t('overview.category.network'), health.byCategory.network],
    [t('overview.category.performance'), health.byCategory.performance],
    [t('overview.category.console'), health.byCategory.console],
    [t('overview.category.storage'), health.byCategory.storage],
  ];
  const topFindings = store.topFindings.value;

  return (
    <section class="dwt-overview" aria-label={t('overview.title')}>
      <div class="dwt-overview__health">
        <output
          class="dwt-overview__score"
          aria-label={t('overview.health', { score: health.score })}
        >
          {health.score}
        </output>
        <ul class="dwt-overview__breakdown">
          {breakdown.map(([label, score]) => (
            <li key={label}>
              {label}: {score}
            </li>
          ))}
        </ul>
      </div>

      <div class="dwt-overview__counters">
        <span>{t('overview.counters.console', { count: store.consoleErrors.value })}</span>
        <span>{t('overview.counters.network', { count: store.networkCount.value })}</span>
      </div>

      <div class="dwt-overview__findings">
        {topFindings.length === 0 ? (
          <p>{t('overview.findings.none')}</p>
        ) : (
          topFindings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} onAction={request} />
          ))
        )}
      </div>

      <div class="dwt-overview__quick-actions" role="group" aria-label={t('overview.title')}>
        <Button
          onClick={() => {
            request({ type: 'clearStorage', preset: 'fresh-visitor' });
          }}
        >
          {t('overview.action.clearData')}
        </Button>
        <Button
          onClick={() => {
            dispatch({ type: 'hardReload' });
          }}
        >
          {t('overview.action.hardReload')}
        </Button>
        <Switch
          label={t('overview.action.disableCache')}
          checked={cacheDisabled}
          onChange={(checked) => {
            setCacheDisabled(checked);
            dispatch({ type: 'toggleDisableCache', enabled: checked });
          }}
        />
        <Select
          label={t('overview.action.throttle')}
          options={THROTTLE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          value={throttle}
          onChange={(value) => {
            setThrottle(value as ThrottleProfile);
            dispatch({ type: 'setThrottle', profile: value as ThrottleProfile });
          }}
        />
        <Button
          onClick={() => {
            dispatch({ type: 'exportReport', format: 'markdown' });
          }}
        >
          {t('overview.action.export')}
        </Button>
      </div>

      <Dialog
        open={pending !== undefined}
        onConfirm={() => {
          if (pending !== undefined) {
            dispatch(pending);
          }
          setPending(undefined);
        }}
        title={t('overview.confirm.clear.title')}
        onClose={() => {
          setPending(undefined);
        }}
      >
        <p>{t('overview.confirm.clear.body')}</p>
      </Dialog>
    </section>
  );
}
