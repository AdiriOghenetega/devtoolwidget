import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_LAUNCHER_PLACEMENT,
  type DockMode,
  type LauncherPlacement,
  type Size,
  type Viewport,
} from '../../core';
import { HealthBadge } from './HealthBadge';
import { Launcher } from './Launcher';
import { resolveShellMode, type SidePanelCapability } from './mode';
import type { PanelProps } from './Panel';
import type { ShellPersistence } from './persistence';

/** The lazily-loaded panel module. */
export interface ShellPanelModule {
  readonly Panel: (props: PanelProps) => JSX.Element;
}

/** Loads the panel module; overridable so the lazy-load boundary is testable. */
export type LoadPanel = () => Promise<ShellPanelModule>;

/** Imperative controls the shell exposes to its host. */
export interface ShellControls {
  open(): void;
  close(): void;
}

/** A mutable ref the shell fills with its {@link ShellControls}. */
export interface ShellControlsRef {
  current: ShellControls | null;
}

/** Props for {@link Shell}. */
export interface ShellProps {
  readonly origin: string;
  readonly topFrame: boolean;
  readonly score: number;
  readonly errorCount: number;
  readonly persistence: ShellPersistence;
  readonly sidePanel?: SidePanelCapability;
  readonly loadPanel?: LoadPanel;
  readonly viewport?: Viewport;
  readonly panelSize?: Size;
  /**
   * Opens the panel as soon as the shell becomes enabled. The content script sets
   * this when the first interaction (launcher click, shortcut or command) hands
   * off to the lazily imported shell, so that first click opens the panel
   * (ADR 0019).
   */
  readonly initialOpen?: boolean;
  /** Optional ref the shell fills with an imperative {@link ShellControls}. */
  readonly controls?: ShellControlsRef;
}

const DEFAULT_PANEL_SIZE: Size = { width: 360, height: 560 };

/**
 * The page shell (PRD FR-1): a draggable, snapping launcher and a minimized
 * health badge, mounting only in the top frame and staying inert until the site
 * disabled flag is known. Opening the panel lazy-loads its module on first use,
 * or delegates to the Chrome side panel when available.
 */
export function Shell({
  origin,
  topFrame,
  score,
  errorCount,
  persistence,
  sidePanel,
  loadPanel,
  viewport,
  panelSize = DEFAULT_PANEL_SIZE,
  initialOpen = false,
  controls,
}: ShellProps): JSX.Element | null {
  const [siteState, setSiteState] = useState<'unknown' | 'enabled' | 'disabled'>('unknown');
  const [placement, setPlacement] = useState<LauncherPlacement>(DEFAULT_LAUNCHER_PLACEMENT);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DockMode>('right');
  const [size, setSize] = useState<Size>(panelSize);
  const [panelModule, setPanelModule] = useState<ShellPanelModule | undefined>(undefined);
  const autoOpened = useRef(false);

  useEffect(() => {
    if (!topFrame) {
      return;
    }
    let cancelled = false;
    void persistence.loadLauncher(origin).then((saved) => {
      if (!cancelled && saved !== undefined) {
        setPlacement(saved);
      }
    });
    void persistence.isSiteDisabled(origin).then((disabled) => {
      if (!cancelled) {
        setSiteState(disabled ? 'disabled' : 'enabled');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [origin, persistence, topFrame]);

  const openPanel = (): void => {
    const resolved = resolveShellMode(sidePanel ?? { available: false });
    if (resolved === 'side-panel' && sidePanel?.open !== undefined) {
      void sidePanel.open();
      return;
    }
    const load = loadPanel ?? (() => import('./Panel').then((module) => ({ Panel: module.Panel })));
    void load().then((module) => {
      setPanelModule(module);
      setOpen(true);
    });
  };

  // Expose imperative controls so the host can open the already-mounted panel on a
  // later interaction without re-mounting the shell.
  useEffect(() => {
    if (controls === undefined) {
      return;
    }
    controls.current = {
      open: openPanel,
      close: () => {
        setOpen(false);
      },
    };
    return () => {
      controls.current = null;
    };
  });

  // First interaction handed off from the document_start launcher: open the panel
  // once (and only once) as soon as the site state is known to be enabled.
  useEffect(() => {
    if (!initialOpen || !topFrame || siteState !== 'enabled' || autoOpened.current) {
      return;
    }
    autoOpened.current = true;
    openPanel();
  }, [initialOpen, topFrame, siteState]);

  if (!topFrame || siteState !== 'enabled') {
    return null;
  }

  const Panel = panelModule?.Panel;

  return (
    <div class="dwt-shell">
      {!open && (
        <>
          <Launcher
            placement={placement}
            {...(viewport === undefined ? {} : { viewport })}
            onOpen={openPanel}
            onPlacementChange={(next) => {
              setPlacement(next);
              void persistence.saveLauncher(origin, next);
            }}
          />
          <HealthBadge score={score} errorCount={errorCount} onClick={openPanel} />
        </>
      )}
      {open && Panel !== undefined && (
        <Panel
          mode={mode}
          size={size}
          {...(viewport === undefined ? {} : { viewport })}
          onModeChange={setMode}
          onResize={setSize}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
