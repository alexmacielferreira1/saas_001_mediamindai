import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();

vi.mock('./httpClient', () => ({
  request: (...args) => requestMock(...args),
}));

import {
  assignPermissionGroup,
  listMemberships,
  listPermissionGroups,
  updateMembershipRole,
  updateMembershipScreens,
} from './permissions';

describe('permission administration API', () => {
  beforeEach(() => requestMock.mockReset());

  it('loads memberships and permission groups from the selected server tenant', async () => {
    requestMock
      .mockResolvedValueOnce({ memberships: [{ id: 'membership-1' }] })
      .mockResolvedValueOnce({ permission_groups: [{ id: 'group-1' }] });

    await expect(listMemberships()).resolves.toEqual([{ id: 'membership-1' }]);
    await expect(listPermissionGroups()).resolves.toEqual([{ id: 'group-1' }]);
    expect(requestMock).toHaveBeenNthCalledWith(1, '/memberships');
    expect(requestMock).toHaveBeenNthCalledWith(2, '/permission-groups');
  });

  it('assigns and removes a group through the membership endpoint', async () => {
    requestMock.mockResolvedValue({
      membership_id: 'membership-1',
      permission_group_id: 'group-1',
    });

    await assignPermissionGroup('membership-1', 'group-1');
    await assignPermissionGroup('membership-1', null);

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      '/memberships/membership-1/permission-group',
      { method: 'PUT', body: { permission_group_id: 'group-1' } },
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      '/memberships/membership-1/permission-group',
      { method: 'PUT', body: { permission_group_id: null } },
    );
  });

  it('updates the role on the tenant membership rather than the global user', async () => {
    requestMock.mockResolvedValue({ membership_id: 'membership-1', role: 'editor' });

    await updateMembershipRole('membership-1', 'editor');

    expect(requestMock).toHaveBeenCalledWith('/memberships/membership-1/role', {
      method: 'PUT',
      body: { role: 'editor' },
    });
  });

  it('persists individual screen overrides on the tenant membership', async () => {
    requestMock.mockResolvedValue({ membership_id: 'membership-1' });
    await updateMembershipScreens('membership-1', ['cedoc'], ['producao']);
    expect(requestMock).toHaveBeenCalledWith('/memberships/membership-1/screens', {
      method: 'PUT',
      body: { extra_screens: ['cedoc'], restricted_screens: ['producao'] },
    });
  });

  it('forwards an optional trimmed reason and omits it when blank', async () => {
    requestMock.mockResolvedValue({});
    await updateMembershipRole('m-1', 'editor', { reason: '  Troca de equipe  ' });
    await updateMembershipScreens('m-1', [], ['assessoria'], { reason: 'Saiu da assessoria' });
    await assignPermissionGroup('m-1', 'g-1', { reason: 'Novo perfil' });
    await updateMembershipRole('m-1', 'editor', { reason: '   ' });

    expect(requestMock).toHaveBeenNthCalledWith(1, '/memberships/m-1/role', {
      method: 'PUT', body: { role: 'editor', reason: 'Troca de equipe' },
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, '/memberships/m-1/screens', {
      method: 'PUT', body: { extra_screens: [], restricted_screens: ['assessoria'], reason: 'Saiu da assessoria' },
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, '/memberships/m-1/permission-group', {
      method: 'PUT', body: { permission_group_id: 'g-1', reason: 'Novo perfil' },
    });
    expect(requestMock).toHaveBeenNthCalledWith(4, '/memberships/m-1/role', {
      method: 'PUT', body: { role: 'editor' },
    });
  });
});
