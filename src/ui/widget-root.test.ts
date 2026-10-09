import { describe, expect, it } from 'vitest';
import { hostWidgetRoot } from './widget-root';

describe('hostWidgetRoot', () => {
  it('mounts an isolated shadow root and updates the status text', () => {
    const root = hostWidgetRoot(document);

    expect(document.querySelector('devtoolwidget-root')).not.toBeNull();
    expect(root.shadow.querySelector('output')).not.toBeNull();

    root.setStatus('connected');
    expect(root.shadow.querySelector('output')?.textContent).toBe('connected');

    root.host.remove();
  });
});
