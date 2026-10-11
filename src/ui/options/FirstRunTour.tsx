import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { Button } from '../design-system/primitives/Button';

/** Props for {@link FirstRunTour}. */
export interface FirstRunTourProps {
  readonly onFinish: () => void;
}

const PERMISSION_KEYS = [
  'tour.permissions.storage',
  'tour.permissions.tabs',
  'tour.permissions.scripting',
  'tour.permissions.browsingData',
] as const;

/**
 * The first-run tour (PRD FR-14): a short, plain-language walkthrough of what the
 * widget does, what each permission is for, and the data-handling statement.
 */
export function FirstRunTour({ onFinish }: FirstRunTourProps): JSX.Element {
  const [step, setStep] = useState(0);
  const last = 2;

  return (
    <section class="dwt-tour" aria-label={t('tour.title')}>
      <h1>{t('tour.title')}</h1>

      {step === 0 && <p class="dwt-tour__body">{t('tour.welcome.body')}</p>}

      {step === 1 && (
        <div>
          <h2>{t('tour.permissions.title')}</h2>
          <ul class="dwt-tour__permissions">
            {PERMISSION_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      )}

      {step === last && <p class="dwt-tour__body">{t('tour.dataHandling')}</p>}

      <div class="dwt-tour__actions">
        {step > 0 && (
          <Button
            onClick={() => {
              setStep(step - 1);
            }}
          >
            {t('tour.back')}
          </Button>
        )}
        {step < last ? (
          <Button
            variant="primary"
            onClick={() => {
              setStep(step + 1);
            }}
          >
            {t('tour.next')}
          </Button>
        ) : (
          <Button variant="primary" onClick={onFinish}>
            {t('tour.finish')}
          </Button>
        )}
      </div>
    </section>
  );
}
