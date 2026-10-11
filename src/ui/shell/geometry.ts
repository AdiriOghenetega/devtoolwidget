/** A point in viewport coordinates. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A width/height pair. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The viewport dimensions the widget lays out against. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** An axis-aligned rectangle. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The edges a launcher can snap to. */
export type Edge = 'left' | 'right' | 'top' | 'bottom';

/** A launcher position as an edge plus a 0..1 offset along that edge. */
export interface LauncherPlacement {
  readonly edge: Edge;
  readonly offset: number;
}

/** How the panel is docked. */
export type DockMode = 'left' | 'right' | 'bottom' | 'floating';

/** Gap kept between the widget and the viewport edge, in pixels. */
export const EDGE_MARGIN = 8;

/** Clamps a point so a `size` box stays fully inside the viewport. */
export function clampToViewport(
  point: Point,
  viewport: Viewport,
  size: Size,
  margin: number = EDGE_MARGIN,
): Point {
  const maxX = Math.max(margin, viewport.width - size.width - margin);
  const maxY = Math.max(margin, viewport.height - size.height - margin);
  return {
    x: Math.min(Math.max(point.x, margin), maxX),
    y: Math.min(Math.max(point.y, margin), maxY),
  };
}

/** Snaps a point to the nearest viewport edge, returning edge + offset. */
export function snapToEdge(
  point: Point,
  viewport: Viewport,
  size: Size,
  margin: number = EDGE_MARGIN,
): LauncherPlacement {
  const distances: Readonly<Record<Edge, number>> = {
    left: point.x,
    right: viewport.width - (point.x + size.width),
    top: point.y,
    bottom: viewport.height - (point.y + size.height),
  };
  let edge: Edge = 'left';
  for (const candidate of ['left', 'right', 'top', 'bottom'] as const) {
    if (distances[candidate] < distances[edge]) {
      edge = candidate;
    }
  }
  const horizontal = edge === 'left' || edge === 'right';
  const span =
    (horizontal ? viewport.height - size.height : viewport.width - size.width) - margin * 2;
  const along = (horizontal ? point.y : point.x) - margin;
  const offset = span <= 0 ? 0 : Math.min(1, Math.max(0, along / span));
  return { edge, offset };
}

/** Converts a placement back into a viewport point. */
export function placementToPoint(
  placement: LauncherPlacement,
  viewport: Viewport,
  size: Size,
  margin: number = EDGE_MARGIN,
): Point {
  const horizontal = placement.edge === 'left' || placement.edge === 'right';
  const span =
    (horizontal ? viewport.height - size.height : viewport.width - size.width) - margin * 2;
  const along = margin + (span <= 0 ? 0 : placement.offset * span);
  switch (placement.edge) {
    case 'left':
      return { x: margin, y: along };
    case 'right':
      return { x: viewport.width - size.width - margin, y: along };
    case 'top':
      return { x: along, y: margin };
    case 'bottom':
      return { x: along, y: viewport.height - size.height - margin };
  }
}

/** Computes the panel rectangle for a docking mode. */
export function panelRect(mode: DockMode, viewport: Viewport, size: Size): Rect {
  switch (mode) {
    case 'left':
      return { x: 0, y: 0, width: size.width, height: viewport.height };
    case 'right':
      return { x: viewport.width - size.width, y: 0, width: size.width, height: viewport.height };
    case 'bottom':
      return { x: 0, y: viewport.height - size.height, width: viewport.width, height: size.height };
    case 'floating':
      return {
        x: Math.max(0, Math.round((viewport.width - size.width) / 2)),
        y: Math.max(0, Math.round((viewport.height - size.height) / 2)),
        width: size.width,
        height: size.height,
      };
  }
}

/** Inclusive bounds for one resizable axis. */
export interface ResizeBounds {
  readonly min: number;
  readonly max: number;
}

function clamp(value: number, bounds: ResizeBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

/**
 * Applies a resize delta for the current docking mode, clamped to bounds. Docked
 * left/right panels resize horizontally; bottom panels resize vertically;
 * floating panels resize both ways.
 */
export function resizePanelSize(
  mode: DockMode,
  current: Size,
  delta: Size,
  bounds: { readonly width: ResizeBounds; readonly height: ResizeBounds },
): Size {
  switch (mode) {
    case 'bottom':
      return { width: current.width, height: clamp(current.height - delta.height, bounds.height) };
    case 'left':
      return { width: clamp(current.width + delta.width, bounds.width), height: current.height };
    case 'right':
      return { width: clamp(current.width - delta.width, bounds.width), height: current.height };
    case 'floating':
      return {
        width: clamp(current.width + delta.width, bounds.width),
        height: clamp(current.height + delta.height, bounds.height),
      };
  }
}
