import { DESIGN_TOKENS_CSS, type ThemeName } from './tokens';

/** A mounted Shadow-DOM host with an isolated style scope. */
export interface ShadowHost {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  /** Adds a stylesheet to the shadow root (constructable when supported). */
  adopt(css: string): void;
  setTheme(theme: ThemeName): void;
  dispose(): void;
}

/**
 * Creates and mounts a Shadow-DOM host for the widget. Page CSS cannot reach the
 * shadow tree, and `:host { all: initial }` (in the token stylesheet) stops page
 * styles inheriting in. Styles are attached with constructable stylesheets when
 * the browser supports them, falling back to a `<style>` element otherwise.
 */
export function createShadowHost(
  options: {
    readonly doc?: Document;
    readonly theme?: ThemeName;
    readonly tagName?: string;
  } = {},
): ShadowHost {
  const doc = options.doc ?? document;
  const host = doc.createElement(options.tagName ?? 'devtoolwidget-panel');
  host.setAttribute('data-theme', options.theme ?? 'light');
  const shadow = host.attachShadow({ mode: 'open' });

  const supportsConstructableStylesheets =
    typeof CSSStyleSheet === 'function' && 'replaceSync' in CSSStyleSheet.prototype;

  const adopt = (css: string): void => {
    if (supportsConstructableStylesheets) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
    } else {
      const style = doc.createElement('style');
      style.textContent = css;
      shadow.append(style);
    }
  };

  adopt(DESIGN_TOKENS_CSS);

  return {
    host,
    shadow,
    adopt,
    setTheme(theme) {
      host.setAttribute('data-theme', theme);
    },
    dispose() {
      host.remove();
    },
  };
}
