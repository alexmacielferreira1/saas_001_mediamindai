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

// Envia a revisão que o revisor viu: se o documento mudou nesse meio-tempo o
// servidor responde 409 CREATIVE_REVISION_CONFLICT em vez de aprovar outra versão.
export function approveCreativeDocument(id, revision) {
  const options = { method: 'POST' };
  if (Number.isInteger(revision) && revision > 0) options.body = { revision };
  return request(`/creative-documents/${encodeURIComponent(id)}/approve`, options);
}

export function creativeErrorMessage(error, fallback) {
  if (error?.code === 'CREATIVE_REVISION_CONFLICT') return 'O documento mudou desde que você o abriu (outra pessoa salvou uma nova revisão). Recarregue e revise a versão atual antes de aprovar.';
  if (error?.status === 403) return error.message || 'Seu perfil não pode aprovar: é preciso a permissão de revisão.';
  return error?.message || fallback;
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
