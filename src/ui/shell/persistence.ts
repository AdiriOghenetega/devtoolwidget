/**
 * The shell's persisted state contract. The definition lives in `core` so the
 * `document_start` launcher and the lazy shell share one type without the
 * bootstrap importing `ui` (ADR 0019).
 */
export type { ShellPersistence } from '../../core';
