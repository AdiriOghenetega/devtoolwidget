import { z } from 'zod';
import { err, ok, toMillis, toTabId, type Result, type TabId } from '../../core';
import { platformError, type PlatformError } from '../ports/errors';
import type {
  BrowsingDataPort,
  ClockPort,
  CommandsPort,
  CommandInfo,
  DebuggerPort,
  NetworkRule,
  NetworkRuleAction,
  NetworkRuleCondition,
  NetworkRulesPort,
  PlatformPorts,
  ScriptingPort,
  SidePanelOptions,
  SidePanelPort,
  StoragePort,
  StorageSpace,
  TabInfo,
  TabsPort,
} from '../ports';
import type { BrowserApi, BrowserCommand, BrowserStorageAreaApi, BrowserTab } from './browser-api';
import { toPlatformError } from './errors';

async function attempt<T>(operation: () => Promise<T> | T): Promise<Result<T, PlatformError>> {
  try {
    return ok(await operation());
  } catch (error: unknown) {
    return err(toPlatformError(error));
  }
}

// --- Clock ------------------------------------------------------------------

/** Real clock backed by `Date.now` and `setTimeout`. */
export function createClockPort(): ClockPort {
  return {
    now: () => toMillis(Date.now()),
    delay: (milliseconds) =>
      new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, milliseconds);
      }),
  };
}

// --- Storage ----------------------------------------------------------------

const storedValueSchema = z.object({ version: z.number().int(), value: z.unknown() });

/** Storage over `chrome.storage.local` and `chrome.storage.session`, schema-versioned. */
export function createStoragePort(api: BrowserApi): StoragePort {
  const areaOf = (space: StorageSpace): BrowserStorageAreaApi =>
    space === 'local' ? api.storage.local : api.storage.session;
  return {
    read(space, key, definition) {
      return attempt(async () => {
        const raw = await areaOf(space).get(key);
        const stored = raw[key];
        if (stored === undefined) {
          return undefined;
        }
        const wrapper = storedValueSchema.safeParse(stored);
        if (!wrapper.success) {
          throw platformError('invalid-data', `Stored value "${key}" is malformed`);
        }
        if (wrapper.data.version !== definition.version) {
          throw platformError(
            'version-mismatch',
            `Stored "${key}" is version ${String(wrapper.data.version)}, expected ${String(definition.version)}`,
          );
        }
        const parsed = definition.schema.safeParse(wrapper.data.value);
        if (!parsed.success) {
          throw platformError('invalid-data', `Stored "${key}" does not match its schema`);
        }
        return parsed.data;
      });
    },
    write(space, key, definition, value) {
      return attempt(async () => {
        await areaOf(space).set({ [key]: { version: definition.version, value } });
      });
    },
    remove(space, key) {
      return attempt(async () => {
        await areaOf(space).remove(key);
      });
    },
  };
}

// --- Tabs -------------------------------------------------------------------

function toTabInfo(tab: BrowserTab): TabInfo {
  if (typeof tab.id !== 'number') {
    throw platformError('invalid-data', 'Tab is missing an id');
  }
  const info: { id: TabId; url?: string; title?: string; active: boolean; status?: string } = {
    id: toTabId(tab.id),
    active: tab.active,
  };
  if (tab.url !== undefined) {
    info.url = tab.url;
  }
  if (tab.title !== undefined) {
    info.title = tab.title;
  }
  if (tab.status !== undefined) {
    info.status = tab.status;
  }
  return info;
}

/** Read and control tabs via `chrome.tabs`. */
export function createTabsPort(api: BrowserApi): TabsPort {
  return {
    query(query) {
      return attempt(async () => {
        const tabs = await api.tabs.query({
          ...(query.active === undefined ? {} : { active: query.active }),
          ...(query.currentWindow === undefined ? {} : { currentWindow: query.currentWindow }),
          ...(query.url === undefined ? {} : { url: query.url }),
        });
        return tabs.map(toTabInfo);
      });
    },
    get(tabId) {
      return attempt(async () => toTabInfo(await api.tabs.get(tabId)));
    },
    getActive() {
      return attempt(async () => {
        const tabs = await api.tabs.query({ active: true, currentWindow: true });
        const first = tabs[0];
        if (first === undefined) {
          throw platformError('not-found', 'No active tab');
        }
        return toTabInfo(first);
      });
    },
    reload(tabId, options) {
      return attempt(async () => {
        await api.tabs.reload(tabId, { bypassCache: options?.bypassCache ?? false });
      });
    },
    update(tabId, props) {
      return attempt(async () => {
        const updated = await api.tabs.update(tabId, {
          ...(props.url === undefined ? {} : { url: props.url }),
          ...(props.active === undefined ? {} : { active: props.active }),
        });
        return toTabInfo(updated);
      });
    },
  };
}

