import type { Result } from '../../core';
import type { PlatformError } from './errors';

/**
 * Optional host permissions (PRD 7: optional permissions for host access per
 * site). `onRemoved` fires when the user or browser revokes an origin.
 */
export interface PermissionsPort {
  contains(origins: readonly string[]): Promise<Result<boolean, PlatformError>>;
  request(origins: readonly string[]): Promise<Result<boolean, PlatformError>>;
  remove(origins: readonly string[]): Promise<Result<void, PlatformError>>;
  getAll(): Promise<Result<readonly string[], PlatformError>>;
  onRemoved(listener: (removed: readonly string[]) => void): () => void;
}
