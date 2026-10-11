import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { type CaptureLevel, type Settings, type Theme } from '../../core';
import { migrateSettings } from '../../protocol';
import { t } from '../i18n';
import { Button } from '../design-system/primitives/Button';
import { Checkbox } from '../design-system/primitives/Checkbox';
import { Dialog } from '../design-system/primitives/Dialog';
import { Select } from '../design-system/primitives/Select';
import { exportSettings, importSettings } from './settings-io';

/** Props for {@link OptionsPage}. */
export interface OptionsPageProps {
  readonly settings: Settings;
  readonly onSave: (settings: Settings) => void;
  readonly onDeleteAll: () => void;
  readonly onExport?: (text: string) => void;
}

const CAPTURE_LEVELS: readonly CaptureLevel[] = ['minimal', 'standard', 'deep'];
const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
const THRESHOLD_KEYS = [
  'slowRequestTotal',
  'slowRequestTtfb',
  'largePayload',
  'largeImage',
  'uncompressedText',
  'duplicateRequestWindow',
  'maxRequests',
  'maxDistinctOrigins',
] as const;

function omitKey<T extends object>(record: T, key: string): T {
  return Object.fromEntries(Object.entries(record).filter(([candidate]) => candidate !== key)) as T;
}
/** The options page (FR-11): a validated settings editor plus data & privacy controls. */
export function OptionsPage({
  settings,
  onSave,
  onDeleteAll,
  onExport,
}: OptionsPageProps): JSX.Element {
  const [draft, setDraft] = useState<Settings>(settings);
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [importText, setImportText] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [originDraft, setOriginDraft] = useState('');

  const save = (): void => {
    const result = migrateSettings(draft);
    if (!result.ok) {
      setStatus(undefined);
      setError(result.error.message);
      return;
    }
    setError(undefined);
    onSave(result.value);
    setStatus(t('options.saved'));
  };

  const runImport = (): void => {
    const result = importSettings(importText);
    if (!result.ok) {
      setStatus(undefined);
      setError(result.error.message);
      return;
    }
    setDraft(result.value);
    setError(undefined);
    setStatus(t('options.saved'));
  };

  return (
    <main class="dwt-options" aria-label={t('options.title')}>
      <h1>{t('options.title')}</h1>

      <Select
        label={t('options.captureLevel')}
        value={draft.captureLevel}
        options={CAPTURE_LEVELS.map((level) => ({ value: level, label: level }))}
        onChange={(value) => {
          setDraft({ ...draft, captureLevel: value as CaptureLevel });
        }}
      />

      <section aria-label={t('options.perOrigin')}>
        <h2>{t('options.perOrigin')}</h2>
        <ul>
          {Object.entries(draft.perOriginProfiles).map(([origin, profile]) => (
            <li key={origin}>
              <span>{origin}</span> â€” {profile.captureLevel}
              <Button
                onClick={() => {
                  setDraft({
                    ...draft,
                    perOriginProfiles: omitKey(draft.perOriginProfiles, origin),
                  });
                }}
              >
                {t('options.remove')}
              </Button>
            </li>
          ))}
        </ul>
        <label>
          <span>{t('options.origin')}</span>
          <input
            aria-label={t('options.origin')}
            value={originDraft}
            onInput={(event) => {
              setOriginDraft(event.currentTarget.value);
            }}
          />
        </label>
        <Button
          onClick={() => {
            if (originDraft !== '') {
              setDraft({
                ...draft,
                perOriginProfiles: {
                  ...draft.perOriginProfiles,
                  [originDraft]: { captureLevel: 'standard', bodyCapture: false },
                },
              });
              setOriginDraft('');
            }
          }}
        >
          {t('options.addOrigin')}
        </Button>
      </section>

      <section aria-label={t('options.thresholds')}>
        <h2>{t('options.thresholds')}</h2>
        {THRESHOLD_KEYS.map((key) => (
          <label key={key}>
            <span>{key}</span>
            <input
              type="number"
              aria-label={key}
              value={draft.thresholds[key] ?? ''}
              onInput={(event) => {
                const raw = event.currentTarget.value;
                const thresholds =
                  raw === ''
                    ? omitKey(draft.thresholds, key)
                    : { ...draft.thresholds, [key]: Number(raw) };
                setDraft({ ...draft, thresholds });
              }}
            />
          </label>
        ))}
      </section>

      <section aria-label={t('options.redaction')}>
        <h2>{t('options.redaction')}</h2>
        <ul>
          {draft.redactionRules.map((rule) => (
            <li key={rule.name}>
              {rule.name}
              <Button
                onClick={() => {
                  setDraft({
                    ...draft,
                    redactionRules: draft.redactionRules.filter(
                      (candidate) => candidate.name !== rule.name,
                    ),
                  });
                }}
              >
                {t('options.remove')}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={t('options.retention')}>
        <h2>{t('options.retention')}</h2>
        <label>
          <span>{t('options.maxSnapshots')}</span>
          <input
            type="number"
            aria-label={t('options.maxSnapshots')}
            value={draft.retention.maxSnapshots}
            onInput={(event) => {
              setDraft({
                ...draft,
                retention: {
                  ...draft.retention,
                  maxSnapshots: Number(event.currentTarget.value),
                },
              });
            }}
          />
        </label>
        <label>
          <span>{t('options.maxAgeDays')}</span>
          <input
            type="number"
            aria-label={t('options.maxAgeDays')}
            value={draft.retention.maxAgeDays}
            onInput={(event) => {
              setDraft({
                ...draft,
                retention: { ...draft.retention, maxAgeDays: Number(event.currentTarget.value) },
              });
            }}
          />
        </label>
      </section>

      <Select
        label={t('options.theme')}
        value={draft.theme}
        options={THEMES.map((theme) => ({ value: theme, label: theme }))}
        onChange={(value) => {
          setDraft({ ...draft, theme: value as Theme });
        }}
      />

      <section aria-label={t('options.shortcuts')}>
        <h2>{t('options.shortcuts')}</h2>
        <ul>
          {Object.entries(draft.shortcuts).map(([command, chord]) => (
            <li key={command}>
              {command}: {chord ?? '-'}
              <Button
                onClick={() => {
                  setDraft({ ...draft, shortcuts: omitKey(draft.shortcuts, command) });
                }}
              >
                {t('options.remove')}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <Checkbox
        label="onboardingCompleted"
        checked={draft.onboardingCompleted}
        onChange={(checked) => {
          setDraft({ ...draft, onboardingCompleted: checked });
        }}
      />

      <div class="dwt-options__io">
        <textarea
          aria-label={t('options.importPlaceholder')}
          placeholder={t('options.importPlaceholder')}
          value={importText}
          onInput={(event) => {
            setImportText(event.currentTarget.value);
          }}
        />
        <Button onClick={runImport}>{t('options.import')}</Button>
        <Button
          onClick={() => {
            onExport?.(exportSettings(draft));
          }}
        >
          {t('options.export')}
        </Button>
      </div>

      <Button variant="primary" onClick={save}>
        {t('options.save')}
      </Button>
      {error !== undefined && (
        <p role="alert" class="dwt-options__error">
          {t('options.saveFailed', { reason: error })}
        </p>
      )}
      {status !== undefined && <p role="status">{status}</p>}

      <section aria-label={t('options.data.title')}>
        <h2>{t('options.data.title')}</h2>
        <p>{t('options.data.body')}</p>
        <Button
          onClick={() => {
            setConfirmingDelete(true);
          }}
        >
          {t('options.data.deleteAll')}
        </Button>
      </section>

      <Dialog
        open={confirmingDelete}
        title={t('options.data.confirm.title')}
        onClose={() => {
          setConfirmingDelete(false);
        }}
        onConfirm={() => {
          onDeleteAll();
          setConfirmingDelete(false);
          setStatus(t('options.data.deleted'));
        }}
      >
        <p>{t('options.data.confirm.body')}</p>
      </Dialog>
    </main>
  );
}