// --- Scripting --------------------------------------------------------------

/** Inject scripts and styles via `chrome.scripting`. */
export function createScriptingPort(api: BrowserApi): ScriptingPort {
  return {
    executeScript(injection) {
      return attempt(async () => {
        const results = await api.scripting.executeScript({
          target: {
            tabId: injection.target.tabId,
            ...(injection.target.allFrames === undefined
              ? {}
              : { allFrames: injection.target.allFrames }),
          },
          func: injection.func,
          ...(injection.args === undefined ? {} : { args: [...injection.args] }),
          ...(injection.world === undefined ? {} : { world: injection.world }),
        });
        return results.map((entry) => entry.result);
      });
    },
    insertCss(options) {
      return attempt(async () => {
        await api.scripting.insertCSS({
          target: {
            tabId: options.target.tabId,
            ...(options.target.allFrames === undefined
              ? {}
              : { allFrames: options.target.allFrames }),
          },
          css: options.css,
        });
      });
    },
  };
}

// --- Browsing data ----------------------------------------------------------

/** Clear browsing data via `chrome.browsingData`. */
export function createBrowsingDataPort(api: BrowserApi): BrowsingDataPort {
  return {
    remove(options) {
      return attempt(async () => {
        await api.browsingData.remove({
          dataToRemove: [...options.dataToRemove],
          ...(options.origins === undefined ? {} : { origins: [...options.origins] }),
          ...(options.since === undefined ? {} : { since: options.since }),
        });
      });
    },
  };
}

// --- Network rules ----------------------------------------------------------

const networkRuleActionSchema = z.object({
  type: z.enum([
    'block',
    'allow',
    'allowAllRequests',
    'modifyHeaders',
    'redirect',
    'upgradeScheme',
  ]),
  redirectUrl: z.string().optional(),
});

const networkRuleConditionSchema = z.object({
  urlFilter: z.string().optional(),
  resourceTypes: z.array(z.string()).optional(),
  tabIds: z.array(z.number().int()).optional(),
});

const networkRuleSchema = z.object({
  id: z.number().int(),
  priority: z.number().int(),
  action: networkRuleActionSchema,
  condition: networkRuleConditionSchema,
});

function toNetworkRuleCondition(
  condition: z.infer<typeof networkRuleConditionSchema>,
): NetworkRuleCondition {
  const result: {
    urlFilter?: string;
    resourceTypes?: readonly string[];
    tabIds?: readonly TabId[];
  } = {};
  if (condition.urlFilter !== undefined) {
    result.urlFilter = condition.urlFilter;
  }
  if (condition.resourceTypes !== undefined) {
    result.resourceTypes = condition.resourceTypes;
  }
  if (condition.tabIds !== undefined) {
    result.tabIds = condition.tabIds.map((id) => toTabId(id));
  }
  return result;
}

function toNetworkRule(raw: unknown): NetworkRule {
  const parsed = networkRuleSchema.safeParse(raw);
  if (!parsed.success) {
    throw platformError('invalid-data', 'A session rule returned by the browser is malformed');
  }
  const { id, priority, action, condition } = parsed.data;
  const ruleAction: NetworkRuleAction =
    action.redirectUrl === undefined
      ? { type: action.type }
      : { type: action.type, redirectUrl: action.redirectUrl };
  return { id, priority, action: ruleAction, condition: toNetworkRuleCondition(condition) };
}

