/** Handle to the widget root mounted in a Shadow DOM. */
export interface WidgetRoot {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  setStatus(text: string): void;
}

/**
 * Creates and mounts the widget's Shadow-DOM root (PRD 8.1: the content script
 * hosts the widget root). Domain styling and components are added by the UI
 * layer later; this only establishes the isolated host.
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
