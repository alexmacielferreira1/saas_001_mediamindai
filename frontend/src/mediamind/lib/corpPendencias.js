import { base44 } from '@/api/base44Client';

// Carrega as pendências persistentes de um segmento. Se ainda não existirem
// registros na entidade PendenciaCorp, semeia a partir do fallback (mock) e
// retorna os registros criados. Centraliza a carga entre PendenciasHub e o
// launcher de Prompt, evitando duplicação.
function normalizeSegment(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+de\s+imprensa$/, '')
    .replace(/\s+/g, '_');
}

export async function loadOrSeedPendencias(segmento, fallback) {
  const seg = normalizeSegment(segmento);
  try {
    const existing = await base44.entities.PendenciaCorp.filter({ segmento: seg }, 'ordem', 200);
    if (existing.length > 0) return existing;
    if (!fallback || fallback.length === 0) return [];
    const toCreate = fallback.map((p, i) => ({
      segmento: seg,
      titulo: p.titulo || '',
      status: p.status || 'pendente',
      responsavel: p.responsavel || '',
      contexto: p.contexto || '',
      ordem: i,
    }));
    const created = await base44.entities.PendenciaCorp.bulkCreate(toCreate);
    return created;
  } catch {
    return fallback || [];
  }
}