import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { aSnapshot, formatBytes, type NetworkEntry } from '../../core';
import { NetworkScreen } from './NetworkScreen';

function entries(): readonly NetworkEntry[] {
  return aSnapshot()
    .network({ url: 'https://api.test/a.js', status: 200, total: 100 })
    .network({ url: 'https://cdn.test/b.png', resourceType: 'image', status: 200, total: 20 })
    .build().network;
}

describe('NetworkScreen', () => {
  it('shows an empty state', () => {
    render(<NetworkScreen entries={[]} />);
    expect(screen.getByText('No requests')).toBeTruthy();
  });

  it('lists rows with size and filters by search', () => {
    render(<NetworkScreen entries={entries()} />);
    expect(screen.getByText('https://api.test/a.js')).toBeTruthy();
    fireEvent.input(screen.getByLabelText('Search requests'), { target: { value: 'cdn.test' } });
    expect(screen.queryByText('https://api.test/a.js')).toBeNull();
    expect(screen.getByText('https://cdn.test/b.png')).toBeTruthy();

    fireEvent.input(screen.getByLabelText('Search requests'), { target: { value: '' } });
    expect(screen.getAllByText(formatBytes(0)).length).toBeGreaterThan(0);
  });

  it('groups by host and type', () => {
    render(<NetworkScreen entries={entries()} />);
    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'host' } });
    expect(screen.getByText('api.test')).toBeTruthy();
    expect(screen.getByText('cdn.test')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'type' } });
    expect(screen.getByText('image')).toBeTruthy();
  });

  it('opens the detail drawer and copies as cURL and fetch', () => {
    const onCopy = vi.fn();
    render(<NetworkScreen entries={entries()} onCopy={onCopy} />);
    fireEvent.click(screen.getByText('https://api.test/a.js'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy as cURL' }));
    expect(onCopy).toHaveBeenCalledWith(expect.stringContaining('curl -X GET'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy as fetch' }));
    expect(onCopy).toHaveBeenCalledWith(expect.stringContaining('fetch('));
  });
});
