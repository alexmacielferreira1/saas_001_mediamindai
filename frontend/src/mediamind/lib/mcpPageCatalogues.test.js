import { describe, expect, it, vi } from 'vitest';
import { PAGE_CATALOGUE_GROUPS, pageCatalogue } from './mcpPageCatalogues';
import { createPageProvider, toCsv } from './mcpPageTools';

const isoDaysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

function fakeEnv(overrides = {}) {
  return {
    navigate: vi.fn(),
    ask: vi.fn(),
    download: vi.fn(),
    corpUrl: (sub, extra = '') => `/corp?sub=${sub}${extra ? `&${extra}` : ''}`,
    ingestUrl: (extra) => `/ingest?${extra}`,
    records: vi.fn(async () => []),
    assets: vi.fn(async () => []),
    adminUsers: vi.fn(async () => []),
    auditLogs: vi.fn(async () => []),
    fetchBlob: vi.fn(async () => new Blob(['a;b'])),
    agencyData: () => ({}),
    ...overrides,
  };
}

function provider(group, env, cards = ['Resumir pendências']) {
  return createPageProvider({ source: `page:${group}`, label: 'Página', catalogue: pageCatalogue(group, { label: 'Página', cards }), env });
}

describe('page MCP catalogues', () => {
  it('gives every page group the icon model with real tools and unique ids', () => {
    expect(PAGE_CATALOGUE_GROUPS.length).toBeGreaterThanOrEqual(25);
    for (const group of PAGE_CATALOGUE_GROUPS) {
      const catalogue = pageCatalogue(group, { label: group, cards: ['Pedido'] });
      const ids = catalogue.tools.map((tool) => tool.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(catalogue.tools.length).toBeGreaterThanOrEqual(4);
      catalogue.tools.forEach((tool) => {
        expect(typeof tool.run).toBe('function');
        expect(tool.icon).toBeTruthy();
        expect(catalogue.tabs.some((tab) => tab.id === tool.tab)).toBe(true);
      });
    }
    expect(pageCatalogue('desconhecido')).toBeNull();
  });

  it('counts real productions per stage and lists overdue edit deadlines', async () => {
    const env = fakeEnv({
      records: vi.fn(async () => [
        { titulo: 'A', etapa: 'em_edicao', prazo_edicao: '2000-01-01' },
        { titulo: 'B', etapa: 'rascunho' },
        { titulo: 'C', etapa: 'em_edicao', prazo_edicao: '2999-01-01', editor: 'Ana' },
      ]),
    });
    const page = provider('dashboard', env);
    const stages = await page.apply('producoes-por-etapa', {});
    expect(stages.headline.count).toBe(3);
    expect(stages.details).toEqual(expect.arrayContaining(['Rascunhos: 1', 'Em edição: 2']));
    const overdue = await page.apply('prazos-vencidos', {});
    expect(overdue.count).toBe(1);
    expect(overdue.details[0]).toContain('A');
    expect(env.records).toHaveBeenCalledWith('ProducaoProjeto', { sort: '-updated_date', limit: 500 });

    const editing = await provider('edit', env).apply('sem-editor', {});
    expect(editing.details).toEqual(['A · Em edição · prazo 2000-01-01']);
  });

  it('finds duplicated and unmeasured media in ingest and searches the archive', async () => {
    const env = fakeEnv({
      assets: vi.fn(async () => [
        { id: '1', title: 'LGPD aula', filename: 'lgpd.mp4', file_size: 10, asset_type: 'video', created_date: isoDaysAgo(0) },
        { id: '2', title: 'LGPD cópia', filename: 'LGPD.mp4', file_size: 10, asset_type: 'video', duration: 30, created_date: isoDaysAgo(40) },
        { id: '3', title: 'Logo', filename: 'logo.png', file_size: 5, asset_type: 'image', created_date: isoDaysAgo(2) },
      ]),
    });
    const ingest = provider('ingest', env);
    expect((await ingest.apply('duplicados', {})).details).toEqual(['lgpd.mp4 · 2 cópias']);
    expect((await ingest.apply('sem-duracao', {})).count).toBe(1);
    expect((await ingest.apply('midias-por-tipo', { days: '7' })).details).toEqual(['video: 1', 'image: 1']);

    const search = provider('search', env);
    expect((await search.apply('buscar-acervo', { q: '  ' })).ok).toBe(false);
    expect((await search.apply('buscar-acervo', { q: 'lgpd' })).count).toBe(2);
    expect((await search.apply('buscar-acervo', { q: 'nada' })).count).toBe(0);
  });

  it('opens the right page, keeping the corp role, and opens media in the workspace', async () => {
    const env = fakeEnv({ assets: vi.fn(async () => [{ id: 'a 1', title: 'Entrevista' }]) });
    await provider('dashboard', env).apply('abrir-edicao', {});
    expect(env.navigate).toHaveBeenLastCalledWith('/corp?sub=em_edicao');
    await provider('ingest', env).apply('novo-pacote', {});
    expect(env.navigate).toHaveBeenLastCalledWith('/ingest?novo=pacote');
    const workspace = provider('workspace', env);
    expect(await workspace.analyze('abrir-midia', { q: 'entre' })).toMatchObject({ count: 1 });
    expect(await workspace.apply('abrir-midia', { q: 'entre' })).toMatchObject({ ok: true });
    expect(env.navigate).toHaveBeenLastCalledWith('/corp?sub=workspace&assetId=a%201');
    expect((await workspace.apply('abrir-midia', { q: 'xyz' })).ok).toBe(false);
  });

  it('exports real rows to CSV and never downloads an empty file', async () => {
    const env = fakeEnv();
    const empty = await provider('admin', env).apply('exportar-usuarios', {});
    expect(empty.ok).toBe(false);
    expect(env.download).not.toHaveBeenCalled();

    env.adminUsers.mockResolvedValue([{ full_name: 'Ana', email: 'ana@x.com', tenant_role: 'editor', profile_name: '', status: 'active' }]);
    const done = await provider('admin', env).apply('exportar-usuarios', {});
    expect(done).toMatchObject({ ok: true, count: 1 });
    const [filename, content] = env.download.mock.calls[0];
    expect(filename).toMatch(/^usuarios-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(content).toContain('Nome;E-mail;Função;Perfil;Status');
    expect(content).toContain('Ana;ana@x.com;editor;;active');
    expect((await provider('admin', env).apply('sem-perfil', {})).count).toBe(1);
  });

  it('exports the AI usage CSV from the real endpoint and reports permission errors', async () => {
    const env = fakeEnv();
    await provider('analytics', env).apply('exportar-consumo-ia', { days: '30' });
    expect(env.fetchBlob).toHaveBeenCalledWith('/ai/usage/export.csv?days=30');
    expect(env.download).toHaveBeenCalledWith('mediamind-ia-consumo.csv', expect.any(Blob), 'text/csv');
  });

  it('reads the agency prototype data stored in this browser', async () => {
    const env = fakeEnv({ agencyData: () => ({ opportunities: [{ nome: 'X', status: 'Ganha', valor: 1500 }, { nome: 'Y', status: 'Nova', valor: 900 }] }) });
    const crm = provider('agency_crm', env);
    expect((await crm.apply('listar-opportunities', {})).count).toBe(2);
    const revenue = await crm.apply('ganhos', {});
    expect(revenue.count).toBe(1);
    expect(revenue.summary).toContain('1.500,00');
    await crm.apply('guia-radar', {});
    expect(env.navigate).toHaveBeenCalledWith('/agencia-video?guia=radar');
    expect((await crm.apply('exportar-leads', {})).ok).toBe(false);
  });

  it('prepares Copilot requests in the chat without executing them', async () => {
    const env = fakeEnv();
    const result = await provider('review', env, ['Comparar versões']).apply('copiloto-0', {});
    expect(result.ok).toBe(true);
    expect(env.ask).toHaveBeenCalledWith(expect.stringContaining('Comparar versões'));
  });

  it('keeps the provider honest about preview, unknown tools and undo', async () => {
    const page = provider('dashboard', fakeEnv());
    expect(await page.analyze('abrir-ingest', {})).toMatchObject({ ok: false });
    expect(await page.apply('nao-existe', {})).toMatchObject({ ok: false });
    expect(page.canUndo()).toBe(false);
    expect(page.undo()).toBe(false);
  });
});

describe('toCsv', () => {
  it('uses semicolons, a BOM and neutralizes spreadsheet formulas', () => {
    const csv = toCsv(['a', 'b'], [['=SOMA(1)', 'x;y'], ['linha\nnova', null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain("'=SOMA(1);\"x;y\"");
    expect(csv).toContain('"linha\nnova";');
  });
});
