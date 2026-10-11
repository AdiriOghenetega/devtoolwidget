import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Launcher } from './Launcher';

const viewport = { width: 200, height: 200 };
const size = { width: 40, height: 40 };

describe('Launcher', () => {
  it('opens on click without dragging', () => {
    const onOpen = vi.fn();
    render(
      <Launcher
        placement={{ edge: 'right', offset: 0.5 }}
        viewport={viewport}
        size={size}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /launcher/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('snaps to the nearest edge and persists on drag release', () => {
    const onPlacementChange = vi.fn();
    const onOpen = vi.fn();
    render(
      <Launcher
        placement={{ edge: 'right', offset: 0.5 }}
        viewport={viewport}
        size={size}
        onOpen={onOpen}
        onPlacementChange={onPlacementChange}
      />,
    );
    const launcher = screen.getByRole('button', { name: /launcher/i });
    fireEvent.mouseDown(launcher);
    fireEvent.mouseMove(document, { clientX: 20, clientY: 100 });
    fireEvent.mouseUp(document);

    expect(onPlacementChange).toHaveBeenCalledTimes(1);
    expect(onPlacementChange.mock.calls[0]?.[0]).toMatchObject({ edge: 'left' });
    // A drag must not be treated as a click.
    fireEvent.click(launcher);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
