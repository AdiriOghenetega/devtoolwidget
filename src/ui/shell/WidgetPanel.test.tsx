import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { createOverviewStore } from '../state';
import { createPanelLoader } from './panel-loader';
import { createWidgetPanel } from './WidgetPanel';

describe('createWidgetPanel', () => {
  it('renders the dockable panel wrapping the tabbed content', () => {
    const store = createOverviewStore();
    const Panel = createWidgetPanel({ store, dispatch: () => undefined });

    render(<Panel mode="right" size={{ width: 360, height: 560 }} />);

    expect(screen.getByRole('complementary')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('lazily loads the panel module on first open', async () => {
    const store = createOverviewStore();
    const load = createPanelLoader({ store, dispatch: () => undefined });

    const module = await load();

    expect(typeof module.Panel).toBe('function');
  });
});
