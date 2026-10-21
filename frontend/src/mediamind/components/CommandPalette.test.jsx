import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/httpClient';

const { entityLists } = vi.hoisted(() => ({ entityLists: {} }));

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: new Proxy({}, {
      get: (_target, name) => ({
        list: () => (entityLists[name] ? entityLists[name]() : Promise.resolve([])),
        filter: () => (entityLists[name] ? entityLists[name]() : Promise.resolve([])),
      }),
    }),
  },
}));

vi.mock('../auth', () => ({ useAuth: () => ({ user: { id: 'u-1', role: 'superadmin' } }) }));
vi.mock('../lib/empresaContext', () => ({ useEmpresa: () => ({ current: null, isGlobal: true }) }));

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
    entityLists.Project = () => Promise.resolve([{ id: 'p-1', name: 'Projeto Aurora', status: 'ativo', asset_count: 2 }]);

    render(<MemoryRouter><CommandPalette open onClose={() => {}} /></MemoryRouter>);

    expect(await screen.findByText('Projeto Aurora')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Projetos')).toBeInTheDocument());
    for (const heading of ['Releases', 'Clippings', 'Menções', 'Jornalistas']) {
      expect(screen.queryByText(heading)).toBeNull();
    }
    expect(screen.queryByText(/não está liberada/)).toBeNull();
    expect(screen.queryByText('Release — resultado trimestral')).toBeNull();
  });
});
