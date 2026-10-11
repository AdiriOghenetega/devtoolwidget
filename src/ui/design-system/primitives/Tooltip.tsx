import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';

/** Props for {@link Tooltip}. */
export interface TooltipProps {
  readonly label: string;
  readonly children: JSX.Element;
}

/** Shows a tooltip on hover/focus, wired to the trigger via `aria-describedby`. */
export function Tooltip({ label, children }: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const id = useRef(`dwt-tooltip-${Math.random().toString(36).slice(2)}`);
  const wrapper = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = wrapper.current;
    if (node === null) {
      return;
    }
    const show = (): void => {
      setVisible(true);
    };
    const hide = (): void => {
      setVisible(false);
    };
    node.addEventListener('mouseenter', show);
    node.addEventListener('mouseleave', hide);
    node.addEventListener('focusin', show);
    node.addEventListener('focusout', hide);
    return () => {
      node.removeEventListener('mouseenter', show);
      node.removeEventListener('mouseleave', hide);
      node.removeEventListener('focusin', show);
      node.removeEventListener('focusout', hide);
    };
  }, []);

  return (
    <span class="dwt-tooltip-wrapper" ref={wrapper}>
      <span aria-describedby={visible ? id.current : undefined}>{children}</span>
      <span
        role="tooltip"
        id={id.current}
        class="dwt-tooltip"
        hidden={!visible}
        aria-label={t('tooltip.label')}
      >
        {label}
      </span>
    </span>
  );
}
