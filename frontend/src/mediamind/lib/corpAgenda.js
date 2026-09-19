import { base44 } from '@/api/base44Client';

// Carrega os eventos da agenda persistente. Se ainda não existirem registros na
// entidade AgendaEvento, semeia a partir do fallback (mock) e retorna os
// registros criados. Centraliza a carga da agenda da Visão Geral da Produção.
export async function loadOrSeedAgenda(fallback) {
  try {
    const existing = await base44.entities.AgendaEvento.list('ordem', 200);
    if (existing.length > 0) return existing;
    if (!fallback || fallback.length === 0) return [];
    const created = await base44.entities.AgendaEvento.bulkCreate(
      fallback.map((e, i) => ({
        titulo: e.titulo || '',
        programa: e.programa || '',
        episodio: e.episodio || '',
        type: e.type || 'gravacao',
        day: e.day ?? 0,
        horario: e.horario || '',
        duracao_prevista: e.duracao_prevista || '',
        estudio: e.estudio || '',
        convidado: e.convidado || '',
        convidado_cg: e.convidado_cg || '',
        equipe: e.equipe || '',
        equipamentos: e.equipamentos || '',
        status: e.status || '',
        pauta: e.pauta || '',
        descricao: e.descricao || '',
        tone: e.tone || '',
        thumb: e.thumb || '',
        ordem: i,
      }))
    );
    return created;
  } catch {
    return fallback || [];
  }
}