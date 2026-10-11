import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { aSnapshot, type ActionRef } from '../../core';
import { createOverviewStore } from '../state';
import { Overview } from './Overview';

function loadedStore() {
  const store = createOverviewStore();
  store.applySnapshot(aSnapshot().network({ url: 'https://a.test/x', status: 500 }).build());
  return store;
}

describe('Overview states', () => {
  it('shows loading while connecting with no data', () => {
    render(<Overview store={createOverviewStore()} dispatch={() => undefined} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows the empty state when connected with no data', () => {
    const store = createOverviewStore();
    store.setConnection('connected');
    render(<Overview store={store} dispatch={() => undefined} />);
    expect(screen.getByText('Nothing captured yet. Reload the page.')).toBeTruthy();
  });

  it('shows the error state with a retry', () => {
    const store = createOverviewStore();
    store.setConnection('error');
    const onRetry = vi.fn();
    render(<Overview store={store} dispatch={() => undefined} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the disconnected state', () => {
    const store = createOverviewStore();
    store.setConnection('disconnected');
    render(<Overview store={store} dispatch={() => undefined} />);
    expect(screen.getByText('Disconnected from the page.')).toBeTruthy();
  });
});

describe('Overview content', () => {
  it('renders the health score, category breakdown, counters and top findings', () => {
    render(<Overview store={loadedStore()} dispatch={() => undefined} />);
    expect(screen.getByLabelText(/^Health /)).toBeTruthy();
    expect(screen.getByText(/Console errors: 0/)).toBeTruthy();
    expect(screen.getByText(/Requests: 1/)).toBeTruthy();
    expect(screen.getByText(/failed request/)).toBeTruthy();
  });

  it('dispatches the finding action', () => {
    const dispatch = vi.fn<(action: ActionRef) => void>();
    render(<Overview store={loadedStore()} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole('button', { name: 'hardReload' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'hardReload' });
  });

  it('dispatches quick actions directly', () => {
    const dispatch = vi.fn<(action: ActionRef) => void>();
    render(<Overview store={loadedStore()} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hard reload' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export report' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'hardReload' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'exportReport', format: 'markdown' });
  });

  it('confirms before dispatching a destructive action', () => {
    const dispatch = vi.fn<(action: ActionRef) => void>();
    render(<Overview store={loadedStore()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear site data' }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'clearStorage', preset: 'fresh-visitor' });
  });
});
