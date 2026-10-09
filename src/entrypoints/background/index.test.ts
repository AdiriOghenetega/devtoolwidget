import { describe, expect, it } from 'vitest';
import background from './index';

describe('background entrypoint', () => {
  it('registers a WXT background definition', () => {
    expect(background).toBeDefined();
  });
});
