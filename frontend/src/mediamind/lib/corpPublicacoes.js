import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { MOCK_CORP_PUBLICATIONS } from '../data';
import { markDemoRecords } from './demoCatalog';

// Carrega as publicações persistentes. Se ainda não existirem registros na
// entidade Publicacao, devolve o fallback (mock) normalizado para o schema PT
// (titulo/plataforma/status/views) e marcado como demonstração, sem gravá-lo
// no banco da empresa. Centraliza a carga entre CorpPublications,
// SocialMediaPage, TradutorPage, ProgramacaoPage e o AgendaUnificadaPanel.
// Lança em caso de falha irrecuperável — o hook chamador trata o erro.
export async function loadOrSeedPublicacoes(fallback = MOCK_CORP_PUBLICATIONS) {
  const existing = await base44.entities.Publicacao.list('ordem', 200);
  if (existing.length > 0) return existing;
  return markDemoRecords(
    (fallback || []).map((p, i) => ({
      id: p.id,
      titulo: p.titulo || p.title || '',
      descricao: p.descricao || '',
      plataforma: p.plataforma || p.platform || 'youtube',
      status: p.status || 'rascunho',
      duracao: p.duracao || '',
      views: p.views != null ? String(p.views) : '',
      likes: Number(p.likes) || 0,
      clip_id: p.clip_id != null ? Number(p.clip_id) : null,
      published_at: p.published_at || '',
      ordem: i,
    }))
  );
}

// Hook reativo: renderiza o mock no primeiro frame (sem flash de layout) e
// substitui pelos registros da entidade assim que a carga termina. Expõe
// `error` + `reload` para tratamento de erro consistente.
export function usePublicacoes() {
  const [pubs, setPubs] = useState(MOCK_CORP_PUBLICATIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadOrSeedPublicacoes();
      setPubs(loaded.length > 0 ? loaded : MOCK_CORP_PUBLICATIONS);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadOrSeedPublicacoes()
      .then((loaded) => {
        if (!alive) return;
        setPubs(loaded.length > 0 ? loaded : MOCK_CORP_PUBLICATIONS);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { pubs, loading, error, reload };
}