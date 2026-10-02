import { request } from './httpClient';

export function listAdminUsers({ search = '', status = '', page = 1, pageSize = 25 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return request(`/admin/users?${params.toString()}`);
}

export function getAdminUser(userId) {
  return request(`/admin/users/${userId}`);
}

export function suspendAdminUser(userId, reason) {
  return request(`/admin/users/${userId}/suspend`, {
    method: 'POST',
    body: { reason },
  });
}

export function getAdminSettings() {
  return request('/admin/settings');
}

export function updateAdminSettings(settings) {
  return request('/admin/settings', { method: 'PATCH', body: settings });
}

export async function listAdminActivity(limit = 8) {
  return (await request(`/records/LogAuditoria?sort=-created_date&limit=${limit}`)).records;
}
