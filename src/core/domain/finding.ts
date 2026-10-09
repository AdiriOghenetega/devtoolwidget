/** How serious a finding is (PRD section 9). */
export type Severity = 'critical' | 'warning' | 'info';

/** The domain a finding belongs to (PRD section 9). */
export type FindingCategory = 'network' | 'performance' | 'console' | 'storage';

/** Clear-site-data presets offered by the widget (PRD FR-6). */
export type ClearStoragePreset = 'fresh-visitor' | 'clear-everything-and-reload';

/** Network throttling profiles (PRD FR-7). */
export type ThrottleProfile = 'offline' | 'slow-3g' | 'fast-3g' | '4g' | 'custom';

/** Bug-report export formats (PRD FR-10). */
export type ExportFormat = 'markdown' | 'json' | 'har';

/**
 * A one-click action attached to a finding (PRD section 9, G2). Modelled as a
 * discriminated union on `type` so every action's payload is known statically
 * and consumers must handle all variants exhaustively.
 */
export type ActionRef =
  | { readonly type: 'clearStorage'; readonly preset: ClearStoragePreset }
  | { readonly type: 'hardReload' }
  | { readonly type: 'setThrottle'; readonly profile: ThrottleProfile }
  | { readonly type: 'toggleDisableCache'; readonly enabled: boolean }
  | { readonly type: 'exportReport'; readonly format: ExportFormat };

/** A ranked, plain-language finding with evidence and a suggested fix. */
export interface Finding {
  readonly id: string;
  readonly ruleId: string;
  readonly severity: Severity;
  readonly category: FindingCategory;
  readonly title: string;
  readonly evidence: readonly string[];
  readonly suggestion: string;
  readonly docsUrl?: string;
  readonly actions: readonly ActionRef[];
}
