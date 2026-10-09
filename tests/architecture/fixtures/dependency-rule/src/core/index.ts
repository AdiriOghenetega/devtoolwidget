import { uiValue } from '../ui/index';

export function coreValue(): string {
  return `core depends on ${uiValue()}`;
}
