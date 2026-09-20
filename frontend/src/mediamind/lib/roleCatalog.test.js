import { beforeEach, describe, expect, it } from 'vitest';
import { CORP_TABS } from './corpTabs';
import { effectiveTabsForUser, getCargoDefaultTabs } from './roleCatalog';

describe('IAcervo Corp privileged access', () => {
  beforeEach(() => localStorage.clear());

  it('gives the superadmin every Corp screen', () => {
    const ids = CORP_TABS.map((tab) => tab.id);
    expect(effectiveTabsForUser({ id: 'alex', role: 'superadmin' }, ids)).toEqual(ids);
    expect(getCargoDefaultTabs('superadmin')).toBeNull();
  });

  it('does not let stale browser overrides reduce privileged access', () => {
    localStorage.setItem('mm_user_access_v1', JSON.stringify({
      alex: { role: 'editor', extraTabs: [], removedTabs: ['admin_acessos'] },
    }));
    const ids = CORP_TABS.map((tab) => tab.id);
    expect(effectiveTabsForUser({ id: 'alex', role: 'superadmin' }, ids)).toEqual(ids);
    expect(effectiveTabsForUser({ id: 'admin', role: 'admin' }, ids)).toEqual(ids);
  });
});
