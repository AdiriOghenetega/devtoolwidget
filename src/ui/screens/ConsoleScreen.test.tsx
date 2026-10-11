import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { toMillis, type ConsoleEntry } from '../../core';
import { ConsoleScreen } from './ConsoleScreen';

function entry(overrides: Partial<ConsoleEntry> & { readonly id: string }): ConsoleEntry {
  return {
    kind: 'console',
    level: 'log',
    timestamp: toMillis(0),
    args: [],
    count: 1,
    ...overrides,
  };
}

const boom = (id: string, count = 1): ConsoleEntry =>
  entry({ id, level: 'error', count, args: [{ type: 'string', value: 'boom' }] });
const info = (id: string): ConsoleEntry =>
  entry({ id, level: 'info', args: [{ type: 'string', value: 'hello' }] });

describe('ConsoleScreen', () => {
  it('shows an empty state', () => {
    render(<ConsoleScreen entries={[]} />);
    expect(screen.getByText('No console entries')).toBeTruthy();
  });

  it('filters by level and search', () => {
    render(<ConsoleScreen entries={[boom('1'), info('2')]} />);
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'error' } });
    expect(screen.queryByText('hello')).toBeNull();
    expect(screen.getByText('boom')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'all' } });
    fireEvent.input(screen.getByLabelText('Search console'), { target: { value: 'hello' } });
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.queryByText('boom')).toBeNull();
  });

  it('collapses duplicates with counts', () => {
    render(<ConsoleScreen entries={[boom('1', 2), boom('2', 3), info('3')]} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Collapse duplicates' }));
    expect(screen.getAllByText(/boom/)).toHaveLength(1);
    expect(screen.getByText('5x')).toBeTruthy();
  });

  it('reports preserve-log changes', () => {
    const onPreserveLogChange = vi.fn();
    render(<ConsoleScreen entries={[boom('1')]} onPreserveLogChange={onPreserveLogChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Preserve log' }));
    expect(onPreserveLogChange).toHaveBeenCalledWith(true);
  });
});
