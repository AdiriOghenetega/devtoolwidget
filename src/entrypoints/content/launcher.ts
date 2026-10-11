import {
  createDragTracker,
  dragLauncherPoint,
  dropLauncherPlacement,
  placementToPoint,
  LAUNCHER_SIZE,
  type LauncherPlacement,
  type Viewport,
} from '../../core';

/**
 * Minimal containment and launcher styling injected at `document_start`, before
 * the shell loads. The full design tokens and shell styles arrive with the
 * lazily imported shell (ADR 0019). The accessible label and title mirror
 * `shell.launcher.label` / `shell.open` as literals: the i18n catalog lives in
 * `ui`, which the `document_start` entry must not import statically (ADR 0019).
 */
export const LAUNCHER_CSS = `
:host { all: initial; }
:host .dwt-launcher {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid #d7dbe0;
  border-radius: 999px;
  background: #ffffff;
  color: #2f6fed;
  font: 16px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  cursor: grab;
  pointer-events: auto;
  z-index: 2147483647;
}
`;

const LAUNCHER_LABEL = 'devToolWidget launcher';
const LAUNCHER_TITLE = 'Open devToolWidget';

/** Handle on the vanilla launcher element. */
export interface LauncherHandle {
  readonly element: HTMLElement;
  setPlacement(placement: LauncherPlacement): void;
  dispose(): void;
}

/** Options for {@link createLauncher}. */
export interface LauncherOptions {
  readonly doc: Document;
  readonly viewport: () => Viewport;
  readonly placement: LauncherPlacement;
  readonly onOpen: () => void;
  readonly onPlacementChange: (placement: LauncherPlacement) => void;
}

/**
 * A tiny vanilla-DOM launcher (no Preact). Clicking it opens the shell; dragging
 * repositions it and snaps to the nearest edge on release. It keeps the
 * `.dwt-launcher` class so existing selectors keep working, and it is disposed on
 * handoff so a second launcher is never rendered (ADR 0019).
 */
export function createLauncher(options: LauncherOptions): LauncherHandle {
  const { doc } = options;
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = 'dwt-launcher';
  element.setAttribute('aria-label', LAUNCHER_LABEL);
  element.title = LAUNCHER_TITLE;
  const glyph = doc.createElement('span');
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = '◆';
  element.append(glyph);

  const tracker = createDragTracker();
  let placement = options.placement;
  let dragging = false;

  const position = (at: LauncherPlacement): void => {
    const point = placementToPoint(at, options.viewport(), LAUNCHER_SIZE);
    element.style.left = `${String(point.x)}px`;
    element.style.top = `${String(point.y)}px`;
  };

  const onMove = (event: MouseEvent): void => {
    tracker.move();
    const next = dragLauncherPoint(event.clientX, event.clientY, options.viewport(), LAUNCHER_SIZE);
    element.style.left = `${String(next.x)}px`;
    element.style.top = `${String(next.y)}px`;
  };
  const onUp = (event: MouseEvent): void => {
    doc.removeEventListener('mousemove', onMove);
    doc.removeEventListener('mouseup', onUp);
    if (!dragging) {
      return;
    }
    dragging = false;
    const point = dragLauncherPoint(
      event.clientX,
      event.clientY,
      options.viewport(),
      LAUNCHER_SIZE,
    );
    placement = dropLauncherPlacement(point, options.viewport(), LAUNCHER_SIZE);
    position(placement);
    options.onPlacementChange(placement);
  };

  element.addEventListener('mousedown', (event) => {
    event.preventDefault();
    tracker.begin();
    dragging = true;
    doc.addEventListener('mousemove', onMove);
    doc.addEventListener('mouseup', onUp);
  });
  element.addEventListener('click', () => {
    if (!tracker.moved) {
      options.onOpen();
    }
  });

  position(placement);

  return {
    element,
    setPlacement(next) {
      placement = next;
      position(next);
    },
    dispose() {
      doc.removeEventListener('mousemove', onMove);
      doc.removeEventListener('mouseup', onUp);
      element.remove();
    },
  };
}
