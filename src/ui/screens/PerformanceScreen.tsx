import type { JSX } from 'preact';
import {
  formatBytes,
  summarizeResources,
  type LongTask,
  type ResourceSample,
  type VitalMetric,
} from '../../core';
import { t } from '../i18n';
import { Badge, type BadgeSeverity } from '../design-system/primitives/Badge';
import { EmptyState } from '../design-system/primitives/EmptyState';
import { KeyValue } from '../design-system/primitives/KeyValue';

/** Props for {@link PerformanceScreen}. */
export interface PerformanceScreenProps {
  readonly vitals: readonly VitalMetric[];
  readonly longTasks: readonly LongTask[];
  readonly resources?: readonly ResourceSample[];
}

function severityOf(rating: VitalMetric['rating']): BadgeSeverity {
  if (rating === 'poor') {
    return 'critical';
  }
  return rating === 'needs-improvement' ? 'warning' : 'info';
}

/** Performance screen (FR-5): vitals with their states, a long-task timeline and a resource summary. */
export function PerformanceScreen({
  vitals,
  longTasks,
  resources,
}: PerformanceScreenProps): JSX.Element {
  const summary = summarizeResources(resources ?? []);
  const maxTask = Math.max(1, ...longTasks.map((task) => Number(task.duration)));

  const empty = vitals.length === 0 && longTasks.length === 0 && (resources?.length ?? 0) === 0;
  if (empty) {
    return <EmptyState description={t('performance.empty')} />;
  }

  return (
    <section class="dwt-performance" aria-label={t('performance.title')}>
      <h3>{t('performance.vitals')}</h3>
      <ul class="dwt-performance__vitals">
        {vitals.map((metric) => (
          <li key={metric.name} class="dwt-performance__vital" data-rating={metric.rating}>
            <Badge severity={severityOf(metric.rating)}>{metric.name}</Badge>
            <span class="dwt-performance__value">{metric.value}</span>
            <span class="dwt-performance__rating">{t(`performance.rating.${metric.rating}`)}</span>
          </li>
        ))}
      </ul>

      <h3>{t('performance.longTasks')}</h3>
      {longTasks.length === 0 ? (
        <p class="dwt-performance__none">{t('performance.empty')}</p>
      ) : (
        <ul class="dwt-performance__tasks">
          {longTasks.map((task, index) => (
            <li
              key={index}
              class="dwt-performance__task"
              style={{ width: `${String((Number(task.duration) / maxTask) * 100)}%` }}
              title={`${String(Number(task.duration))} ms`}
            >
              {Number(task.duration)} ms
            </li>
          ))}
        </ul>
      )}

      <h3>{t('performance.resources')}</h3>
      <KeyValue
        items={[
          { key: 'Requests', value: String(summary.count) },
          { key: 'Transfer', value: formatBytes(summary.transferBytes) },
          { key: 'Decoded', value: formatBytes(summary.decodedBytes) },
          { key: 'Render-blocking', value: String(summary.renderBlockingCount) },
        ]}
      />
    </section>
  );
}
