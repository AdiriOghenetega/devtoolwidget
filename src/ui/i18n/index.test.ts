import { describe, expect, it } from 'vitest';
import { messages, t } from './index';

describe('i18n', () => {
  it('returns the catalog string for a key', () => {
    expect(t('common.close')).toBe('Close');
    expect(t('common.close')).toBe(messages['common.close']);
  });

  it('substitutes named parameters', () => {
    expect(t('virtualList.label', { name: 'Requests' })).toBe('List');
  });
});
