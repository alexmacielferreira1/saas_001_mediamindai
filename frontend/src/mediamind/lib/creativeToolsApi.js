import { request } from '../../api/httpClient';

export async function listCreativeDocuments(toolType = 'carousel') {
  return (await request(`/creative-documents?tool_type=${encodeURIComponent(toolType)}`)).documents;
}

export function createCreativeDocument(payload) {
  return request('/creative-documents', { method: 'POST', body: payload });
}

export function updateCreativeDocument(id, payload) {
  return request(`/creative-documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
}

export function approveCreativeDocument(id) {
  return request(`/creative-documents/${encodeURIComponent(id)}/approve`, { method: 'POST' });
}

export async function uploadCreativeExport(id, revision, preset, blob) {
  const body = new FormData();
  body.set('revision', String(revision));
  body.set('preset', preset);
  body.set('file', blob, 'carrossel.zip');
  return request(`/creative-documents/${encodeURIComponent(id)}/exports`, { method: 'POST', body });
}

export function creativeExportDownloadUrl(id) {
  return `/api/v1/creative-exports/${encodeURIComponent(id)}/download`;
}
