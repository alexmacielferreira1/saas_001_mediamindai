import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  MOCK_CORP_RELEASES, MOCK_CORP_CLIPPINGS, MOCK_CORP_JOURNALISTS, MOCK_CORP_MENTIONS,
} from '../data';
import { isAccessDenied } from './accessErrors';
import { markDemoRecords } from './demoCatalog';

// Assessoria de Imprensa — 4 entidades separadas, cada uma com seu loader
// (mesmo padrão de corpAgenda/corpPendencias). O mock preenche o primeiro
// render (sem flash) e é substituído pela entidade ao carregar; com a entidade
// vazia, o mock fica como demonstração e nunca é gravado no banco da empresa.
// Os loaders lançam em caso de falha irrecuperável; os hooks tratam o erro.

export async function loadOrSeedReleases(fallback = MOCK_CORP_RELEASES) {
  const existing = await base44.entities.Release.list('ordem', 200);
  if (existing.length > 0) return existing;
  return markDemoRecords(
    (fallback || []).map((r, i) => ({
      id: r.id,
      titulo: r.titulo || '', status: r.status || 'rascunho',
      veiculos: Number(r.veiculos) || 0, data: r.data || '', ordem: i,
    }))
  );
}

export async function loadOrSeedClippings(fallback = MOCK_CORP_CLIPPINGS) {
  const existing = await base44.entities.Clipping.list('ordem', 200);
  if (existing.length > 0) return existing;
  return markDemoRecords(
    (fallback || []).map((c, i) => ({
      id: c.id,
      veiculo: c.veiculo || '', titulo: c.titulo || '', tom: c.tom || 'neutro',
      data: c.data || '', ordem: i,
    }))
  );
}

export async function loadOrSeedJornalistas(fallback = MOCK_CORP_JOURNALISTS) {
  const existing = await base44.entities.Jornalista.list('ordem', 200);
  if (existing.length > 0) return existing;
  return markDemoRecords(
    (fallback || []).map((j, i) => ({
      id: j.id,
      nome: j.nome || '', veiculo: j.veiculo || '', area: j.area || '', ordem: i,
    }))
  );
}

export async function loadOrSeedMencoes(fallback = MOCK_CORP_MENTIONS) {
  const existing = await base44.entities.Mencao.list('ordem', 200);
  if (existing.length > 0) return existing;
  return markDemoRecords(
    (fallback || []).map((m, i) => ({
      id: m.id,
      veiculo: m.veiculo || '', titulo: m.titulo || '', tom: m.tom || 'neutro',
      data: m.data || '', etapa: m.etapa || 'monitorada', ordem: i,
    }))
  );
}

const EMPTY_ASSESSORIA = { releases: [], clippings: [], jornalistas: [], mencoes: [] };

function loadAllAssessoria() {
  return Promise.all([
    loadOrSeedReleases(),
    loadOrSeedClippings(),
    loadOrSeedJornalistas(),
    loadOrSeedMencoes(),
  ]);
}

function mergeLoaded([releases, clippings, jornalistas, mencoes]) {
  return (d) => ({
    releases: releases.length > 0 ? releases : d.releases,
    clippings: clippings.length > 0 ? clippings : d.clippings,
    jornalistas: jornalistas.length > 0 ? jornalistas : d.jornalistas,
    mencoes: mencoes.length > 0 ? mencoes : d.mencoes,
  });
}

// Hook único que carrega as 4 listas da Assessoria de uma vez. Expõe
// error + reload para tratamento de erro consistente. Em 403 (tela
// restrita pelo gestor) expõe forbidden e esvazia as listas: nada de
// dados de demonstração no lugar da recusa do servidor.
export function useAssessoria() {
  const [data, setData] = useState({
    releases: MOCK_CORP_RELEASES,
    clippings: MOCK_CORP_CLIPPINGS,
    jornalistas: MOCK_CORP_JOURNALISTS,
    mencoes: MOCK_CORP_MENTIONS,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  const fail = useCallback((e) => {
    if (isAccessDenied(e)) {
      setForbidden(true);
      setData(EMPTY_ASSESSORIA);
    }
    setError(e);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadAllAssessoria();
      setForbidden(false);
      setData(mergeLoaded(loaded));
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [fail]);

  useEffect(() => {
    let alive = true;
    loadAllAssessoria()
      .then((loaded) => { if (alive) setData(mergeLoaded(loaded)); })
      .catch((e) => { if (alive) fail(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fail]);

  return { ...data, loading, error, forbidden, reload };
}

// Hook isolado só para releases. Em 403 devolve lista vazia + forbidden.
export function useReleases() {
  const [releases, setReleases] = useState(MOCK_CORP_RELEASES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  const fail = useCallback((e) => {
    if (isAccessDenied(e)) {
      setForbidden(true);
      setReleases([]);
    }
    setError(e);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadOrSeedReleases();
      setForbidden(false);
      setReleases(loaded.length > 0 ? loaded : MOCK_CORP_RELEASES);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [fail]);

  useEffect(() => {
    let alive = true;
    loadOrSeedReleases()
      .then((loaded) => {
        if (!alive) return;
        setReleases(loaded.length > 0 ? loaded : MOCK_CORP_RELEASES);
      })
      .catch((e) => { if (alive) fail(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fail]);

  return { releases, loading, error, forbidden, reload };
}
