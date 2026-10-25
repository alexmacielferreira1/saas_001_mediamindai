import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { lists } = vi.hoisted(() => ({ lists: { calls: [] } }));
vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: new Proxy({}, {
      get: (_target, name) => ({
        list: (...args) => {
          lists.calls.push(name);
          return lists[name] ? lists[name](...args) : Promise.resolve([]);
        },
      }),
    }),
  },
}));

import { loadMamData, useMamData } from './mamData';
import { isDemoRecord } from './demoCatalog';

// Entidades aceitas por backend/app/api/v1/records.py (ALLOWED_TYPES).
const SERVER_ENTITIES = new Set(['AgendaEvento', 'AprovacaoItem', 'AprovacaoVersao', 'Asset', 'BriefingProducao', 'Clip', 'ClipCandidate', 'ClipVersion', 'Clipping', 'ComentarioRevisao', 'CreativeDocument', 'CreativeExport', 'DireitoAsset', 'Jornalista', 'LogAuditoria', 'Mencao', 'PendenciaCorp', 'ProcessamentoJob', 'ProducaoProjeto', 'Person', 'Publicacao', 'Release', 'Script', 'ScriptTemplate', 'TranscricaoSegmento']);

describe('MAM (Início/Pesquisa) com fontes reais', () => {
  beforeEach(() => {
    for (const key of Object.keys(lists)) delete lists[key];
    lists.calls = [];
    localStorage.removeItem('mm_demo_session_v1');
  });
  afterEach(() => localStorage.removeItem('mm_demo_session_v1'));

  it('só pede entidades que existem no servidor (sem 404)', async () => {
    await loadMamData();
    expect(lists.calls.length).toBeGreaterThan(0);
    for (const name of lists.calls) expect(SERVER_ENTITIES.has(name)).toBe(true);
    for (const missing of ['Project', 'Task', 'SavedSearch', 'RecentActivity', 'Library', 'IngestPackage']) {
      expect(lists.calls).not.toContain(missing);
    }
  });

  it('empresa vazia continua vazia: nada de exemplo fora da sessão demo', async () => {
    const { data, error } = await loadMamData();
    expect(error).toBe('');
    expect(Object.values(data).every((rows) => rows.length === 0)).toBe(true);
  });

  it('usa produções e pendências reais como projetos e tarefas', async () => {
    lists.ProducaoProjeto = () => Promise.resolve([{ id: 'p1', titulo: 'Episódio 4', etapa: 'em_edicao', materiais: [{}, {}] }, { id: 'p2', titulo: 'Fechado', etapa: 'finalizado' }]);
    lists.PendenciaCorp = () => Promise.resolve([{ id: 't1', titulo: 'Revisar GC', status: 'em_andamento', segmento: 'Produção' }]);
    const { data } = await loadMamData();
    expect(data.projects).toEqual([
      expect.objectContaining({ id: 'p1', name: 'Episódio 4', status: 'active', asset_count: 2 }),
      expect.objectContaining({ id: 'p2', status: 'completed' }),
    ]);
    expect(data.tasks).toEqual([expect.objectContaining({ id: 't1', title: 'Revisar GC', status: 'in_progress', project_name: 'Produção' })]);
  });

  it('falha de uma fonte vira erro visível e não troca por mock', async () => {
    lists.Asset = () => Promise.reject(new Error('Servidor fora'));
    lists.Script = () => Promise.resolve([{ id: 's1', title: 'Roteiro real' }]);
    const { data, error } = await loadMamData();
    expect(error).toBe('Servidor fora');
    expect(data.assets).toEqual([]);
    expect(data.scripts).toEqual([{ id: 's1', title: 'Roteiro real' }]);
  });

  it('sessão demo mostra exemplos marcados sem chamar a API', async () => {
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({ id: 'demo' }));
    const { result } = renderHook(() => useMamData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.assets.length).toBeGreaterThan(0);
    expect(isDemoRecord(result.current.assets[0])).toBe(true);
    expect(lists.calls).toEqual([]);
  });

  it('expõe o erro e permite tentar de novo', async () => {
    let fail = true;
    lists.Asset = () => (fail ? Promise.reject(new Error('offline')) : Promise.resolve([{ id: 'a1' }]));
    const { result } = renderHook(() => useMamData());
    await waitFor(() => expect(result.current.error).toBe('offline'));
    fail = false;
    result.current.retry();
    await waitFor(() => expect(result.current.assets).toEqual([{ id: 'a1' }]));
    expect(result.current.error).toBe('');
  });
});
