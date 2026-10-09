import type {
  BrowserApi,
  BrowserCommand,
  BrowserDebuggerApi,
  BrowserStorageAreaApi,
  BrowserTab,
} from '../../src/platform/chrome/browser-api';
import type { NetworkRule } from '../../src/platform/ports';

/** Options for {@link createMockBrowser}. */
export interface MockBrowserOptions {
  readonly storageQuotaBytes?: number;
}

/** A mocked browser API plus control helpers for the contract suite. */
export interface MockBrowser {
  readonly api: BrowserApi;
  addTab(tab: {
    id: number;
    url?: string;
    title?: string;
    active?: boolean;
    status?: string;
  }): void;
  seed(space: 'local' | 'session', key: string, raw: unknown): void;
  setSessionRule(rule: NetworkRule): void;
  setCommands(commands: readonly BrowserCommand[]): void;
  setDebuggerResponse(method: string, response: unknown): void;
  emitCommand(command: string): void;
}

interface MockStorageArea {
  readonly api: BrowserStorageAreaApi;
  seed(key: string, raw: unknown): void;
}

function createStorageArea(quota: number): MockStorageArea {
  const data = new Map<string, unknown>();
  const api: BrowserStorageAreaApi = {
    get(keys) {
      if (keys === undefined || keys === null) {
        return Promise.resolve(Object.fromEntries(data));
      }
      const list = typeof keys === 'string' ? [keys] : [...keys];
      const result: Record<string, unknown> = {};
      for (const key of list) {
        if (data.has(key)) {
          result[key] = data.get(key);
        }
      }
      return Promise.resolve(result);
    },
    set(items) {
      const backup = new Map(data);
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
      if (JSON.stringify(Object.fromEntries(data)).length > quota) {
        data.clear();
        for (const [key, value] of backup) {
          data.set(key, value);
        }
        return Promise.reject(new Error('QUOTA_BYTES quota exceeded'));
      }
      return Promise.resolve(undefined);
    },
    remove(keys) {
      const list = typeof keys === 'string' ? [keys] : [...keys];
      for (const key of list) {
        data.delete(key);
      }
      return Promise.resolve(undefined);
    },
  };
  return {
    api,
    seed(key, raw) {
      data.set(key, raw);
    },
  };
}

/** Builds a mocked {@link BrowserApi} backed by in-memory state. */
export function createMockBrowser(options: MockBrowserOptions = {}): MockBrowser {
  const quota = options.storageQuotaBytes ?? Number.POSITIVE_INFINITY;
  const local = createStorageArea(quota);
  const session = createStorageArea(quota);

  const tabs = new Map<number, BrowserTab>();
  const sessionRules = new Map<number, NetworkRule>();
  const debuggerResponses = new Map<string, unknown>();
  let commands: readonly BrowserCommand[] = [];
  const commandListeners = new Set<(command: string) => void>();

  const debuggerApi: BrowserDebuggerApi = {
    attach() {
      return Promise.resolve(undefined);
    },
    detach() {
      return Promise.resolve(undefined);
    },
    sendCommand(_target, method) {
      if (!debuggerResponses.has(method)) {
        return Promise.reject(new Error(`Method "${method}" is not implemented`));
      }
      return Promise.resolve(debuggerResponses.get(method));
    },
    onEvent: {
      addListener() {
        return undefined;
      },
      removeListener() {
        return undefined;
      },
    },
  };

  const api: BrowserApi = {
    storage: { local: local.api, session: session.api },
    tabs: {
      query(query) {
        return Promise.resolve(
          [...tabs.values()].filter((tab) => {
            if (query.active !== undefined && tab.active !== query.active) {
              return false;
            }
            if (query.url !== undefined && tab.url !== query.url) {
              return false;
            }
            return true;
          }),
        );
      },
      get(tabId) {
        const tab = tabs.get(tabId);
        if (tab === undefined) {
          return Promise.reject(new Error(`No tab with id ${String(tabId)}`));
        }
        return Promise.resolve(tab);
      },
      reload(tabId) {
        const tab = tabs.get(tabId);
        if (tab === undefined) {
          return Promise.reject(new Error(`No tab with id ${String(tabId)}`));
        }
        tabs.set(tabId, { ...tab, status: 'loading' });
        return Promise.resolve(undefined);
      },
      update(tabId, props) {
        const tab = tabs.get(tabId);
        if (tab === undefined) {
          return Promise.reject(new Error(`No tab with id ${String(tabId)}`));
        }
        const next: BrowserTab = {
          ...tab,
          ...(props.url === undefined ? {} : { url: props.url }),
          ...(props.active === undefined ? {} : { active: props.active }),
        };
        tabs.set(tabId, next);
        return Promise.resolve(next);
      },
    },
    scripting: {
      executeScript() {
        return Promise.resolve([]);
      },
      insertCSS() {
        return Promise.resolve(undefined);
      },
    },
    browsingData: {
      remove() {
        return Promise.resolve(undefined);
      },
    },
    declarativeNetRequest: {
      getSessionRules() {
        return Promise.resolve([...sessionRules.values()]);
      },
      updateSessionRules(change) {
        for (const id of change.removeRuleIds ?? []) {
          sessionRules.delete(id);
        }
        for (const rule of change.addRules ?? []) {
          sessionRules.set((rule as NetworkRule).id, rule as NetworkRule);
        }
        return Promise.resolve(undefined);
      },
    },
    debugger: debuggerApi,
    commands: {
      getAll() {
        return Promise.resolve(commands);
      },
      onCommand: {
        addListener(listener) {
          commandListeners.add(listener);
        },
        removeListener(listener) {
          commandListeners.delete(listener);
        },
      },
    },
    sidePanel: {
      setOptions() {
        return Promise.resolve(undefined);
      },
      setPanelBehavior() {
        return Promise.resolve(undefined);
      },
      open() {
        return Promise.resolve(undefined);
      },
    },
  };

  return {
    api,
    addTab(tab) {
      tabs.set(tab.id, { ...tab, active: tab.active ?? false });
    },
    seed(space, key, raw) {
      (space === 'local' ? local : session).seed(key, raw);
    },
    setSessionRule(rule) {
      sessionRules.set(rule.id, rule);
    },
    setCommands(next) {
      commands = next;
    },
    setDebuggerResponse(method, response) {
      debuggerResponses.set(method, response);
    },
    emitCommand(command) {
      for (const listener of [...commandListeners]) {
        listener(command);
      }
    },
  };
}
