import { afterEach, expect, it, vi } from 'vitest';
import { createId } from './id';
afterEach(() => vi.unstubAllGlobals());
it('creates a version 4 UUID when randomUUID is unavailable on HTTP mobile origins', () => {
  vi.stubGlobal('crypto', {
    getRandomValues: (bytes: Uint8Array) => {
      bytes.fill(255);
      return bytes;
    },
  });
  expect(createId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
});
