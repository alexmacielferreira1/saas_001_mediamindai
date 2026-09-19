import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  MOCK_PROJECTS, MOCK_ASSETS, MOCK_TASKS, MOCK_SCRIPTS,
  MOCK_SAVED_SEARCHES, MOCK_RECENT_ACTIVITY, MOCK_LIBRARIES,
  MOCK_INGEST_PACKAGES, MOCK_CLIPS,
} from '../data';

// ============================================================================
// Loader do MAM (MediaMind AI original — Home / Search).
// Carrega cada entidade da Base44; se a entidade estiver vazia, semeia a partir
// do mock correspondente (bulkCreate) e devolve os registros criados (com ids
// reais). O contrato dos campos é idêntico ao mock, então as telas não mudam.
// Os mocks continuam em data.js para as demais telas (Acervo, Ingest,
// Workspace, Management...) que ainda não foram migradas.
// ============================================================================

async function loadOrSeed(entityName, mockRows) {
  try {
    const list = await base44.entities[entityName].list('-created_date', 200);
    if (list && list.length) return list;
  } catch {
    return [];
  }
  const seed = mockRows.map(({ id, ...rest }) => rest);
  if (!seed.length) return [];
  try {
    const created = await base44.entities[entityName].bulkCreate(seed);
    return created || [];
  } catch {
    return [];
  }
}

export function useMamData() {
  const [data, setData] = useState({
    projects: [], assets: [], tasks: [], scripts: [],
    savedSearches: [], recentActivity: [], libraries: [],
    ingestPackages: [], clips: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadOrSeed('Project', MOCK_PROJECTS),
      loadOrSeed('Asset', MOCK_ASSETS),
      loadOrSeed('Task', MOCK_TASKS),
      loadOrSeed('Script', MOCK_SCRIPTS),
      loadOrSeed('SavedSearch', MOCK_SAVED_SEARCHES),
      loadOrSeed('RecentActivity', MOCK_RECENT_ACTIVITY),
      loadOrSeed('Library', MOCK_LIBRARIES),
      loadOrSeed('IngestPackage', MOCK_INGEST_PACKAGES),
      loadOrSeed('Clip', MOCK_CLIPS),
    ])
      .then(([projects, assets, tasks, scripts, savedSearches, recentActivity, libraries, ingestPackages, clips]) => {
        if (!alive) return;
        setData({ projects, assets, tasks, scripts, savedSearches, recentActivity, libraries, ingestPackages, clips });
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { ...data, loading };
}