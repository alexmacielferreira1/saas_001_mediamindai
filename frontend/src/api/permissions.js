import { request } from './httpClient';

// Motivo opcional das mudanças de acesso (vai para a auditoria do servidor, máx. 300).
function withReason(body, reason) {
  const text = typeof reason === 'string' ? reason.trim() : '';
  return text ? { ...body, reason: text } : body;
}

export async function listMemberships() {
  const payload = await request('/memberships');
  return payload.memberships;
}

export async function listPermissionGroups() {
  const payload = await request('/permission-groups');
  return payload.permission_groups;
}

export function assignPermissionGroup(membershipId, permissionGroupId, { reason } = {}) {
  return request(`/memberships/${membershipId}/permission-group`, {
    method: 'PUT',
    body: withReason({ permission_group_id: permissionGroupId }, reason),
  });
}

export function updateMembershipRole(membershipId, role, { reason } = {}) {
  return request(`/memberships/${membershipId}/role`, {
    method: 'PUT',
    body: withReason({ role }, reason),
  });
}

export function updateMembershipScreens(membershipId, extraScreens, restrictedScreens, { reason } = {}) {
  return request(`/memberships/${membershipId}/screens`, {
    method: 'PUT',
    body: withReason({ extra_screens: extraScreens, restricted_screens: restrictedScreens }, reason),
  });
}
