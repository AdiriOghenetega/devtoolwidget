import { describe, expect, it } from 'vitest';
import {
  clampToViewport,
  panelRect,
  placementToPoint,
  resizePanelSize,
  snapToEdge,
  type Size,
  type Viewport,
} from './geometry';

const viewport: Viewport = { width: 200, height: 200 };
const size: Size = { width: 40, height: 40 };
const bounds = { width: { min: 280, max: 720 }, height: { min: 200, max: 900 } };

describe('clampToViewport', () => {
  it('keeps the box inside the viewport with a margin', () => {
    expect(clampToViewport({ x: -20, y: -20 }, viewport, size)).toEqual({ x: 8, y: 8 });
    expect(clampToViewport({ x: 500, y: 500 }, viewport, size)).toEqual({ x: 152, y: 152 });
    expect(clampToViewport({ x: 100, y: 100 }, viewport, size)).toEqual({ x: 100, y: 100 });
  });
});

describe('snapToEdge', () => {
  it('snaps to the nearest edge', () => {
    expect(snapToEdge({ x: 8, y: 100 }, viewport, size).edge).toBe('left');
    expect(snapToEdge({ x: 152, y: 100 }, viewport, size).edge).toBe('right');
    expect(snapToEdge({ x: 100, y: 8 }, viewport, size).edge).toBe('top');
    expect(snapToEdge({ x: 100, y: 152 }, viewport, size).edge).toBe('bottom');
  });

  it('computes a 0..1 offset along the edge and round-trips', () => {
    const placement = snapToEdge({ x: 160, y: 100 }, viewport, size);
    expect(placement.edge).toBe('right');
    expect(placement.offset).toBeGreaterThanOrEqual(0);
    expect(placement.offset).toBeLessThanOrEqual(1);
    const point = placementToPoint(placement, viewport, size);
    expect(point.x).toBe(152);
  });
});

describe('panelRect', () => {
  it('computes rectangles for each docking mode', () => {
    expect(panelRect('left', viewport, { width: 50, height: 60 })).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 200,
    });
    expect(panelRect('right', viewport, { width: 50, height: 60 })).toEqual({
      x: 150,
      y: 0,
      width: 50,
      height: 200,
    });
    expect(panelRect('bottom', viewport, { width: 50, height: 60 })).toEqual({
      x: 0,
      y: 140,
      width: 200,
      height: 60,
    });
    expect(panelRect('floating', viewport, { width: 50, height: 60 })).toEqual({
      x: 75,
      y: 70,
      width: 50,
      height: 60,
    });
  });
});

describe('resizePanelSize', () => {
  it('resizes only the relevant axis and clamps to bounds', () => {
    expect(
      resizePanelSize('left', { width: 360, height: 560 }, { width: 40, height: 999 }, bounds),
    ).toEqual({ width: 400, height: 560 });
    expect(
      resizePanelSize('right', { width: 360, height: 560 }, { width: 40, height: 0 }, bounds),
    ).toEqual({ width: 320, height: 560 });
    expect(
      resizePanelSize('bottom', { width: 360, height: 560 }, { width: 0, height: 100 }, bounds),
    ).toEqual({ width: 360, height: 460 });
    expect(
      resizePanelSize('left', { width: 300, height: 560 }, { width: -100, height: 0 }, bounds),
    ).toEqual({ width: 280, height: 560 });
    expect(
      resizePanelSize('floating', { width: 400, height: 500 }, { width: 50, height: 50 }, bounds),
    ).toEqual({ width: 450, height: 550 });
  });
});
