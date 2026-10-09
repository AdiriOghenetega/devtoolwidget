import type { z } from 'zod';
import type { Millis, Result, TabId } from '../../core';
import type { PlatformError } from './errors';

export * from './errors';
export * from './permissions';
export * from './site-scripts';

/** Removes a previously registered listener. */
export type Unsubscribe = () => void;

// --- Clock ------------------------------------------------------------------

/** Wall clock and delays, injected so time is controllable in tests. */
export interface ClockPort {
  now(): Millis;
  delay(milliseconds: Millis): Promise<void>;
}

// --- Storage ----------------------------------------------------------------

/** The two extension storage spaces the widget uses (PRD FR-1). */
export type StorageSpace = 'local' | 'session';

/** A stored value's schema version plus the Zod schema that validates it. */
export interface VersionedSchema<T> {
  readonly version: number;
  readonly schema: z.ZodType<T>;
}

/**
 * Schema-versioned extension storage. Values are written wrapped with their
 * schema version; a read whose stored version differs fails with
 * `version-mismatch` so callers can migrate instead of consuming stale data.
 */
export interface StoragePort {
  read<T>(
    space: StorageSpace,
    key: string,
    definition: VersionedSchema<T>,
  ): Promise<Result<T | undefined, PlatformError>>;
  write<T>(
    space: StorageSpace,
    key: string,
    definition: VersionedSchema<T>,
    value: T,
  ): Promise<Result<void, PlatformError>>;
  remove(space: StorageSpace, key: string): Promise<Result<void, PlatformError>>;
}

// --- Tabs -------------------------------------------------------------------

/** A subset of tab properties the widget reads. */
export interface TabInfo {
  readonly id: TabId;
  readonly url?: string;
  readonly title?: string;
  readonly active: boolean;
  readonly status?: string;
}

/** Filters for {@link TabsPort.query}. */
export interface TabQuery {
  readonly active?: boolean;
  readonly currentWindow?: boolean;
  readonly url?: string;
}

/** Read and control browser tabs (PRD FR-7, FR-9). */
export interface TabsPort {
  query(query: TabQuery): Promise<Result<readonly TabInfo[], PlatformError>>;
  get(tabId: TabId): Promise<Result<TabInfo, PlatformError>>;
  getActive(): Promise<Result<TabInfo, PlatformError>>;
  reload(
    tabId: TabId,
    options?: { readonly bypassCache?: boolean },
  ): Promise<Result<void, PlatformError>>;
  update(
    tabId: TabId,
    props: { readonly url?: string; readonly active?: boolean },
  ): Promise<Result<TabInfo, PlatformError>>;
}

// --- Scripting --------------------------------------------------------------

/** The world a script runs in (PRD 7: MAIN world bridge). */
export type ScriptWorld = 'ISOLATED' | 'MAIN';

/** Where a script is injected. */
export interface ScriptTarget {
  readonly tabId: TabId;
  readonly allFrames?: boolean;
}

/** A function injected into a page, with its arguments. */
export interface ScriptInjection {
  readonly target: ScriptTarget;
  readonly func: (...args: readonly unknown[]) => unknown;
  readonly args?: readonly unknown[];
  readonly world?: ScriptWorld;
}

/** Injects scripts and styles into a page (PRD 7 MAIN-world bridge). */
export interface ScriptingPort {
  executeScript(injection: ScriptInjection): Promise<Result<readonly unknown[], PlatformError>>;
  insertCss(options: {
    readonly target: ScriptTarget;
    readonly css: string;
  }): Promise<Result<void, PlatformError>>;
}

// --- Browsing data ----------------------------------------------------------

/** Data types that can be cleared (PRD FR-6). */
export type BrowsingDataType =
  'cache' | 'cookies' | 'indexedDB' | 'localStorage' | 'cacheStorage' | 'serviceWorkers';

/** Options for {@link BrowsingDataPort.remove}. */
export interface BrowsingDataRemoveOptions {
  readonly dataToRemove: readonly BrowsingDataType[];
  readonly origins?: readonly string[];
  readonly since?: Millis;
}

