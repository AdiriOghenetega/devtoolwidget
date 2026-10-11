import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { aSnapshot } from '../../core';
import { createOverviewStore } from '../state';
import { PanelContent } from './PanelContent';

function loadedStore() {
  const store = createOverviewStore();
  store.applySnapshot(aSnapshot().network({ url: 'https://a.test/x', status: 500 }).build());
  return store;
}

describe('PanelContent', () => {
  it('shows the Overview by default and the detail screens in their tabs', () => {
    render(<PanelContent store={loadedStore()} dispatch={() => undefined} />);

    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    // The Overview panel is rendered for the selected tab.
    expect(screen.getByRole('region', { name: 'Overview' })).toBeTruthy();
  });

  it('switches to the network tab and shows the captured requests', () => {
    render(<PanelContent store={loadedStore()} dispatch={() => undefined} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Network' }));

    expect(screen.getByRole('tab', { name: 'Network' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('https://a.test/x')).toBeTruthy();
  });

  it('dispatches an action from the Overview quick actions', () => {
    const dispatch = vi.fn();
    render(<PanelContent store={loadedStore()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole('button', { name: /hard reload/i }));

    expect(dispatch).toHaveBeenCalledWith({ type: 'hardReload' });
  });
});
