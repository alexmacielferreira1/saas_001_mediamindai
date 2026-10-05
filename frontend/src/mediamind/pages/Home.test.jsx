import { describe, expect, it } from 'vitest';

import { canViewProfiles, resolveDashboardState } from './Home';

describe('profiles access from home', () => {
  it('is visible only to superadmins', () => {
    expect(canViewProfiles({ role: 'superadmin' })).toBe(true);
    expect(canViewProfiles({ role: 'admin' })).toBe(false);
    expect(canViewProfiles({ role: 'editor' })).toBe(false);
    expect(canViewProfiles(null)).toBe(false);
  });
});

describe('dashboard data origin', () => {
  it('uses only KPIs returned by the real dashboard', () => {
    expect(resolveDashboardState({ kpis: [{ id: 'real', label: 'Real', value: 7 }] }, null, false)).toEqual({
      source: 'REAL',
      kpis: [{ id: 'real', label: 'Real', value: 7 }],
    });
  });

  it('keeps an empty real dashboard empty', () => {
    expect(resolveDashboardState({ kpis: [] }, null, false)).toEqual({ source: 'VAZIO', kpis: [] });
  });

  it('never substitutes local counts after a request failure', () => {
    expect(resolveDashboardState(null, new Error('offline'), false)).toEqual({ source: 'INDISPONIVEL', kpis: [] });
  });

  it('allows local counts only in an explicit demo session', () => {
    expect(resolveDashboardState(null, null, true, [{ id: 'demo', label: 'Demo', value: 1 }])).toEqual({
      source: 'DEMONSTRACAO',
      kpis: [{ id: 'demo', label: 'Demo', value: 1 }],
    });
  });
});
