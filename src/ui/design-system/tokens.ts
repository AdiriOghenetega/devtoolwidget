/** Theme names supported by the design system. */
export type ThemeName = 'light' | 'dark' | 'high-contrast';

/**
 * Design tokens as CSS custom properties, grouped by concern: color, spacing,
 * type, radius, elevation and motion. `:host { all: initial }` blocks inherited
 * page styles from leaking in; the Shadow DOM blocks everything else.
 */
export const DESIGN_TOKENS_CSS = `
:host {
  all: initial;
  display: block;

  --dwt-color-bg: #ffffff;
  --dwt-color-surface: #f6f7f9;
  --dwt-color-text: #1b1f24;
  --dwt-color-text-muted: #5b6572;
  --dwt-color-border: #d7dbe0;
  --dwt-color-accent: #2f6fed;
  --dwt-color-accent-text: #ffffff;
  --dwt-color-critical: #c02626;
  --dwt-color-warning: #a15c00;
  --dwt-color-info: #2f6fed;
  --dwt-color-focus: #1b1f24;

  --dwt-space-1: 4px;
  --dwt-space-2: 8px;
  --dwt-space-3: 12px;
  --dwt-space-4: 16px;
  --dwt-space-5: 24px;

  --dwt-font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --dwt-font-size-sm: 12px;
  --dwt-font-size-md: 14px;
  --dwt-font-size-lg: 16px;
  --dwt-font-weight-normal: 400;
  --dwt-font-weight-bold: 600;

  --dwt-radius-sm: 4px;
  --dwt-radius-md: 8px;
  --dwt-radius-pill: 999px;

  --dwt-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.12);
  --dwt-elevation-2: 0 4px 16px rgba(0, 0, 0, 0.18);

  --dwt-motion-fast: 120ms;
  --dwt-motion-normal: 200ms;
  --dwt-motion-easing: cubic-bezier(0.2, 0, 0, 1);
}

:host([data-theme='dark']) {
  --dwt-color-bg: #16181d;
  --dwt-color-surface: #1f232b;
  --dwt-color-text: #e8eaee;
  --dwt-color-text-muted: #a5adba;
  --dwt-color-border: #333944;
  --dwt-color-accent: #6f9bf5;
  --dwt-color-accent-text: #0b0d10;
  --dwt-color-critical: #ff7a7a;
  --dwt-color-warning: #ffc46b;
  --dwt-color-info: #6f9bf5;
  --dwt-color-focus: #e8eaee;
}

:host([data-theme='high-contrast']) {
  --dwt-color-bg: #000000;
  --dwt-color-surface: #000000;
  --dwt-color-text: #ffffff;
  --dwt-color-text-muted: #ffffff;
  --dwt-color-border: #ffffff;
  --dwt-color-accent: #ffff00;
  --dwt-color-accent-text: #000000;
  --dwt-color-critical: #ff8080;
  --dwt-color-warning: #ffff00;
  --dwt-color-info: #80d0ff;
  --dwt-color-focus: #ffff00;
}

@media (prefers-reduced-motion: reduce) {
  :host {
    --dwt-motion-fast: 0ms;
    --dwt-motion-normal: 0ms;
  }
}
`;

/** The token names, for typed access from TypeScript. */
export const TOKEN_NAMES = [
  '--dwt-color-bg',
  '--dwt-color-surface',
  '--dwt-color-text',
  '--dwt-color-text-muted',
  '--dwt-color-border',
  '--dwt-color-accent',
  '--dwt-color-accent-text',
  '--dwt-color-critical',
  '--dwt-color-warning',
  '--dwt-color-info',
  '--dwt-color-focus',
  '--dwt-space-1',
  '--dwt-space-2',
  '--dwt-space-3',
  '--dwt-space-4',
  '--dwt-space-5',
  '--dwt-font-family',
  '--dwt-font-size-sm',
  '--dwt-font-size-md',
  '--dwt-font-size-lg',
  '--dwt-font-weight-normal',
  '--dwt-font-weight-bold',
  '--dwt-radius-sm',
  '--dwt-radius-md',
  '--dwt-radius-pill',
  '--dwt-elevation-1',
  '--dwt-elevation-2',
  '--dwt-motion-fast',
  '--dwt-motion-normal',
  '--dwt-motion-easing',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
