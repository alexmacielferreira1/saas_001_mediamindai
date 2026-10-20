import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Under jsdom on recent Node versions TextEncoder returns a Uint8Array from another realm,
// so `instanceof Uint8Array` checks (e.g. fflate) fail. Browsers share one realm.
if (!(new TextEncoder().encode('') instanceof Uint8Array)) {
  const NativeTextEncoder = globalThis.TextEncoder;
  globalThis.TextEncoder = class extends NativeTextEncoder {
    encode(input) {
      return new Uint8Array(super.encode(input));
    }
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});
