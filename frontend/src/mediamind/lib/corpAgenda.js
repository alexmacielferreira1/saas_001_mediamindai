import { base44 } from '@/api/base44Client';
import { markDemoRecords } from './demoCatalog';

// Carrega os eventos da agenda persistente. Se ainda não existirem registros na
// entidade AgendaEvento, devolve o fallback (mock) marcado como demonstração,
// sem gravá-lo no banco da empresa. Centraliza a carga da agenda da Visão Geral
// da Produção.
export async function loadOrSeedAgenda(fallback) {
  try {
    const existing = await base44.entities.AgendaEvento.list('ordem', 200);
    if (existing.length > 0) return existing;
  } catch { /* exibe o exemplo abaixo */ }
  return markDemoRecords(fallback);
}