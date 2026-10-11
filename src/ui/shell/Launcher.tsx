import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import {
  clampToViewport,
  placementToPoint,
  snapToEdge,
  type LauncherPlacement,
  type Size,
  type Viewport,
} from './geometry';

/** Props for {@link Launcher}. */
export interface LauncherProps {
  readonly placement: LauncherPlacement;
  readonly size?: Size;
  readonly viewport?: Viewport;
  readonly onOpen?: () => void;
  readonly onPlacementChange?: (placement: LauncherPlacement) => void;
}

const DEFAULT_SIZE: Size = { width: 44, height: 44 };

function currentViewport(viewport: Viewport | undefined): Viewport {
  return viewport ?? { width: globalThis.innerWidth, height: globalThis.innerHeight };
}

/** A draggable launcher that snaps to the nearest edge on release. */
export function Launcher({
  placement,
  size = DEFAULT_SIZE,
  viewport,
  onOpen,
  onPlacementChange,
}: LauncherProps): JSX.Element {
  const [dragPoint, setDragPoint] = useState<
    { readonly x: number; readonly y: number } | undefined
  >();
  const moved = useRef(false);
  const pointRef = useRef({ x: 0, y: 0 });

  const restingPoint = placementToPoint(placement, currentViewport(viewport), size);
  const point = dragPoint ?? restingPoint;

  useEffect(() => {
    if (dragPoint === undefined) {
      pointRef.current = restingPoint;
    }
  }, [dragPoint, restingPoint]);

  useEffect(() => {
    if (dragPoint === undefined) {
      return;
    }
    const onMove = (event: MouseEvent): void => {
      moved.current = true;
      const vp = currentViewport(viewport);
      const next = clampToViewport(
        { x: event.clientX - size.width / 2, y: event.clientY - size.height / 2 },
        vp,
        size,
      );
      pointRef.current = next;
      setDragPoint(next);
    };
    const onUp = (): void => {
      const vp = currentViewport(viewport);
      const snapped = snapToEdge(pointRef.current, vp, size);
      setDragPoint(undefined);
      onPlacementChange?.(snapped);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragPoint, size, viewport, onPlacementChange]);

  return (
    <button
      type="button"
      class="dwt-launcher"
      aria-label={t('shell.launcher.label')}
      title={t('shell.open')}
      style={{ left: `${String(point.x)}px`, top: `${String(point.y)}px` }}
      onMouseDown={(event) => {
        event.preventDefault();
        moved.current = false;
        pointRef.current = point;
        setDragPoint(point);
      }}
      onClick={() => {
        if (!moved.current) {
          onOpen?.();
        }
      }}
    >
      <span aria-hidden="true">◆</span>
    </button>
  );
}
