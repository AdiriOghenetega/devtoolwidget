import type { LoadPanel } from './Shell';
import type { WidgetPanelDeps } from './WidgetPanel';

/**
 * Builds the lazy `LoadPanel` the content script hands to the {@link Shell}, so
 * the panel module is fetched only when the launcher is first opened (PRD 8.1:
 * the UI is lazy-loaded). The dynamic import keeps the panel out of the
 * document_start bundle.
 */
export function createPanelLoader(deps: WidgetPanelDeps): LoadPanel {
  return () =>
    import('./WidgetPanel').then((module) => ({ Panel: module.createWidgetPanel(deps) }));
}
