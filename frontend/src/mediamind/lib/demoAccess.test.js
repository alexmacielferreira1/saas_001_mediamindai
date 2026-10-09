import { describe, expect, it } from 'vitest';

import { isLocalDemoAvailable, readLocalDemoSession } from './demoAccess';

describe('demo access visibility', () => {
  it('is available only in local development', () => {
    expect(isLocalDemoAvailable({ dev: true, hostname: 'localhost' })).toBe(true);
    expect(isLocalDemoAvailable({ dev: true, hostname: '127.0.0.1' })).toBe(true);
  });

  it('is hidden in production even when the published login page is reachable', () => {
    expect(isLocalDemoAvailable({ dev: false, hostname: 'mediamindai-frontend.onrender.com' })).toBe(false);
    expect(isLocalDemoAvailable({ dev: false, hostname: 'localhost' })).toBe(false);
    expect(isLocalDemoAvailable({ dev: true, hostname: 'mediamindai-frontend.onrender.com' })).toBe(false);
  });

  it('reads a valid local demo session and discards invalid storage', () => {
    const storage = { getItem: () => '{"id":"demo-editor"}' };
    expect(readLocalDemoSession({ dev: true, hostname: 'localhost', storage })).toEqual({ id: 'demo-editor' });
    expect(readLocalDemoSession({ dev: false, hostname: 'localhost', storage })).toBeNull();
    expect(readLocalDemoSession({ dev: true, hostname: 'localhost', storage: { getItem: () => '{bad' } })).toBeNull();
  });
});
