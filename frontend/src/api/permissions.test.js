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
});
