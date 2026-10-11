import type { JSX } from 'preact';
import type { ActionRef } from '../../core';
import type { OverviewStore } from '../state';
import { Panel, type PanelProps } from './Panel';
import { PanelContent } from './PanelContent';

/** Dependencies the panel content needs from the content-script host. */
export interface WidgetPanelDeps {
  readonly store: OverviewStore;
  readonly dispatch: (action: ActionRef) => void;
  readonly onRetry?: () => void;
}

/**
 * Builds the panel component the {@link Shell} renders once it opens. It wraps
 * {@link Panel} around {@link PanelContent}, closing over the store and the
 * dispatch function, which the Shell's `PanelProps` cannot carry.
 */
export function createWidgetPanel(deps: WidgetPanelDeps): (props: PanelProps) => JSX.Element {
  return function WidgetPanel(props: PanelProps): JSX.Element {
    return (
      <Panel {...props}>
        <PanelContent
          store={deps.store}
          dispatch={deps.dispatch}
          {...(deps.onRetry === undefined ? {} : { onRetry: deps.onRetry })}
        />
      </Panel>
    );
  };
}
