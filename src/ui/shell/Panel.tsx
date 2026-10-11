import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { panelRect, resizePanelSize, type DockMode, type Size, type Viewport } from './geometry';

/** Props for {@link Panel}. */
export interface PanelProps {
  readonly mode: DockMode;
  readonly size: Size;
  readonly viewport?: Viewport;
  readonly onModeChange?: (mode: DockMode) => void;
  readonly onResize?: (size: Size) => void;
  readonly onClose?: () => void;
  /** Element to focus when the panel unmounts; defaults to the previously focused element. */
  readonly restoreFocusTo?: Element | null;
  readonly children?: ComponentChildren;
}

const DOCK_MODES: readonly DockMode[] = ['left', 'right', 'bottom', 'floating'];

const DOCK_LABELS: Readonly<Record<DockMode, string>> = {
  left: t('shell.dock.left'),
  right: t('shell.dock.right'),
  bottom: t('shell.dock.bottom'),
  floating: t('shell.dock.floating'),
};

const BOUNDS = { width: { min: 280, max: 720 }, height: { min: 200, max: 900 } };

/** The dockable, resizable widget panel with focus management. */
export function Panel({
  mode,
  size,
  viewport,
  onModeChange,
  onResize,
  onClose,
  restoreFocusTo,
  children,
}: PanelProps): JSX.Element {
  const ref = useRef<HTMLElement | null>(null);
  const restoreTo = useRef<Element | null>(null);

  useEffect(() => {
    const active = document.activeElement;
    restoreTo.current =
      restoreFocusTo ?? (active instanceof HTMLElement && active !== document.body ? active : null);
    ref.current?.focus();
    return () => {
      const target = restoreTo.current;
      if (target instanceof HTMLElement) {
        target.focus();
      }
    };
  }, [restoreFocusTo]);

  const vp = viewport ?? { width: globalThis.innerWidth, height: globalThis.innerHeight };
  const rect = panelRect(mode, vp, size);

  const startResize = (event: MouseEvent): void => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (move: MouseEvent): void => {
      onResize?.(
        resizePanelSize(
          mode,
          size,
          { width: move.clientX - startX, height: move.clientY - startY },
          BOUNDS,
        ),
      );
    };
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <aside
      ref={ref}
      role="complementary"
      aria-label={t('shell.panel.label')}
      tabIndex={-1}
      class={`dwt-panel dwt-panel--${mode}`}
      style={{
        position: 'fixed',
        left: `${String(rect.x)}px`,
        top: `${String(rect.y)}px`,
        width: `${String(rect.width)}px`,
        height: `${String(rect.height)}px`,
      }}
    >
      <div class="dwt-panel__toolbar">
        {DOCK_MODES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            class="dwt-panel__dock"
            aria-pressed={candidate === mode}
            onClick={() => {
              onModeChange?.(candidate);
            }}
          >
            {DOCK_LABELS[candidate]}
          </button>
        ))}
        <button
          type="button"
          class="dwt-panel__close"
          aria-label={t('shell.close')}
          onClick={() => onClose?.()}
        >
          ✕
        </button>
      </div>
      <div class="dwt-panel__content">{children}</div>
      <div class="dwt-panel__resize" aria-hidden="true" onMouseDown={startResize} />
    </aside>
  );
}
