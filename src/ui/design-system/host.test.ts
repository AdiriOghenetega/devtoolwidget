import { describe, expect, it } from 'vitest';
import { createShadowHost } from './host';

describe('createShadowHost', () => {
  it('creates an isolated shadow root and adopts token styles', () => {
    const host = createShadowHost({ doc: document, theme: 'dark' });

    expect(host.host.getAttribute('data-theme')).toBe('dark');
    expect(host.shadow).toBe(host.host.shadowRoot);
    // Tokens are attached either via adoptedStyleSheets or a <style> fallback.
    const hasStyles =
      host.shadow.adoptedStyleSheets.length > 0 || host.shadow.querySelector('style') !== null;
    expect(hasStyles).toBe(true);

    host.dispose();
    expect(document.contains(host.host)).toBe(false);
  });

  it('updates the theme attribute', () => {
    const host = createShadowHost({ doc: document });
    host.setTheme('high-contrast');
    expect(host.host.getAttribute('data-theme')).toBe('high-contrast');
    host.dispose();
  });
});