/** Clears browsing data for the current origin (PRD FR-6). */
export interface BrowsingDataPort {
  remove(options: BrowsingDataRemoveOptions): Promise<Result<void, PlatformError>>;
}

// --- Network rules ----------------------------------------------------------

/** Declarative Net Request action types used by the widget (PRD FR-7). */
export type NetworkRuleActionType =
  'block' | 'allow' | 'allowAllRequests' | 'modifyHeaders' | 'redirect' | 'upgradeScheme';

/** A rule action. */
export interface NetworkRuleAction {
  readonly type: NetworkRuleActionType;
  readonly redirectUrl?: string;
}

/** A rule condition. */
export interface NetworkRuleCondition {
  readonly urlFilter?: string;
  readonly resourceTypes?: readonly string[];
  readonly tabIds?: readonly TabId[];
}

/** A Declarative Net Request rule. */
export interface NetworkRule {
  readonly id: number;
  readonly priority: number;
  readonly action: NetworkRuleAction;
  readonly condition: NetworkRuleCondition;
}

/** Session-scoped DNR rules for toggling caching and throttling (PRD FR-7). */
export interface NetworkRulesPort {
  getSessionRules(): Promise<Result<readonly NetworkRule[], PlatformError>>;
  updateSessionRules(change: {
    readonly removeRuleIds?: readonly number[];
    readonly addRules?: readonly NetworkRule[];
  }): Promise<Result<void, PlatformError>>;
}

// --- Debugger ---------------------------------------------------------------

/** A debuggable target (Chromium-only Deep mode, PRD FR-8). */
export interface DebuggerTarget {
  readonly tabId: TabId;
}

/** Chrome Debugger (CDP) access for Deep mode (PRD FR-8, Chromium only). */
export interface DebuggerPort {
  attach(target: DebuggerTarget, version: string): Promise<Result<void, PlatformError>>;
  detach(target: DebuggerTarget): Promise<Result<void, PlatformError>>;
  sendCommand(
    target: DebuggerTarget,
    method: string,
    params?: Readonly<Record<string, unknown>>,
  ): Promise<Result<unknown, PlatformError>>;
  onEvent(handler: (source: DebuggerTarget, method: string, params?: unknown) => void): Unsubscribe;
}

// --- Commands ---------------------------------------------------------------

/** A keyboard command registered in the manifest (PRD FR-1). */
export interface CommandInfo {
  readonly name: string;
  readonly description?: string;
  readonly shortcut?: string;
}

/** Keyboard shortcut commands (PRD FR-1). */
export interface CommandsPort {
  getAll(): Promise<Result<readonly CommandInfo[], PlatformError>>;
  onCommand(handler: (command: string) => void): Unsubscribe;
}

// --- Side panel -------------------------------------------------------------

/** Options for {@link SidePanelPort.setOptions}. */
export interface SidePanelOptions {
  readonly tabId?: TabId;
  readonly path?: string;
  readonly enabled?: boolean;
}

/** Controls the browser side panel (PRD FR-1, FR-2). */
export interface SidePanelPort {
  setOptions(options: SidePanelOptions): Promise<Result<void, PlatformError>>;
  setPanelBehavior(behavior: {
    readonly openPanelOnActionClick: boolean;
  }): Promise<Result<void, PlatformError>>;
  open(options: {
    readonly tabId?: TabId;
    readonly windowId?: number;
  }): Promise<Result<void, PlatformError>>;
}

// --- Aggregate --------------------------------------------------------------

/** Every port the widget needs. */
export interface PlatformPorts {
  readonly clock: ClockPort;
  readonly storage: StoragePort;
  readonly tabs: TabsPort;
  readonly scripting: ScriptingPort;
  readonly browsingData: BrowsingDataPort;
  readonly networkRules: NetworkRulesPort;
  readonly debugger: DebuggerPort;
  readonly commands: CommandsPort;
  readonly sidePanel: SidePanelPort;
}
