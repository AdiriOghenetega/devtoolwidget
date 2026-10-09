import { z } from 'zod';
import { err, ok, toMillis, toTabId, type Millis, type Result, type TabId } from '../../core';
import {
  platformError,
  type BrowsingDataPort,
  type BrowsingDataRemoveOptions,
  type ClockPort,
  type CommandInfo,
  type CommandsPort,
  type DebuggerPort,
  type DebuggerTarget,
  type NetworkRule,
  type NetworkRulesPort,
  type PlatformError,
  type PlatformPorts,
  type ScriptInjection,
  type ScriptingPort,
  type SidePanelOptions,
  type SidePanelPort,
  type StoragePort,
  type StorageSpace,
  type TabInfo,
  type TabQuery,
  type TabsPort,
  type VersionedSchema,
} from '../ports';

// --- Clock ------------------------------------------------------------------

/** A {@link ClockPort} whose time only moves when `advance`/`set` is called. */
export interface FakeClockPort extends ClockPort {
  set(value: Millis): void;
  advance(milliseconds: number): Promise<void>;
}

/** Creates a controllable fake clock. */
export function createFakeClockPort(start = 0): FakeClockPort {
  let current = start;
  let nextId = 0;
  const pending = new Map<number, { readonly at: number; readonly resolve: () => void }>();
  return {
    now: () => toMillis(current),
    delay: (milliseconds) =>
      new Promise<void>((resolve) => {
        nextId += 1;
        pending.set(nextId, { at: current + milliseconds, resolve });
      }),
    set(value) {
      current = value;
    },
    async advance(milliseconds) {
      current += milliseconds;
      for (const [id, entry] of [...pending]) {
        if (entry.at <= current) {
          pending.delete(id);
          entry.resolve();
        }
      }
      await Promise.resolve();
    },
  };
}

// --- Storage ----------------------------------------------------------------

/** Options for {@link createFakeStoragePort}. */
export interface FakeStorageOptions {
  /** Per-space quota in bytes; writes above it fail with `quota-exceeded`. */
  readonly quotaBytesPerSpace?: number;
}

/** A {@link StoragePort} backed by maps, with control helpers. */
export interface FakeStoragePort extends StoragePort {
  seed(space: StorageSpace, key: string, raw: unknown): void;
  snapshot(space: StorageSpace): Readonly<Record<string, unknown>>;
}

const storedValueSchema = z.object({ version: z.number().int(), value: z.unknown() });

/** Creates an in-memory, quota-aware fake storage. */
export function createFakeStoragePort(options: FakeStorageOptions = {}): FakeStoragePort {
  const quota = options.quotaBytesPerSpace ?? Number.POSITIVE_INFINITY;
  const spaces: Record<StorageSpace, Map<string, unknown>> = {
    local: new Map(),
    session: new Map(),
  };
  const sizeOf = (space: StorageSpace): number =>
    JSON.stringify(Object.fromEntries(spaces[space])).length;
  return {
    seed(space, key, raw) {
      spaces[space].set(key, raw);
    },
    snapshot(space) {
      return Object.fromEntries(spaces[space]);
    },
    read(space, key, definition) {
      return Promise.resolve(readValue(spaces[space], key, definition));
    },
    write(space, key, definition, value) {
      spaces[space].set(key, { version: definition.version, value });
      if (sizeOf(space) > quota) {
        spaces[space].delete(key);
        return Promise.resolve(
          err(platformError('quota-exceeded', `Storage space "${space}" is full`)),
        );
      }
      return Promise.resolve(ok(undefined));
    },
    remove(space, key) {
      spaces[space].delete(key);
      return Promise.resolve(ok(undefined));
    },
  };
}

function readValue<T>(
  space: Map<string, unknown>,
  key: string,
  definition: VersionedSchema<T>,
): Result<T | undefined, PlatformError> {
  const stored = space.get(key);
  if (stored === undefined) {
    return ok(undefined);
  }
  const wrapper = storedValueSchema.safeParse(stored);
  if (!wrapper.success) {
    return err(platformError('invalid-data', `Stored value "${key}" is malformed`));
  }
  if (wrapper.data.version !== definition.version) {
    return err(
      platformError(
        'version-mismatch',
        `Stored "${key}" is version ${String(wrapper.data.version)}, expected ${String(definition.version)}`,
      ),
    );
  }
  const parsed = definition.schema.safeParse(wrapper.data.value);
  if (!parsed.success) {
    return err(platformError('invalid-data', `Stored "${key}" does not match its schema`));
  }
  return ok(parsed.data);
}

// --- Tabs -------------------------------------------------------------------

