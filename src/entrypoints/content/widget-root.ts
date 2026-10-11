/**
 * The isolated Shadow-DOM host for the in-page widget (PRD 8.1). It lives in the
 * content entrypoint, not `ui`, so the `document_start` bootstrap never imports
 * `ui` (ADR 0019). Pure DOM; no framework.
 */

/** Handle to the widget root mounted in a Shadow DOM. */
export interface WidgetRoot {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  setStatus(text: string): void;
}

/**
 * Creates and mounts the widget's Shadow-DOM root. Domain styling and components
 * are added later by the lazily imported UI layer; this only establishes the
 * isolated host and the bootstrap status output.
 */
export function hostWidgetRoot(doc: Document = document): WidgetRoot {
  const host = doc.createElement('devtoolwidget-root');
  host.setAttribute('data-devtoolwidget', 'root');
  const shadow = host.attachShadow({ mode: 'open' });
  const status = doc.createElement('output');
  status.setAttribute('data-devtoolwidget', 'status');
  shadow.append(status);
  doc.documentElement.append(host);
  return {
    host,
    shadow,
    setStatus(text) {
      status.textContent = text;
    },
  };
}
