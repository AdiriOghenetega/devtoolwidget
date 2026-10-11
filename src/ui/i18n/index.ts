/**
 * The message catalog. English only for now; typed so every string used by the
 * UI is a compile-checked key. Add locales by widening this shape later.
 */
export const messages = {
  'common.close': 'Close',
  'common.dismiss': 'Dismiss',
  'common.more': 'More',
  'button.default': 'Button',
  'iconButton.label': 'Icon button',
  'tabs.label': 'Sections',
  'badge.critical': 'Critical',
  'badge.warning': 'Warning',
  'badge.info': 'Info',
  'tooltip.label': 'Tooltip',
  'dialog.label': 'Dialog',
  'dialog.confirm': 'Confirm',
  'dialog.cancel': 'Cancel',
  'switch.on': 'On',
  'switch.off': 'Off',
  'select.placeholder': 'Select an option',
  'checkbox.label': 'Checkbox',
  'keyValue.empty': 'No data',
  'sparkline.label': 'Trend',
  'emptyState.title': 'Nothing to show',
  'virtualList.label': 'List',
  'virtualList.empty': 'No items',
} as const;

/** A compile-checked message key. */
export type MessageKey = keyof typeof messages;

/** Values substituted into `{name}` placeholders. */
export type MessageParams = Readonly<Record<string, string | number>>;

/**
 * Translates a message key, substituting `{name}` placeholders. Pure; the single
 * source for every user-facing string.
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const template: string = messages[key];
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}
