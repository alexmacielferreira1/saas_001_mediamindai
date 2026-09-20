import { request } from './httpClient';

export async function listMemberships() {
  const payload = await request('/memberships');
  return payload.memberships;
}

export async function listPermissionGroups() {
  const payload = await request('/permission-groups');
  return payload.permission_groups;
}

export function assignPermissionGroup(membershipId, permissionGroupId) {
  return request(`/memberships/${membershipId}/permission-group`, {
    method: 'PUT',
    body: { permission_group_id: permissionGroupId },
  });
}

export function updateMembershipRole(membershipId, role) {
  return request(`/memberships/${membershipId}/role`, {
    method: 'PUT',
    body: { role },
  });
}
