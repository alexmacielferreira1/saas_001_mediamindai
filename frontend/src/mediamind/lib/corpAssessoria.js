import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  MOCK_CORP_RELEASES, MOCK_CORP_CLIPPINGS, MOCK_CORP_JOURNALISTS, MOCK_CORP_MENTIONS,
} from '../data';

// Assessoria de Imprensa — 4 entidades separadas, cada uma com seu loader
// load/seed (mesmo padrão de corpAgenda/corpPendencias). O mock preenche o
// primeiro render (sem flash) e é substituído pela entidade ao carregar.
// Os loaders lançam em caso de falha irrecuperável; os hooks tratam o erro.

export async function loadOrSeedReleases(fallback = MOCK_CORP_RELEASES) {
  const existing = await base44.entities.Release.list('ordem', 200);
  if (existing.length > 0) return existing;
  if (!fallback || !fallback.length) return [];
  return await base44.entities.Release.bulkCreate(
    fallback.map((r, i) => ({
      titulo: r.titulo || '', status: r.status || 'rascunho',
      veiculos: Number(r.veiculos) || 0, data: r.data || '', ordem: i,
    }))
  );
}

export async function loadOrSeedClippings(fallback = MOCK_CORP_CLIPPINGS) {
  const existing = await base44.entities.Clipping.list('ordem', 200);
  if (existing.length > 0) return existing;
  if (!fallback || !fallback.length) return [];
  return await base44.entities.Clipping.bulkCreate(
    fallback.map((c, i) => ({
      veiculo: c.veiculo || '', titulo: c.titulo || '', tom: c.tom || 'neutro',
      data: c.data || '', ordem: i,
    }))
  );
}

export async function loadOrSeedJornalistas(fallback = MOCK_CORP_JOURNALISTS) {
  const existing = await base44.entities.Jornalista.list('ordem', 200);
  if (existing.length > 0) return existing;
  if (!fallback || !fallback.length) return [];
  return await base44.entities.Jornalista.bulkCreate(
    fallback.map((j, i) => ({
      nome: j.nome || '', veiculo: j.veiculo || '', area: j.area || '', ordem: i,
    }))
  );
}

export async function loadOrSeedMencoes(fallback = MOCK_CORP_MENTIONS) {
  const existing = await base44.entities.Mencao.list('ordem', 200);
  if (existing.length > 0) return existing;
  if (!fallback || !fallback.length) return [];
  return await base44.entities.Mencao.bulkCreate(
    fallback.map((m, i) => ({
      veiculo: m.veiculo || '', titulo: m.titulo || '', tom: m.tom || 'neutro',
      data: m.data || '', etapa: m.etapa || 'monitorada', ordem: i,
    }))
  );
}

// Hook único que carrega as 4 listas da Assessoria de uma vez. Expõe
// `error` + `reload` para tratamento de erro consistente.
export function useAssessoria() {
  const [data, setData] = useState({
    releases: MOCK_CORP_RELEASES,
    clippings: MOCK_CORP_CLIPPINGS,
    jornalistas: MOCK_CORP_JOURNALISTS,
    mencoes: MOCK_CORP_MENTIONS,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [releases, clippings, jornalistas, mencoes] = await Promise.all([
        loadOrSeedReleases(),
        loadOrSeedClippings(),
        loadOrSeedJornalistas(),
        loadOrSeedMencoes(),
      ]);
      setData((d) => ({
        releases: releases.length > 0 ? releases : d.releases,
        clippings: clippings.length > 0 ? clippings : d.clippings,
        jornalistas: jornalistas.length > 0 ? jornalistas : d.jornalistas,
        mencoes: mencoes.length > 0 ? mencoes : d.mencoes,
      }));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadOrSeedReleases(),
      loadOrSeedClippings(),
      loadOrSeedJornalistas(),
      loadOrSeedMencoes(),
    ])
      .then(([releases, clippings, jornalistas, mencoes]) => {
        if (!alive) return;
        setData((d) => ({
          releases: releases.length > 0 ? releases : d.releases,
          clippings: clippings.length > 0 ? clippings : d.clippings,
          jornalistas: jornalistas.length > 0 ? jornalistas : d.jornalistas,
          mencoes: mencoes.length > 0 ? mencoes : d.mencoes,
        }));
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { ...data, loading, error, reload };
}

// Hook isolado só para releases — usado pelo roleInicioData (assessoria/juridico).
export function useReleases() {
  const [releases, setReleases] = useState(MOCK_CORP_RELEASES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadOrSeedReleases();
      setReleases(loaded.length > 0 ? loaded : MOCK_CORP_RELEASES);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadOrSeedReleases()
      .then((loaded) => {
        if (!alive) return;
        setReleases(loaded.length > 0 ? loaded : MOCK_CORP_RELEASES);
      })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { releases, loading, error, reload };
}