/** Session-scoped DNR rules via `chrome.declarativeNetRequest`. */
export function createNetworkRulesPort(api: BrowserApi): NetworkRulesPort {
  return {
    getSessionRules() {
      return attempt(async () => {
        const rules = await api.declarativeNetRequest.getSessionRules();
        return rules.map(toNetworkRule);
      });
    },
    updateSessionRules(change) {
      return attempt(async () => {
        await api.declarativeNetRequest.updateSessionRules({
          ...(change.removeRuleIds === undefined
            ? {}
            : { removeRuleIds: [...change.removeRuleIds] }),
          ...(change.addRules === undefined ? {} : { addRules: [...change.addRules] }),
        });
      });
    },
  };
}

// --- Debugger ---------------------------------------------------------------

/** Chrome Debugger (CDP) access for Deep mode via `chrome.debugger`. */
export function createDebuggerPort(api: BrowserApi): DebuggerPort {
  return {
    attach(target, version) {
      return attempt(async () => {
        await api.debugger.attach({ tabId: target.tabId }, version);
      });
    },
    detach(target) {
      return attempt(async () => {
        await api.debugger.detach({ tabId: target.tabId });
      });
    },
    sendCommand(target, method, params) {
      return attempt(async () => api.debugger.sendCommand({ tabId: target.tabId }, method, params));
    },
    onEvent(handler) {
      const listener = (
        source: { readonly tabId?: number },
        method: string,
        params?: unknown,
      ): void => {
        if (typeof source.tabId === 'number') {
          handler({ tabId: toTabId(source.tabId) }, method, params);
        }
      };
      api.debugger.onEvent.addListener(listener);
      return () => {
        api.debugger.onEvent.removeListener(listener);
      };
    },
  };
}

// --- Commands ---------------------------------------------------------------

function toCommandInfo(command: BrowserCommand): CommandInfo {
  const info: { name: string; description?: string; shortcut?: string } = {
    name: command.name ?? '',
  };
  if (command.description !== undefined) {
    info.description = command.description;
  }
  if (command.shortcut !== undefined) {
    info.shortcut = command.shortcut;
  }
  return info;
}

/** Keyboard commands via `chrome.commands`. */
export function createCommandsPort(api: BrowserApi): CommandsPort {
  return {
    getAll() {
      return attempt(async () => {
        const commands = await api.commands.getAll();
        return commands.map(toCommandInfo);
      });
    },
    onCommand(handler) {
      const listener = (command: string): void => {
        handler(command);
      };
      api.commands.onCommand.addListener(listener);
      return () => {
        api.commands.onCommand.removeListener(listener);
      };
    },
  };
}

// --- Side panel -------------------------------------------------------------

function toSidePanelApiOptions(options: SidePanelOptions): {
  tabId?: number;
  path?: string;
  enabled?: boolean;
} {
  const result: { tabId?: number; path?: string; enabled?: boolean } = {};
  if (options.tabId !== undefined) {
    result.tabId = options.tabId;
  }
  if (options.path !== undefined) {
    result.path = options.path;
  }
  if (options.enabled !== undefined) {
    result.enabled = options.enabled;
  }
  return result;
}

/** Side panel control via `chrome.sidePanel` (Chromium only; see ADR 0010). */
export function createSidePanelPort(api: BrowserApi): SidePanelPort {
  return {
    setOptions(options) {
      return attempt(async () => {
        await api.sidePanel.setOptions(toSidePanelApiOptions(options));
      });
    },
    setPanelBehavior(behavior) {
      return attempt(async () => {
        await api.sidePanel.setPanelBehavior({
          openPanelOnActionClick: behavior.openPanelOnActionClick,
        });
      });
    },
    open(options) {
      return attempt(async () => {
        await api.sidePanel.open({
          ...(options.tabId === undefined ? {} : { tabId: options.tabId }),
          ...(options.windowId === undefined ? {} : { windowId: options.windowId }),
        });
      });
    },
  };
}

// --- Aggregate --------------------------------------------------------------

/** Builds all Chrome adapters from an injected browser API. */
export function createChromePorts(api: BrowserApi): PlatformPorts {
  return {
    clock: createClockPort(),
    storage: createStoragePort(api),
    tabs: createTabsPort(api),
    scripting: createScriptingPort(api),
    browsingData: createBrowsingDataPort(api),
    networkRules: createNetworkRulesPort(api),
    debugger: createDebuggerPort(api),
    commands: createCommandsPort(api),
    sidePanel: createSidePanelPort(api),
  };
}
