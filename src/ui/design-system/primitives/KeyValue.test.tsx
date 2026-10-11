import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../testing/axe';
import { KeyValue } from './KeyValue';

describe('KeyValue', () => {
  it('renders rows as a definition list', () => {
    render(<KeyValue items={[{ key: 'Status', value: '200' }]} />);
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
  });

  it('shows an empty state when there are no items', () => {
    render(<KeyValue items={[]} />);
    expect(screen.getByText('No data')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(<KeyValue items={[{ key: 'Status', value: '200' }]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
