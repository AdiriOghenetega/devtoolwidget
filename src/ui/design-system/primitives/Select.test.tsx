import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../testing/axe';
import { Select } from './Select';

const options = [
  { value: 'off', label: 'Off' },
  { value: 'slow', label: 'Slow 3G' },
];

describe('Select', () => {
  it('is labelled and reports changes', () => {
    const onChange = vi.fn();
    render(<Select label="Throttle" options={options} value="off" onChange={onChange} />);
    const select = screen.getByLabelText('Throttle');
    fireEvent.change(select, { target: { value: 'slow' } });
    expect(onChange).toHaveBeenCalledWith('slow');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Select label="Throttle" options={options} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