/** A {@link TabsPort} backed by a map, with control helpers. */
export interface FakeTabsPort extends TabsPort {
  addTab(tab: {
    id: number;
    url?: string;
    title?: string;
    active?: boolean;
    status?: string;
  }): void;
  removeTab(id: number): void;
}

function tabInfoFrom(tab: {
  id: number;
  url?: string;
  title?: string;
  active?: boolean;
  status?: string;
}): TabInfo {
  const info: { id: TabId; url?: string; title?: string; active: boolean; status?: string } = {
    id: toTabId(tab.id),
    active: tab.active ?? false,
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

/** Creates an in-memory fake tabs port. */
export function createFakeTabsPort(): FakeTabsPort {
  const tabs = new Map<number, Parameters<FakeTabsPort['addTab']>[0]>();
  const matches = (tab: { url?: string; active?: boolean }, query: TabQuery): boolean => {
    if (query.active !== undefined && (tab.active ?? false) !== query.active) {
      return false;
    }
    if (query.url !== undefined && tab.url !== query.url) {
      return false;
    }
    return true;
  };
  return {
    addTab(tab) {
      tabs.set(tab.id, tab);
    },
    removeTab(id) {
      tabs.delete(id);
    },
    query(query) {
      const result = [...tabs.values()]
        .filter((tab) => matches(tab, query))
        .map((tab) => tabInfoFrom(tab));
      return Promise.resolve(ok(result));
    },
    get(tabId) {
      const tab = tabs.get(tabId);
      return Promise.resolve(
        tab === undefined ? err(platformError('not-found', 'No such tab')) : ok(tabInfoFrom(tab)),
      );
    },
    getActive() {
      const tab = [...tabs.values()].find((candidate) => candidate.active ?? false);
      return Promise.resolve(
        tab === undefined ? err(platformError('not-found', 'No active tab')) : ok(tabInfoFrom(tab)),
      );
    },
    reload(tabId) {
      const tab = tabs.get(tabId);
      if (tab === undefined) {
        return Promise.resolve(err(platformError('not-found', 'No such tab')));
      }
      tab.status = 'loading';
      return Promise.resolve(ok(undefined));
    },
    update(tabId, props) {
      const tab = tabs.get(tabId);
      if (tab === undefined) {
        return Promise.resolve(err(platformError('not-found', 'No such tab')));
      }
      if (props.url !== undefined) {
        tab.url = props.url;
      }
      if (props.active !== undefined) {
        tab.active = props.active;
      }
      return Promise.resolve(ok(tabInfoFrom(tab)));
    },
  };
}

// --- Scripting --------------------------------------------------------------

/** A {@link ScriptingPort} that records injections. */
export interface FakeScriptingPort extends ScriptingPort {
  readonly injections: readonly ScriptInjection[];
  readonly insertedCss: readonly string[];
  setResults(results: readonly unknown[]): void;
}

/** Creates a recording fake scripting port. */
export function createFakeScriptingPort(): FakeScriptingPort {
  const injections: ScriptInjection[] = [];
  const insertedCss: string[] = [];
  let results: readonly unknown[] = [];
  return {
    injections,
    insertedCss,
    setResults(next) {
      results = next;
    },
    executeScript(injection) {
      injections.push(injection);
      return Promise.resolve(ok(results));
    },
    insertCss(options) {
      insertedCss.push(options.css);
      return Promise.resolve(ok(undefined));
    },
  };
}

// --- Browsing data ----------------------------------------------------------

/** A {@link BrowsingDataPort} that records the last clear operation. */
export interface FakeBrowsingDataPort extends BrowsingDataPort {
  readonly removals: readonly BrowsingDataRemoveOptions[];
}

/** Creates a recording fake browsing data port. */
export function createFakeBrowsingDataPort(): FakeBrowsingDataPort {
  const removals: BrowsingDataRemoveOptions[] = [];
  return {
    removals,
    remove(options) {
      removals.push(options);
      return Promise.resolve(ok(undefined));
    },
  };
}

// --- Network rules ----------------------------------------------------------

/** A {@link NetworkRulesPort} backed by an in-memory session ruleset. */
export interface FakeNetworkRulesPort extends NetworkRulesPort {
  readonly rules: readonly NetworkRule[];
}

/** Creates an in-memory fake session rules port. */
export function createFakeNetworkRulesPort(): FakeNetworkRulesPort {
  const rules = new Map<number, NetworkRule>();
  return {
    get rules() {
      return [...rules.values()];
    },
    getSessionRules() {
      return Promise.resolve(ok([...rules.values()]));
    },
    updateSessionRules(change) {
      for (const id of change.removeRuleIds ?? []) {
        rules.delete(id);
      }
      for (const rule of change.addRules ?? []) {
        rules.set(rule.id, rule);
      }
      return Promise.resolve(ok(undefined));
    },
  };
}

// --- Debugger ---------------------------------------------------------------

/** A {@link DebuggerPort} that models attach/detach, commands and events. */
export interface FakeDebuggerPort extends DebuggerPort {
  setResponse(method: string, response: unknown): void;
  emit(target: DebuggerTarget, method: string, params?: unknown): void;
  readonly attached: readonly TabId[];
}

/** Creates a fake debugger port; unconfigured commands fail with `unsupported`. */
export function createFakeDebuggerPort(): FakeDebuggerPort {
  const attached = new Set<number>();
  const responses = new Map<string, unknown>();
  const listeners = new Set<(source: DebuggerTarget, method: string, params?: unknown) => void>();
  return {
    get attached() {
      return [...attached].map((id) => toTabId(id));
    },
    setResponse(method, response) {
      responses.set(method, response);
    },
    emit(target, method, params) {
      for (const listener of [...listeners]) {
        listener(target, method, params);
      }
    },
    attach(target) {
      attached.add(target.tabId);
      return Promise.resolve(ok(undefined));
    },
    detach(target) {
      attached.delete(target.tabId);
      return Promise.resolve(ok(undefined));
    },
    sendCommand(_target, method) {
      if (!responses.has(method)) {
        return Promise.resolve(
          err(platformError('unsupported', `Method "${method}" is unavailable`)),
        );
      }
      return Promise.resolve(ok(responses.get(method)));
    },
    onEvent(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
}

// --- Commands ---------------------------------------------------------------

/** A {@link CommandsPort} with a settable command list and event emitter. */
export interface FakeCommandsPort extends CommandsPort {
  setCommands(commands: readonly CommandInfo[]): void;
  emit(command: string): void;
}

/** Creates a fake commands port. */
export function createFakeCommandsPort(): FakeCommandsPort {
  let commands: readonly CommandInfo[] = [];
  const listeners = new Set<(command: string) => void>();
  return {
    setCommands(next) {
      commands = next;
    },
    emit(command) {
      for (const listener of [...listeners]) {
        listener(command);
      }
    },
    getAll() {
      return Promise.resolve(ok(commands));
    },
    onCommand(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
}

// --- Side panel -------------------------------------------------------------

/** A {@link SidePanelPort} that records calls. */
export interface FakeSidePanelPort extends SidePanelPort {
  readonly optionCalls: readonly SidePanelOptions[];
  readonly openCalls: readonly { readonly tabId?: TabId; readonly windowId?: number }[];
  behavior: { readonly openPanelOnActionClick: boolean } | undefined;
}

/** Creates a recording fake side panel port. */
export function createFakeSidePanelPort(): FakeSidePanelPort {
  const optionCalls: SidePanelOptions[] = [];
  const openCalls: { readonly tabId?: TabId; readonly windowId?: number }[] = [];
  const port: FakeSidePanelPort = {
    optionCalls,
    openCalls,
    behavior: undefined,
    setOptions(options) {
      optionCalls.push(options);
      return Promise.resolve(ok(undefined));
    },
    setPanelBehavior(behavior) {
      port.behavior = behavior;
      return Promise.resolve(ok(undefined));
    },
    open(options) {
      openCalls.push(options);
      return Promise.resolve(ok(undefined));
    },
  };
  return port;
}

// --- Aggregate --------------------------------------------------------------

/** Options for {@link createFakePorts}. */
export interface FakePortsOptions extends FakeStorageOptions {
  readonly now?: number;
}

/** Every fake port, wired into a {@link PlatformPorts}. */
export interface FakePorts extends PlatformPorts {
  readonly clock: FakeClockPort;
  readonly storage: FakeStoragePort;
  readonly tabs: FakeTabsPort;
  readonly scripting: FakeScriptingPort;
  readonly browsingData: FakeBrowsingDataPort;
  readonly networkRules: FakeNetworkRulesPort;
  readonly debugger: FakeDebuggerPort;
  readonly commands: FakeCommandsPort;
  readonly sidePanel: FakeSidePanelPort;
}

/** Builds a full set of in-memory fake ports. */
export function createFakePorts(options: FakePortsOptions = {}): FakePorts {
  return {
    clock: createFakeClockPort(options.now),
    storage: createFakeStoragePort({
      ...(options.quotaBytesPerSpace === undefined
        ? {}
        : { quotaBytesPerSpace: options.quotaBytesPerSpace }),
    }),
    tabs: createFakeTabsPort(),
    scripting: createFakeScriptingPort(),
    browsingData: createFakeBrowsingDataPort(),
    networkRules: createFakeNetworkRulesPort(),
    debugger: createFakeDebuggerPort(),
    commands: createFakeCommandsPort(),
    sidePanel: createFakeSidePanelPort(),
  };
}
