import { describe, expect, it } from 'vitest';

import { canViewProfiles } from './Home';

describe('profiles access from home', () => {
  it('is visible only to superadmins', () => {
    expect(canViewProfiles({ role: 'superadmin' })).toBe(true);
    expect(canViewProfiles({ role: 'admin' })).toBe(false);
    expect(canViewProfiles({ role: 'editor' })).toBe(false);
    expect(canViewProfiles(null)).toBe(false);
  });
});
