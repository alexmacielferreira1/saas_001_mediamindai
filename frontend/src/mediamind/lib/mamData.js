import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  MOCK_PROJECTS, MOCK_ASSETS, MOCK_TASKS, MOCK_SCRIPTS,
  MOCK_SAVED_SEARCHES, MOCK_RECENT_ACTIVITY, MOCK_LIBRARIES,
  MOCK_INGEST_PACKAGES, MOCK_CLIPS,
} from '../data';
import { markDemoRecords } from './demoCatalog';
import { readLocalDemoSession } from './demoAccess';

// ============================================================================
// Loader do MAM (Home / Search).
// Só pede ao servidor entidades que existem na API de registros
// (backend/app/api/v1/records.py → ALLOWED_TYPES). Projetos e tarefas vêm de
// ProducaoProjeto e PendenciaCorp; pesquisas salvas, atividade recente,
// bibliotecas e pacotes de ingest ainda não têm fonte no servidor e ficam vazios.
// Dados de exemplo só aparecem na sessão de demonstração local; numa empresa
// real, lista vazia continua vazia e falha vira erro visível (sem mock).
// ============================================================================

const EMPTY = {
  projects: [], assets: [], tasks: [], scripts: [],
  savedSearches: [], recentActivity: [], libraries: [],
  ingestPackages: [], clips: [],
};

const DONE_STAGES = new Set(['finalizado', 'publicado', 'arquivado']);
const TASK_STATUS = { pendente: 'not_started', em_andamento: 'in_progress', concluido: 'approved', concluida: 'approved' };

export function projectFromProducao(record) {
  return {
    id: record.id,
    name: record.titulo || 'Produção sem título',
    status: DONE_STAGES.has(record.etapa) ? 'completed' : 'active',
    asset_count: (record.materiais || []).length,
    created_at: record.created_date || '',
  };
}

export function taskFromPendencia(record) {
  return {
    id: record.id,
    title: record.titulo || 'Pendência',
    status: TASK_STATUS[record.status] || 'not_started',
    project_name: record.segmento || '',
    assigned_to: record.responsavel || '',
  };
}

export function demoMamData() {
  return {
    projects: markDemoRecords(MOCK_PROJECTS),
    assets: markDemoRecords(MOCK_ASSETS),
    tasks: markDemoRecords(MOCK_TASKS),
    scripts: markDemoRecords(MOCK_SCRIPTS),
    savedSearches: markDemoRecords(MOCK_SAVED_SEARCHES),
    recentActivity: markDemoRecords(MOCK_RECENT_ACTIVITY),
    libraries: markDemoRecords(MOCK_LIBRARIES),
    ingestPackages: markDemoRecords(MOCK_INGEST_PACKAGES),
    clips: markDemoRecords(MOCK_CLIPS),
  };
}

const list = (entity) => base44.entities[entity].list('-created_date', 200);

// Carga real: cada entidade falha sozinha (as outras continuam visíveis) e o
// erro é devolvido para a tela avisar o usuário.
export async function loadMamData() {
  const sources = [
    ['projects', () => list('ProducaoProjeto').then((rows) => rows.map(projectFromProducao))],
    ['assets', () => list('Asset')],
    ['tasks', () => list('PendenciaCorp').then((rows) => rows.map(taskFromPendencia))],
    ['scripts', () => list('Script')],
    ['clips', () => list('Clip')],
  ];
  const results = await Promise.allSettled(sources.map(([, load]) => load()));
  const data = { ...EMPTY };
  const failed = [];
  results.forEach((result, index) => {
    const [key] = sources[index];
    if (result.status === 'fulfilled') data[key] = result.value || [];
    else failed.push(result.reason);
  });
  const error = failed.length
    ? (failed[0]?.message || 'Não foi possível carregar parte dos dados.')
    : '';
  return { data, error };
}

export function useMamData() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (readLocalDemoSession()) {
      setData(demoMamData());
      setError('');
      setLoading(false);
      return () => { alive = false; };
    }
    loadMamData()
      .then((result) => {
        if (!alive) return;
        setData(result.data);
        setError(result.error);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [attempt]);

  return { ...data, loading, error, retry: () => setAttempt((value) => value + 1) };
}
