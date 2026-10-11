import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { diffSnapshots, type SavedSnapshot } from '../../core';
import { t } from '../i18n';
import { Button } from '../design-system/primitives/Button';
import { EmptyState } from '../design-system/primitives/EmptyState';

/** Props for {@link SnapshotsScreen}. */
export interface SnapshotsScreenProps {
  readonly snapshots: readonly SavedSnapshot[];
  readonly onCapture: (label: string) => void;
  readonly onDelete: (id: string) => void;
}

function arrowFor(direction: 'up' | 'down' | 'same'): string {
  return direction === 'up' ? '▲' : direction === 'down' ? '▼' : '=';
}

/** Snapshots screen (FR-9): capture, list, delete and a visual two-snapshot diff. */
export function SnapshotsScreen({
  snapshots,
  onCapture,
  onDelete,
}: SnapshotsScreenProps): JSX.Element {
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<readonly string[]>([]);

  const toggle = (id: string): void => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id].slice(-2),
    );
  };

  const first = snapshots.find((snapshot) => snapshot.id === selected[0]);
  const second = snapshots.find((snapshot) => snapshot.id === selected[1]);
  const diff =
    first !== undefined && second !== undefined ? diffSnapshots(first, second) : undefined;

  return (
    <section class="dwt-snapshots" aria-label={t('snapshots.title')}>
      <div class="dwt-snapshots__capture">
        <label>
          <span>{t('snapshots.label')}</span>
          <input
            aria-label={t('snapshots.label')}
            value={label}
            onInput={(event) => {
              setLabel(event.currentTarget.value);
            }}
          />
        </label>
        <Button
          variant="primary"
          onClick={() => {
            onCapture(label);
            setLabel('');
          }}
        >
          {t('snapshots.capture')}
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <EmptyState description={t('snapshots.empty')} />
      ) : (
        <ul class="dwt-snapshots__list">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id}>
              <label>
                <input
                  type="checkbox"
                  aria-label={snapshot.label}
                  checked={selected.includes(snapshot.id)}
                  onChange={() => {
                    toggle(snapshot.id);
                  }}
                />
                <span>
                  {snapshot.label} — {Number(snapshot.createdAt)}
                </span>
              </label>
              <Button
                onClick={() => {
                  onDelete(snapshot.id);
                }}
              >
                {t('snapshots.delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {snapshots.length > 0 && selected.length < 2 && (
        <p class="dwt-snapshots__hint">{t('snapshots.selectTwo')}</p>
      )}

      {diff !== undefined && (
        <div class="dwt-snapshots__diff" role="region" aria-label={t('snapshots.compare')}>
          {!diff.changed ? (
            <p>{t('snapshots.noChanges')}</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>{t('snapshots.metric')}</th>
                    <th>{t('snapshots.before')}</th>
                    <th>{t('snapshots.after')}</th>
                    <th>{t('snapshots.delta')}</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.metrics
                    .filter((metric) => metric.direction !== 'same')
                    .map((metric) => (
                      <tr
                        key={metric.name}
                        data-direction={metric.direction}
                        data-significant={metric.significant}
                        class={metric.significant ? 'dwt-diff--significant' : undefined}
                      >
                        <td>{metric.name}</td>
                        <td>{metric.before}</td>
                        <td>{metric.after}</td>
                        <td>
                          {arrowFor(metric.direction)} {metric.delta}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              <h3>{t('snapshots.newFindings')}</h3>
              <ul>
                {diff.newFindings.map((finding) => (
                  <li key={finding.id}>{finding.title}</li>
                ))}
              </ul>
              <h3>{t('snapshots.resolvedFindings')}</h3>
              <ul>
                {diff.resolvedFindings.map((finding) => (
                  <li key={finding.id}>{finding.title}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
