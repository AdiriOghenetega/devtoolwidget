import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../testing/axe';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('is labelled and reports changes', () => {
    const onChange = vi.fn();
    render(<Checkbox label="Preserve log" checked={false} onChange={onChange} />);
    const checkbox = screen.getByLabelText('Preserve log');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Checkbox label="Preserve log" checked />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
