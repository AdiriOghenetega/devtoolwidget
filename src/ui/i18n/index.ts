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
  'options.title': 'Settings',
  'options.captureLevel': 'Capture level',
  'options.perOrigin': 'Per-origin profiles',
  'options.origin': 'Origin',
  'options.addOrigin': 'Add origin',
  'options.thresholds': 'Thresholds',
  'options.redaction': 'Redaction rules',
  'options.retention': 'Retention',
  'options.maxSnapshots': 'Max snapshots',
  'options.maxAgeDays': 'Max age (days)',
  'options.theme': 'Theme',
  'options.shortcuts': 'Shortcuts',
  'options.import': 'Import',
  'options.export': 'Export',
  'options.importPlaceholder': 'Paste settings JSON to import',
  'options.save': 'Save',
  'options.remove': 'Remove',
  'options.saveFailed': 'Could not save: {reason}',
  'options.saved': 'Saved',
  'options.data.title': 'Data and privacy',
  'options.data.body':
    'This extension stores your preferences and per-site settings in extension storage on this device. Nothing is sent anywhere.',
  'options.data.deleteAll': 'Delete all stored data',
  'options.data.confirm.title': 'Delete all stored data?',
  'options.data.confirm.body':
    'This removes all preferences, per-site settings and captured data on this device. It cannot be undone.',
  'options.data.deleted': 'All stored data deleted',
  'tour.title': 'Welcome to devToolWidget',
  'tour.welcome.body':
    'devToolWidget summarises what is wrong with a page and what you can do about it, in one panel.',
  'tour.permissions.title': 'Permissions, in plain language',
  'tour.permissions.storage':
    'storage - keeps your preferences and per-site settings on this device.',
  'tour.permissions.tabs':
    'tabs - reads the current tab URL so the widget knows which site you are on.',
  'tour.permissions.scripting': 'scripting - injects the widget into pages you explicitly allow.',
  'tour.permissions.browsingData':
    'browsingData - clears cookies and cache for a site only when you ask.',
  'tour.dataHandling':
    'Data handling: everything stays on your device. There is no telemetry and no network access.',
  'tour.next': 'Next',
  'tour.back': 'Back',
  'tour.finish': 'Finish',
  'console.title': 'Console',
  'console.search': 'Search console',
  'console.level.all': 'All levels',
  'console.filter.level': 'Level',
  'console.preserveLog': 'Preserve log',
  'console.collapse': 'Collapse duplicates',
  'console.count': '{count}x',
  'console.empty': 'No console entries',
  'network.title': 'Network',
  'network.search': 'Search requests',
  'network.group.label': 'Group by',
  'network.group.none': 'None',
  'network.group.host': 'Host',
  'network.group.type': 'Type',
  'network.empty': 'No requests',
  'network.detail': 'Request detail',
  'network.copy.curl': 'Copy as cURL',
  'network.copy.fetch': 'Copy as fetch',
  'network.copied': 'Copied',
  'performance.title': 'Performance',
  'performance.vitals': 'Web vitals',
  'performance.longTasks': 'Long tasks',
  'performance.resources': 'Resource summary',
  'performance.rating.good': 'Good',
  'performance.rating.needs-improvement': 'Needs improvement',
  'performance.rating.poor': 'Poor',
  'performance.empty': 'No performance data',
  'storage.title': 'Storage',
  'storage.preset': 'Preset',
  'storage.preset.freshVisitor': 'Fresh visitor',
  'storage.preset.clearAll': 'Clear everything and reload',
  'storage.keepList': 'Keep list',
  'storage.keepPlaceholder': 'Key to keep',
  'storage.add': 'Add',
  'storage.remove': 'Remove',
  'storage.clear': 'Clear',
  'storage.confirm.title': 'Clear site data?',
  'storage.confirm.body': 'This removes the selected data and cannot be undone.',
  'storage.report.title': 'Clear report',
  'storage.report.steps': '{ok} of {total} steps succeeded, {bytes} freed',
  'storage.report.failed': 'Failed',
  'storage.report.succeeded': 'Succeeded',
  'storage.empty': 'No storage data',
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
