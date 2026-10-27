import { request } from './httpClient';

// Ingest pela pasta de referência do servidor (backend/app/api/v1/ingest.py): a entrada fica em
// INGEST_SOURCE_ROOT/<empresa>/ e cada arquivo é copiado para o destino (MEDIA_ROOT).

export function getIngestSource() {
  return request('/ingest/source');
}

export async function listIngestPackages() {
  return (await request('/ingest/packages')).packages;
}

export function createIngestPackage(payload) {
  return request('/ingest/packages', { method: 'POST', body: payload });
}

export function importNextIngestFile(packageId) {
  return request(`/ingest/packages/${encodeURIComponent(packageId)}/import-next`, { method: 'POST' });
}

export function retryIngestPackage(packageId) {
  return request(`/ingest/packages/${encodeURIComponent(packageId)}/retry`, { method: 'POST' });
}

const hasPending = (pkg) => (pkg?.items || []).some((item) => item.status === 'pending');

/**
 * Importa os arquivos pendentes um a um (cada chamada copia um arquivo) e avisa a cada passo.
 * Para quando não há mais pendentes; um arquivo "importing" de outra aba não prende o laço.
 */
export async function runIngestPackage(pkg, { onUpdate } = {}) {
  let current = pkg;
  while (current.status === 'processing' && hasPending(current)) {
    current = await importNextIngestFile(current.id);
    onUpdate?.(current);
  }
  return current;
}
