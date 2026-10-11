import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n';
import { Button } from './Button';
import { IconButton } from './IconButton';

/** Props for {@link Dialog}. */
export interface DialogProps {
  readonly open: boolean;
  readonly title?: string;
  readonly children?: ComponentChildren;
  readonly onClose?: () => void;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** A modal dialog with a focus trap, Escape-to-close and focus restoration. */
export function Dialog({ open, title, children, onClose }: DialogProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    restoreTo.current = document.activeElement;
    const node = ref.current;
    const focusables = node?.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab' || node === null) {
        return;
      }
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      (restoreTo.current as HTMLElement | null)?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div class="dwt-dialog__backdrop" onClick={() => onClose?.()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? t('dialog.label')}
        class="dwt-dialog"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {title !== undefined && <h2 class="dwt-dialog__title">{title}</h2>}
        <div class="dwt-dialog__body">{children}</div>
        <div class="dwt-dialog__actions">
          <Button onClick={() => onClose?.()}>{t('dialog.cancel')}</Button>
          <Button variant="primary" onClick={() => onClose?.()}>
            {t('dialog.confirm')}
          </Button>
          <IconButton ariaLabel={t('common.close')} onClick={() => onClose?.()}>
            ✕
          </IconButton>
        </div>
      </div>
    </div>
  );
}
