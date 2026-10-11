import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import {
  formatBytes,
  type ClearReport,
  type ClearRequest,
  type ClearType,
  type StorageSummary,
} from '../../core';
import { t } from '../i18n';
import { Button } from '../design-system/primitives/Button';
import { Dialog } from '../design-system/primitives/Dialog';
import { EmptyState } from '../design-system/primitives/EmptyState';
import { KeyValue } from '../design-system/primitives/KeyValue';
import { Select } from '../design-system/primitives/Select';

type Preset = 'fresh-visitor' | 'clear-everything-and-reload';

const PRESET_TYPES: Readonly<Record<Preset, readonly ClearType[]>> = {
  'fresh-visitor': [
    'cookies',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'cacheStorage',
    'serviceWorkers',
  ],
  'clear-everything-and-reload': [
    'cookies',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'cacheStorage',
    'serviceWorkers',
    'httpCache',
  ],
};

/** Props for {@link StorageScreen}. */
export interface StorageScreenProps {
  readonly summary: StorageSummary;
  readonly report?: ClearReport;
  readonly onClear: (request: ClearRequest) => void;
}

/** Storage screen (FR-6): inspector, presets, keep-list, confirmation and the ClearReport view. */
export function StorageScreen({ summary, report, onClear }: StorageScreenProps): JSX.Element {
  const [preset, setPreset] = useState<Preset>('fresh-visitor');
  const [keep, setKeep] = useState<readonly string[]>([]);
  const [keepDraft, setKeepDraft] = useState('');
  const [confirming, setConfirming] = useState(false);

  const addKeep = (): void => {
    const key = keepDraft.trim();
    if (key !== '' && !keep.includes(key)) {
      setKeep([...keep, key]);
    }
    setKeepDraft('');
  };

  return (
    <section class="dwt-storage" aria-label={t('storage.title')}>
      {summary.areas.length === 0 ? (
        <EmptyState description={t('storage.empty')} />
      ) : (
        <KeyValue
          items={summary.areas.map((area) => ({
            key: area.area,
            value: `${String(area.count)} · ${formatBytes(Number(area.approximateSize))}`,
          }))}
        />
      )}

      <Select
        label={t('storage.preset')}
        value={preset}
        options={[
          { value: 'fresh-visitor', label: t('storage.preset.freshVisitor') },
          { value: 'clear-everything-and-reload', label: t('storage.preset.clearAll') },
        ]}
        onChange={(value) => {
          setPreset(value as Preset);
        }}
      />

      <div class="dwt-storage__keep">
        <label>
          <span>{t('storage.keepList')}</span>
          <input
            aria-label={t('storage.keepList')}
            placeholder={t('storage.keepPlaceholder')}
            value={keepDraft}
            onInput={(event) => {
              setKeepDraft(event.currentTarget.value);
            }}
          />
        </label>
        <Button onClick={addKeep}>{t('storage.add')}</Button>
        <ul class="dwt-storage__keep-list">
          {keep.map((key) => (
            <li key={key}>
              {key}{' '}
              <Button
                onClick={() => {
                  setKeep(keep.filter((candidate) => candidate !== key));
                }}
              >
                {t('storage.remove')}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <Button
        variant="primary"
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t('storage.clear')}
      </Button>

      <Dialog
        open={confirming}
        title={t('storage.confirm.title')}
        onClose={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          onClear({ types: PRESET_TYPES[preset], keep, scope: 'origin' });
          setConfirming(false);
        }}
      >
        <p>{t('storage.confirm.body')}</p>
      </Dialog>

      {report !== undefined && (
        <div class="dwt-storage__report" role="region" aria-label={t('storage.report.title')}>
          <h3>{t('storage.report.title')}</h3>
          <p>
            {t('storage.report.steps', {
              ok: report.results.filter((result) => result.ok).length,
              total: report.results.length,
              bytes: formatBytes(report.bytesFreed),
            })}
          </p>
          <ul>
            {report.results.map((result) => (
              <li key={result.stepId}>
                {result.stepId}:{' '}
                {result.ok ? t('storage.report.succeeded') : t('storage.report.failed')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
