/** A window-like target with events (structural, for fakes). */
export interface NavigationTarget {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
}

/** A History API surface (structural, for fakes). */
export interface HistoryLike {
  pushState(data: unknown, unused: string, url?: string | null): void;
  replaceState(data: unknown, unused: string, url?: string | null): void;
}

/** Dependencies for {@link installNavigationWatcher}. */
export interface NavigationWatcherDeps {
  readonly target: NavigationTarget;
  readonly history: HistoryLike;
  readonly getUrl: () => string;
  readonly onChange: (url: string, kind: 'push' | 'replace' | 'pop' | 'navigate') => void;
}

/**
 * Detects navigations, including SPA route changes (PRD FR-9): it wraps
 * `history.pushState`/`replaceState` and listens for `popstate` and the
 * `navigation` event. Returns an uninstall function.
 */
export function installNavigationWatcher(deps: NavigationWatcherDeps): () => void {
  const originalPush = deps.history.pushState.bind(deps.history);
  const originalReplace = deps.history.replaceState.bind(deps.history);

  const push = (data: unknown, unused: string, url?: string | null): void => {
    originalPush(data, unused, url);
    deps.onChange(deps.getUrl(), 'push');
  };
  const replace = (data: unknown, unused: string, url?: string | null): void => {
    originalReplace(data, unused, url);
    deps.onChange(deps.getUrl(), 'replace');
  };
  deps.history.pushState = push;
  deps.history.replaceState = replace;

  const onPop = (): void => {
    deps.onChange(deps.getUrl(), 'pop');
  };
  const onNavigate = (): void => {
    deps.onChange(deps.getUrl(), 'navigate');
  };
  deps.target.addEventListener('popstate', onPop);
  deps.target.addEventListener('navigation', onNavigate);

  return () => {
    deps.history.pushState = originalPush;
    deps.history.replaceState = originalReplace;
    deps.target.removeEventListener('popstate', onPop);
    deps.target.removeEventListener('navigation', onNavigate);
  };
}
