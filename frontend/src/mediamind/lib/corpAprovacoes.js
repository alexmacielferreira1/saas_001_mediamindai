import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { MOCK_CORP_APPROVAL_QUEUE } from '../data';
import { setEtapa } from './producaoStore';
import { markDemoRecords } from './demoCatalog';

// Carrega a fila central de aprovações persistente. Se ainda não existirem
// registros na entidade AprovacaoItem, devolve o fallback (mock) marcado como
// demonstração, sem gravá-lo no banco da empresa. Centraliza a carga entre a
// fila do CoordenadorComunicacaoPage e o Início de
// coordenador_comunicacao/qualidade (via roleInicioData).
// Lança em caso de falha irrecuperável — o hook chamador trata o erro.
export async function loadOrSeedAprovacoes(fallback = MOCK_CORP_APPROVAL_QUEUE) {
  const existing = await base44.entities.AprovacaoItem.list('ordem', 200);
  if (existing.length > 0) return existing;
  return markDemoRecords((fallback || []).map((a) => ({ ...a, prioridade: a.prioridade || 'media', status: 'pendente' })));
}

// Hook reativo: renderiza o mock no primeiro frame (sem flash de layout) e
// substitui pelos registros da entidade assim que a carga termina. Expõe
// `error` + `reload` para tratamento de erro consistente, e assina mudanças
// em tempo real na entidade AprovacaoItem — decisões tomadas em outros
// painéis (ex.: RoleInicio) refletem aqui imediatamente.
export function useAprovacoes() {
  const [items, setItems] = useState(MOCK_CORP_APPROVAL_QUEUE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadOrSeedAprovacoes();
      setItems(loaded.length > 0 ? loaded : MOCK_CORP_APPROVAL_QUEUE);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadOrSeedAprovacoes()
      .then((loaded) => {
        if (!alive) return;
        setItems(loaded.length > 0 ? loaded : MOCK_CORP_APPROVAL_QUEUE);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });

    // Realtime: decisões tomadas em outros painéis (ex.: RoleInicio) chegam
    // como eventos e são aplicadas como patch local — sem refetch, sem
    // atraso e sem mudança brusca de layout na fila.
    const unsub = base44.entities.AprovacaoItem.subscribe((event) => {
      setItems((prev) => {
        if (event.type === 'create') return [event.data, ...prev];
        if (event.type === 'update') return prev.map((it) => (it.id === event.data.id ? event.data : it));
        if (event.type === 'delete') return prev.filter((it) => it.id !== event.id);
        return prev;
      });
    });
    return () => { alive = false; if (unsub) unsub(); };
  }, [reload]);

  return { items, loading, error, reload };
}

// Aprova/reprova um item da fila. Persiste a decisão na entidade AprovacaoItem
// e, ao aprovar uma edição/arte vinculada a um ProducaoProjeto em aprovação,
// empurra o projeto correspondente de "em_aprovacao" para "finalizado"
// (avanço de pipeline gravado no historico do producaoStore).
// `projetos` é a lista viva do producaoStore (useProducaoProjetos).
// Retorna o item atualizado ou null em caso de falha (o chamador pode reverter
// o estado otimista e sinalizar o erro).
export async function decidirAprovacao(id, decisao, { projetos = [] } = {}) {
  try {
    const item = await base44.entities.AprovacaoItem.update(String(id), { status: decisao });
    if (decisao === 'aprovado' && (item.tipo === 'Edição' || item.tipo === 'Arte')) {
      const alvo = projetos.find((p) => p.etapa === 'em_aprovacao' && p.titulo === item.titulo);
      if (alvo) setEtapa(alvo.id, 'finalizado');
    }
    return item;
  } catch {
    return null;
  }
}