/**
 * Pure launcher drag helpers shared by the lazy Preact shell and the tiny
 * `document_start` vanilla launcher (ADR 0019), so placement and drag behaviour
 * are implemented once. No browser APIs live here.
 */
import {
  clampToViewport,
  snapToEdge,
  type LauncherPlacement,
  type Point,
  type Size,
  type Viewport,
} from './geometry';

/** The default on-screen launcher button size, in CSS pixels. */
export const LAUNCHER_SIZE: Size = { width: 44, height: 44 };

/**
 * The top-left point a dragged launcher takes for a pointer at `clientX`/`clientY`,
 * centred under the pointer and kept fully inside the viewport.
 */
export function dragLauncherPoint(
  clientX: number,
  clientY: number,
  viewport: Viewport,
  size: Size = LAUNCHER_SIZE,
): Point {
  return clampToViewport(
    { x: clientX - size.width / 2, y: clientY - size.height / 2 },
    viewport,
    size,
  );
}

/** The snapped placement a launcher released at `point` persists. */
export function dropLauncherPlacement(
  point: Point,
  viewport: Viewport,
  size: Size = LAUNCHER_SIZE,
): LauncherPlacement {
  return snapToEdge(point, viewport, size);
}

/**
 * A minimal, framework-agnostic drag tracker. Both launchers press, move and
 * release; this records whether movement happened, so a release is treated as a
 * click (open) or a drop (persist the new placement).
 */
export interface DragTracker {
  begin(): void;
  move(): void;
  readonly moved: boolean;
}

/** Creates a fresh {@link DragTracker}. */
export function createDragTracker(): DragTracker {
  let moved = false;
  return {
    begin() {
      moved = false;
    },
    move() {
      moved = true;
    },
    get moved() {
      return moved;
    },
  };
}
