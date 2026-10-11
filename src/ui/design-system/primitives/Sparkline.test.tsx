import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../testing/axe';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('renders an accessible trend image', () => {
    render(<Sparkline values={[1, 3, 2, 5]} ariaLabel="Requests" />);
    expect(screen.getByRole('img', { name: 'Requests' })).toBeTruthy();
  });

  it('handles an empty series', () => {
    render(<Sparkline values={[]} ariaLabel="Requests" />);
    expect(screen.getByRole('img', { name: 'Requests' })).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
