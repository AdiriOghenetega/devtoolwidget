import { h, render } from 'preact';
import type { ActionRef, ShellPersistence } from '../../core';
import { DESIGN_TOKENS_CSS } from '../../ui/design-system/tokens';
import { createPanelLoader } from '../../ui/shell/panel-loader';
import type { ShellControlsRef } from '../../ui/shell/Shell';
import { SHELL_CONTAINMENT_CSS } from '../../ui/shell/styles';
import { Widget } from '../../ui/shell/Widget';
import { createOverviewStore } from '../../ui/state';
import type { PanelFeed } from './panel-feed';
import type { WidgetRoot } from './widget-root';

/** Everything the lazily imported shell needs from the bootstrap. */
export interface LazyShellDeps {
  readonly root: WidgetRoot;
  readonly origin: string;
  readonly topFrame: boolean;
  readonly persistence: ShellPersistence;
  readonly feed: PanelFeed;
  readonly dispatch: (action: ActionRef) => void;
  /** Removes the `document_start` launcher so the shell's launcher replaces it. */
  readonly onHandoff: () => void;
}

/** An imperative handle on the mounted shell. */
export interface LazyShellController {
  open(): void;
}

/**
 * The lazily loaded UI boundary (ADR 0019). This module statically imports Preact,
 * the signals-backed store and the `ui` shell/panel; it is loaded by the
 * `document_start` content entry only on first interaction. WXT inlines the
 * dynamic import (IIFE content script), so the code is in the content bundle but
 * is **not executed** until then; a real separate chunk is gap G14 (see the ADR
 * 0019 amendment).
 */
export function mountLazyShell(deps: LazyShellDeps): LazyShellController {
  deps.onHandoff();

  const doc = deps.root.host.ownerDocument;
  const style = doc.createElement('style');
  style.textContent = `${DESIGN_TOKENS_CSS}\n${SHELL_CONTAINMENT_CSS}`;
  deps.root.shadow.append(style);

  const mount = doc.createElement('div');
  mount.setAttribute('data-devtoolwidget', 'widget');
  deps.root.shadow.append(mount);

  const store = createOverviewStore();
  const controls: ShellControlsRef = { current: null };

  deps.feed.attach({
    onMessage(message) {
      store.applyPanelMessage(message);
    },
    onConnection(connected) {
      store.setConnection(connected ? 'connected' : 'disconnected');
    },
  });

  render(
    h(Widget, {
      origin: deps.origin,
      topFrame: deps.topFrame,
      persistence: deps.persistence,
      loadPanel: createPanelLoader({ store, dispatch: deps.dispatch }),
      store,
      initialOpen: true,
      controls,
    }),
    mount,
  );

  return {
    open() {
      controls.current?.open();
    },
  };
}
