import { render, screen, waitFor } from '@testing-library/preact';
import type { JSX } from 'preact';
import { describe, expect, it } from 'vitest';
import { createOverviewStore } from '../state';
import type { ShellPersistence } from './persistence';
import { Widget } from './Widget';

function fakePersistence(): ShellPersistence {
  return {
    loadLauncher: () => Promise.resolve(undefined),
    saveLauncher: () => Promise.resolve(),
    isSiteDisabled: () => Promise.resolve(false),
    setSiteDisabled: () => Promise.resolve(),
  };
}

function panelModule(): { Panel: () => JSX.Element } {
  return { Panel: () => <div>PANEL</div> };
}

describe('Widget', () => {
  it('renders the shell launcher from the store state', async () => {
    render(
      <Widget
        origin="https://a.test"
        topFrame
        persistence={fakePersistence()}
        loadPanel={() => Promise.resolve(panelModule())}
        store={createOverviewStore()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /launcher/i })).toBeTruthy();
    });
  });

  it('forwards initialOpen so the panel opens on mount', async () => {
    render(
      <Widget
        origin="https://a.test"
        topFrame
        persistence={fakePersistence()}
        loadPanel={() => Promise.resolve(panelModule())}
        store={createOverviewStore()}
        initialOpen
      />,
    );
    expect(await screen.findByText('PANEL')).toBeTruthy();
  });
});
