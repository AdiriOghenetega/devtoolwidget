import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../testing/axe';
import { Switch } from './Switch';

describe('Switch', () => {
  it('exposes switch state and toggles on click', () => {
    const onChange = vi.fn();
    render(<Switch label="Disable cache" checked={false} onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Disable cache' });
    expect(control.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Switch label="Disable cache" checked />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
