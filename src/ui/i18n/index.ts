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
  'snapshots.title': 'Snapshots',
  'snapshots.label': 'Label',
  'snapshots.capture': 'Capture snapshot',
  'snapshots.delete': 'Delete',
  'snapshots.compare': 'Compare',
  'snapshots.empty': 'No snapshots yet',
  'snapshots.selectTwo': 'Select two snapshots to compare',
  'snapshots.noChanges': 'No changes between the two snapshots',
  'snapshots.metric': 'Metric',
  'snapshots.before': 'Before',
  'snapshots.after': 'After',
  'snapshots.delta': 'Change',
  'snapshots.newFindings': 'New findings',
  'snapshots.resolvedFindings': 'Resolved findings',
  'shell.launcher.label': 'devToolWidget launcher',
  'shell.open': 'Open devToolWidget',
  'shell.panel.label': 'devToolWidget panel',
  'shell.close': 'Close panel',
  'shell.badge.label': 'Health {score}, {errors} errors',
  'shell.dock.left': 'Dock left',
  'shell.dock.right': 'Dock right',
  'shell.dock.bottom': 'Dock bottom',
  'shell.dock.floating': 'Float',
  'shell.disabled': 'devToolWidget is disabled on this site',
  'overview.title': 'Overview',
  'overview.health': 'Health {score}',
  'overview.category.network': 'Network',
  'overview.category.performance': 'Performance',
  'overview.category.console': 'Console',
  'overview.category.storage': 'Storage',
  'overview.counters.console': 'Console errors: {count}',
  'overview.counters.network': 'Requests: {count}',
  'overview.findings.none': 'No findings yet',
  'overview.loading': 'Loading...',
  'overview.empty': 'Nothing captured yet. Reload the page.',
  'overview.error': 'Something went wrong while loading data.',
  'overview.disconnected': 'Disconnected from the page.',
  'overview.retry': 'Retry',
  'overview.action.clearData': 'Clear site data',
  'overview.action.hardReload': 'Hard reload',
  'overview.action.disableCache': 'Disable cache',
  'overview.action.throttle': 'Throttle',
  'overview.action.export': 'Export report',
  'overview.confirm.clear.title': 'Clear site data?',
  'overview.confirm.clear.body':
    'This removes cookies and storage for this origin and cannot be undone.',
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
