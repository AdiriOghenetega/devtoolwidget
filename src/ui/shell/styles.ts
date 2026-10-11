/**
 * Shell containment CSS. The host ignores pointer events so the widget never
 * blocks page interaction outside its own bounds; the launcher and panel opt
 * back in.
 */
export const SHELL_CONTAINMENT_CSS = `
:host { pointer-events: none; }
:host .dwt-launcher,
:host .dwt-panel,
:host .dwt-health-badge { pointer-events: auto; }
`;
