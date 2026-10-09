import { chromeValue } from '../platform/chrome/index';

export function usesChrome(): string {
  return chromeValue();
}
