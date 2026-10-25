import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/httpClient';

const { entityLists, requested, empresaState } = vi.hoisted(() => ({ entityLists: {}, requested: [], empresaState: { current: null, isGlobal: true } }));

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: new Proxy({}, {
      get: (_target, name) => ({
        list: () => { requested.push({ name, method: 'list' }); return entityLists[name] ? entityLists[name]() : Promise.resolve([]); },
        filter: () => { requested.push({ name, method: 'filter' }); return entityLists[name] ? entityLists[name]() : Promise.resolve([]); },
      }),
    }),
  },
}));

vi.mock('../auth', () => ({ useAuth: () => ({ user: { id: 'u-1', role: 'superadmin' } }) }));
vi.mock('../lib/empresaContext', () => ({ useEmpresa: () => empresaState }));

import CommandPalette from './CommandPalette';

const screenDenied = () => Promise.reject(new ApiError({
  status: 403, code: 'SCREEN_ACCESS_DENIED', message: 'Esta tela não está liberada para você.',
}));

describe('CommandPalette com telas restritas no servidor', () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
    Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  });

  beforeEach(() => {
    for (const key of Object.keys(entityLists)) delete entityLists[key];
  });

  it('ignora em silêncio o 403 da Assessoria e mantém as demais buscas', async () => {
    for (const name of ['Release', 'Clipping', 'Jornalista', 'Mencao']) entityLists[name] = screenDenied;
    entityLists.Script = () => Promise.resolve([{ id: 's-1', title: 'Roteiro Aurora', status: 'ativo' }]);

    render(<MemoryRouter><CommandPalette open onClose={() => {}} /></MemoryRouter>);

    expect(await screen.findByText('Roteiro Aurora')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Roteiros')).toBeInTheDocument());
    for (const heading of ['Releases', 'Clippings', 'Menções', 'Jornalistas']) {
      expect(screen.queryByText(heading)).toBeNull();
    }
    expect(screen.queryByText(/não está liberada/)).toBeNull();
    expect(screen.queryByText('Release — resultado trimestral')).toBeNull();
  });
});

describe('CommandPalette com empresa selecionada', () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
    Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  });
  beforeEach(() => {
    for (const key of Object.keys(entityLists)) delete entityLists[key];
    requested.length = 0;
    empresaState.current = 'tenant-1';
    empresaState.isGlobal = false;
  });

  it('acha produções e mídias sem empresa_id (o servidor já isola) e não pede entidades inexistentes', async () => {
    entityLists.ProducaoProjeto = () => Promise.resolve([{ id: 'p-1', titulo: 'Episódio Aurora', empresa_id: '', etapa: 'rascunho' }]);
    entityLists.Asset = () => Promise.resolve([{ id: 'a-1', title: 'Entrevista Aurora', filename: 'aurora.mp4', asset_type: 'video' }]);

    render(<MemoryRouter><CommandPalette open onClose={() => {}} /></MemoryRouter>);

    expect(await screen.findByText('Episódio Aurora')).toBeInTheDocument();
    expect(screen.getByText('Entrevista Aurora')).toBeInTheDocument();
    expect(requested.filter((call) => call.method === 'filter')).toEqual([]);
    for (const missing of ['Project', 'Task', 'Library', 'IngestPackage']) {
      expect(requested.map((call) => call.name)).not.toContain(missing);
    }
  });
});
