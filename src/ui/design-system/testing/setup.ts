import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

// Testing Library auto-cleanup only runs with global test APIs enabled; this
// project uses explicit imports, so register cleanup here.
afterEach(() => {
  cleanup();
});
