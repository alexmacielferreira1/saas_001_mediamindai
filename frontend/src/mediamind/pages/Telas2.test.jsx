import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authState = { user: { id: 'u-1', name: 'Alex', role: 'admin' } };

vi.mock('../auth', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => authState,
}));
vi.mock('../lib/empresaContext', () => ({
  EmpresaProvider: ({ children }) => children,
  useEmpresa: () => ({ currentEmpresa: null }),
}));
vi.mock('../components/EmpresaGate', () => ({ default: ({ children }) => children }));
vi.mock('../Shell', () => ({ default: ({ children }) => <div data-testid="shell">{children}</div> }));
vi.mock('./Home', () => ({ default: () => <p>Início real</p> }));
vi.mock('../../api/admin', () => ({
  listAdminUsers: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 }),
  listAdminActivity: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../api/permissions', () => ({
  listMemberships: vi.fn().mockResolvedValue([]),
  listPermissionGroups: vi.fn().mockResolvedValue([]),
}));

import App from '../../App';

function renderAt(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('rota /telas2', () => {
  afterEach(() => { authState.user = { id: 'u-1', name: 'Alex', role: 'admin' }; });

  it('abre o índice das Telas 2 dentro do Shell para administradores', async () => {
    renderAt('/telas2');
    expect(await screen.findByRole('heading', { name: 'Telas 2' })).toBeInTheDocument();
    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gestão · Histórico/ })).toHaveAttribute('href', '/telas2/gestao?tab=historico');
    expect(screen.getByRole('link', { name: /APIs e IA · Provedores e chaves/ })).toHaveAttribute('href', '/telas2/apis-ia?tab=provedores');
    expect(screen.getByText(/Visão do editor no MediaMind:/)).toBeInTheDocument();
  });

  it('abre a Gestão 2 pela rota /telas2/gestao', async () => {
    renderAt('/telas2/gestao?tab=equipe');
    expect(await screen.findByRole('heading', { name: 'Minha equipe' })).toBeInTheDocument();
  });

  it('redireciona quem não tem o módulo de gestão', async () => {
    authState.user = { id: 'u-2', name: 'Editor', role: 'editor' };
    renderAt('/telas2');
    expect(await screen.findByText('Início real')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Telas 2' })).not.toBeInTheDocument();
  });
});
