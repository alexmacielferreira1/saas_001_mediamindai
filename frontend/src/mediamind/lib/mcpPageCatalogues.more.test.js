import { describe, expect, it, vi } from 'vitest';
import { pageCatalogue } from './mcpPageCatalogues';
import { createPageProvider, downloadFile, localDate, toCsv } from './mcpPageTools';

function fakeEnv(records = {}, overrides = {}) {
  return {
    navigate: vi.fn(),
    ask: vi.fn(),
    download: vi.fn(),
    corpUrl: (sub, extra = '') => `/corp?sub=${sub}${extra ? `&${extra}` : ''}`,
    ingestUrl: (extra) => `/ingest?${extra}`,
    records: vi.fn(async (entity) => records[entity] || []),
    assets: vi.fn(async () => []),
    adminUsers: vi.fn(async () => []),
    auditLogs: vi.fn(async () => []),
    fetchBlob: vi.fn(),
    agencyData: () => ({}),
    ...overrides,
  };
}

const page = (group, env) => createPageProvider({ source: group, label: group, catalogue: pageCatalogue(group, { label: group }), env });

describe('catálogos de etapa e de mídia', () => {
  it('exports clips with real in/out times and creative documents with their real fields', async () => {
    const env = fakeEnv({
      Clip: [{ title: 'Corte 1', in_ms: 1500, out_ms: 9000, duration: 7.5, created_date: '2026-10-01T10:00:00Z' }],
      CreativeDocument: [{ tool_type: 'carousel', content: { title: 'Carrossel LGPD' }, status: 'approved' }],
    });
    await page('clips', env).apply('exportar-cortes', {});
    const [, csv] = env.download.mock.calls[0];
    expect(csv).toContain('Corte 1;1.5;9;7.5;2026-10-01');
    const docs = await page('video', env).apply('documentos-criativos', {});
    expect(docs.details).toEqual(['Carrossel LGPD · carousel · approved']);
    expect((await page('clips', env).apply('cortes', {})).count).toBe(1);
  });

  it('exports publications with platform and publication date', async () => {
    const env = fakeEnv({ Publicacao: [{ titulo: 'Post', plataforma: 'instagram', status: 'publicado', published_at: '2026-10-20T12:00:00Z', created_date: '2026-10-19T12:00:00Z' }] });
    await page('publication', env).apply('exportar-publicacoes', {});
    expect(env.download.mock.calls[0][1]).toContain('Post;instagram;publicado;2026-10-20;2026-10-19');
    expect((await page('publication', env).apply('publicacoes-status', {})).details).toEqual(['publicado: 1']);
  });

  it('checks schedules, editors, approvals, scripts and thumbnails with the fields the screens use', async () => {
    const env = fakeEnv({
      ProducaoProjeto: [
        { titulo: 'Sem horário', etapa: 'agendamentos', gravacao: { data: '2026-11-01' } },
        { titulo: 'Agendada', etapa: 'agendamentos', gravacao: { data: '2026-11-01', horario: '10:00' } },
        { titulo: 'Legado gravado', etapa: 'gravacao', gravada: true },
        { titulo: 'Com responsável', etapa: 'em_edicao', responsavel: 'Ana' },
        { titulo: 'Sem ninguém', etapa: 'em_edicao' },
        { titulo: 'Sem arte', etapa: 'para_publicar' },
        { titulo: 'Com arte', etapa: 'redes_sociais', thumbnail_url: '/t.png' },
      ],
      AprovacaoItem: [{ titulo: 'Corte A', status: 'pendente' }, { titulo: 'Corte B', status: 'aprovado' }],
      Script: [{ title: 'Roteiro 1', created_date: '2026-10-02' }],
    });
    expect((await page('recording', env).apply('sem-data', {})).details).toEqual(['Sem horário · Agendamentos']);
    expect((await page('recording', env).apply('gravadas', {})).details).toEqual(['Legado gravado · Gravações']);
    expect((await page('edit', env).apply('sem-editor', {})).details).toEqual(['Sem ninguém · Em edição']);
    expect((await page('review', env).apply('aprovacoes-pendentes', {})).details).toEqual(['Corte A · pendente']);
    expect((await page('image', env).apply('sem-thumbnail', {})).details).toEqual(['Sem arte · Para publicação']);
    expect((await page('script', env).apply('roteiros', {})).count).toBe(1);
    await page('script', env).apply('exportar-roteiros', {});
    expect(env.download.mock.calls[0][1]).toContain('Roteiro 1;2026-10-02');
  });

  it('asks for confirmation before “Nova produção”, because it creates a draft on the server', async () => {
    const env = fakeEnv();
    const tool = pageCatalogue('dashboard', { label: 'Início' }).tools.find((item) => item.id === 'nova-producao');
    expect(tool.confirm).toMatch(/Criar um rascunho/);
    await page('dashboard', env).apply('nova-producao', {});
    expect(env.navigate).toHaveBeenCalledWith('/corp?sub=overview&novo=producao');
  });

  it('treats “Hoje” as today only, in local time', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const env = fakeEnv({}, { assets: vi.fn(async () => [{ title: 'Hoje', created_date: `${localDate(now)}T12:00:00` }, { title: 'Ontem', created_date: `${localDate(yesterday)}T12:00:00` }]) });
    expect((await page('ingest', env).apply('midias-recentes', { days: '1' })).details).toEqual(['Hoje · mídia']);
    expect((await page('ingest', env).apply('midias-recentes', { days: '7' })).count).toBe(2);
  });

  it('offers only the AI usage periods the server accepts and reports export failures', async () => {
    const tool = pageCatalogue('analytics', { label: 'Analytics' }).tools.find((item) => item.id === 'exportar-consumo-ia');
    expect(tool.params[0].options.map(([days]) => Number(days)).every((days) => days <= 31)).toBe(true);
    const env = fakeEnv({}, { fetchBlob: vi.fn().mockRejectedValue(new Error('Sem permissão para este relatório.')) });
    await expect(page('analytics', env).apply('exportar-consumo-ia', { days: '30' })).rejects.toThrow('Sem permissão');
    expect(env.download).not.toHaveBeenCalled();
  });
});

describe('arquivos', () => {
  it('neutralizes TAB and CR at the start of a CSV cell', () => {
    expect(toCsv(['a'], [['\tx'], ['\ry']])).toContain("'\tx");
  });

  it('downloads through a temporary link and releases the URL afterwards', () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadFile('a.csv', 'conteúdo');
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
