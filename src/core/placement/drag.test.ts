import { describe, expect, it } from 'vitest';
import { createDragTracker, dragLauncherPoint, dropLauncherPlacement } from './drag';
import type { Size, Viewport } from './geometry';

const viewport: Viewport = { width: 200, height: 200 };
const size: Size = { width: 40, height: 40 };

describe('dragLauncherPoint', () => {
  it('centres the launcher under the pointer', () => {
    expect(dragLauncherPoint(100, 100, viewport, size)).toEqual({ x: 80, y: 80 });
  });

  it('clamps a launcher dragged past the viewport edge', () => {
    expect(dragLauncherPoint(-50, -50, viewport, size)).toEqual({ x: 8, y: 8 });
    expect(dragLauncherPoint(500, 500, viewport, size)).toEqual({ x: 152, y: 152 });
  });
});

describe('dropLauncherPlacement', () => {
  it('snaps the released point to the nearest edge', () => {
    expect(dropLauncherPlacement({ x: 8, y: 80 }, viewport, size).edge).toBe('left');
    expect(dropLauncherPlacement({ x: 152, y: 80 }, viewport, size).edge).toBe('right');
    expect(dropLauncherPlacement({ x: 80, y: 8 }, viewport, size).edge).toBe('top');
    expect(dropLauncherPlacement({ x: 80, y: 152 }, viewport, size).edge).toBe('bottom');
  });
});

describe('createDragTracker', () => {
  it('reports a click when no movement happened between press and release', () => {
    const tracker = createDragTracker();
    tracker.begin();
    expect(tracker.moved).toBe(false);
  });

  it('reports a drag once movement happened, and resets on the next press', () => {
    const tracker = createDragTracker();
    tracker.begin();
    tracker.move();
    expect(tracker.moved).toBe(true);
    tracker.begin();
    expect(tracker.moved).toBe(false);
  });
});
