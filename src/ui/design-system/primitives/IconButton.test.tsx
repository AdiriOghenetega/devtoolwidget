import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../testing/axe';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('exposes an accessible name and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <IconButton ariaLabel="Close" onClick={onClick}>
        ✕
      </IconButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no axe violations', async () => {
    const { container } = render(<IconButton ariaLabel="Close">✕</IconButton>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
