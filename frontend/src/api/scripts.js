import { request } from './httpClient';

export async function listScripts() {
  return (await request('/records/Script?sort=-updated_date&limit=100')).records;
}

export function createScript(data) {
  return request('/records/Script', { method: 'POST', body: { data } });
}

export function updateScript(id, data) {
  return request(`/records/Script/${id}`, { method: 'PATCH', body: { data } });
}
