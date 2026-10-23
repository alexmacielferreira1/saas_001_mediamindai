import { base44 } from '@/api/base44Client';
import { markDemoRecords } from './demoCatalog';

// Carrega as pendências persistentes de um segmento. Centraliza a carga entre
// PendenciasHub e o launcher de Prompt.
function normalizeSegment(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+de\s+imprensa$/, '')
    .replace(/\s+/g, '_');
}

// Sem registros, o fallback (mock) é exibido como demonstração e não é gravado.
export async function loadOrSeedPendencias(segmento, fallback) {
  const seg = normalizeSegment(segmento);
  try {
    const existing = await base44.entities.PendenciaCorp.filter({ segmento: seg }, 'ordem', 200);
    if (existing.length > 0) return existing;
  } catch { /* exibe o exemplo abaixo */ }
  return markDemoRecords(fallback);
}