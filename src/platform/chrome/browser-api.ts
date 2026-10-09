/**
 * A narrow, structural view of the WebExtension API surface the adapters use.
 *
 * Adapters accept this object rather than importing a global, so tests can pass
 * a mock and the real wiring can pass WXT's `browser` (from `wxt/browser`),
 * which is the browser's native `browser`/`chrome` object with promise-style
 * methods (see ADR 0010).
 */

/** A callable injected by scripting.executeScript. */
export type ScriptFunction = (...args: readonly unknown[]) => unknown;

/** Storage area (chrome.storage.local / chrome.storage.session). */
export interface BrowserStorageAreaApi {
  get(keys?: string | readonly string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | readonly string[]): Promise<void>;
}

export interface BrowserStorageApi {
  readonly local: BrowserStorageAreaApi;
  readonly session: BrowserStorageAreaApi;
}

export interface BrowserTab {
  readonly id?: number;
  readonly url?: string;
  readonly title?: string;
  readonly active: boolean;
  readonly status?: string;
}

export interface BrowserTabsApi {
  query(query: {
    readonly active?: boolean;
    readonly currentWindow?: boolean;
    readonly url?: string;
  }): Promise<readonly BrowserTab[]>;
  get(tabId: number): Promise<BrowserTab>;
  reload(tabId: number, props?: { readonly bypassCache?: boolean }): Promise<void>;
  update(
    tabId: number,
    props: { readonly url?: string; readonly active?: boolean },
  ): Promise<BrowserTab>;
}

export interface BrowserInjectionResult {
  readonly result?: unknown;
}

export interface BrowserScriptingApi {
  executeScript(injection: {
    readonly target: { readonly tabId: number; readonly allFrames?: boolean };
    readonly func: ScriptFunction;
    readonly args?: readonly unknown[];
    readonly world?: string;
  }): Promise<readonly BrowserInjectionResult[]>;
  insertCSS(injection: {
    readonly target: { readonly tabId: number; readonly allFrames?: boolean };
    readonly css: string;
  }): Promise<void>;
}

export interface BrowserBrowsingDataApi {
  remove(options: {
    readonly dataToRemove: readonly string[];
    readonly origins?: readonly string[];
    readonly since?: number;
  }): Promise<void>;
}

export interface BrowserNetworkRulesApi {
  getSessionRules(): Promise<readonly unknown[]>;
  updateSessionRules(options: {
    readonly removeRuleIds?: readonly number[];
    readonly addRules?: readonly unknown[];
  }): Promise<void>;
}

export interface DebuggerEventSource {
  readonly tabId?: number;
}

export interface BrowserDebuggerApi {
  attach(target: { readonly tabId: number }, version: string): Promise<void>;
  detach(target: { readonly tabId: number }): Promise<void>;
  sendCommand(
    target: { readonly tabId: number },
    method: string,
    params?: object,
  ): Promise<unknown>;
  readonly onEvent: {
    addListener(
      listener: (source: DebuggerEventSource, method: string, params?: unknown) => void,
    ): void;
    removeListener(
      listener: (source: DebuggerEventSource, method: string, params?: unknown) => void,
    ): void;
  };
}

export interface BrowserCommand {
  readonly name?: string;
  readonly description?: string;
  readonly shortcut?: string;
}

export interface BrowserCommandsApi {
  getAll(): Promise<readonly BrowserCommand[]>;
  readonly onCommand: {
    addListener(listener: (command: string) => void): void;
    removeListener(listener: (command: string) => void): void;
  };
}

export interface BrowserSidePanelApi {
  setOptions(options: {
    readonly tabId?: number;
    readonly path?: string;
    readonly enabled?: boolean;
  }): Promise<void>;
  setPanelBehavior(behavior: { readonly openPanelOnActionClick: boolean }): Promise<void>;
  open(options: { readonly tabId?: number; readonly windowId?: number }): Promise<void>;
}

/** The full injected API. */
export interface BrowserApi {
  readonly storage: BrowserStorageApi;
  readonly tabs: BrowserTabsApi;
  readonly scripting: BrowserScriptingApi;
  readonly browsingData: BrowserBrowsingDataApi;
  readonly declarativeNetRequest: BrowserNetworkRulesApi;
  readonly debugger: BrowserDebuggerApi;
  readonly commands: BrowserCommandsApi;
  readonly sidePanel: BrowserSidePanelApi;
}
