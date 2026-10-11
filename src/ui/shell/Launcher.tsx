import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  createDragTracker,
  dragLauncherPoint,
  dropLauncherPlacement,
  placementToPoint,
  LAUNCHER_SIZE,
  type LauncherPlacement,
  type Point,
  type Size,
  type Viewport,
} from '../../core';
import { t } from '../i18n';

/** Props for {@link Launcher}. */
export interface LauncherProps {
  readonly placement: LauncherPlacement;
  readonly size?: Size;
  readonly viewport?: Viewport;
  readonly onOpen?: () => void;
  readonly onPlacementChange?: (placement: LauncherPlacement) => void;
}

function currentViewport(viewport: Viewport | undefined): Viewport {
  return viewport ?? { width: globalThis.innerWidth, height: globalThis.innerHeight };
}

/**
 * A draggable launcher that snaps to the nearest edge on release. The drag math
 * is shared with the `document_start` vanilla launcher via `core/placement`
 * (ADR 0019): no placement logic is duplicated here.
 */
export function Launcher({
  placement,
  size = LAUNCHER_SIZE,
  viewport,
  onOpen,
  onPlacementChange,
}: LauncherProps): JSX.Element {
  const [dragPoint, setDragPoint] = useState<Point | undefined>();
  const tracker = useRef(createDragTracker());
  const pointRef = useRef<Point>({ x: 0, y: 0 });

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
      tracker.current.move();
      const vp = currentViewport(viewport);
      const next = dragLauncherPoint(event.clientX, event.clientY, vp, size);
      pointRef.current = next;
      setDragPoint(next);
    };
    const onUp = (): void => {
      const vp = currentViewport(viewport);
      const snapped = dropLauncherPlacement(pointRef.current, vp, size);
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
        tracker.current.begin();
        pointRef.current = point;
        setDragPoint(point);
      }}
      onClick={() => {
        if (!tracker.current.moved) {
          onOpen?.();
        }
      }}
    >
      <span aria-hidden="true">◆</span>
    </button>
  );
}
