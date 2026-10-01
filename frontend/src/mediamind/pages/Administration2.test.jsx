import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAdminUsersMock = vi.fn();
const getAdminUserMock = vi.fn();
const suspendAdminUserMock = vi.fn();
const listAdminActivityMock = vi.fn();

vi.mock('../../api/admin', () => ({
  listAdminUsers: (...args) => listAdminUsersMock(...args),
  getAdminUser: (...args) => getAdminUserMock(...args),
  suspendAdminUser: (...args) => suspendAdminUserMock(...args),
  listAdminActivity: (...args) => listAdminActivityMock(...args),
}));

vi.mock('../../api/permissions', () => ({ listPermissionGroups: vi.fn().mockResolvedValue([]) }));

vi.mock('../components/corp/roles/AdminAcessosPage', () => ({
  default: () => <div>Tela atual preservada</div>,
}));

import Administration2 from './Administration2';

const USER = {
  id: 'user-1',
  full_name: 'Editor Local',
  email: 'editor@mediamind.ai',
  tenant_role: 'editor',
  profile_name: null,
  status: 'active',
  created_at: '2026-09-29T10:00:00Z',
};

describe('Administration2 preview', () => {
  beforeEach(() => {
    listAdminUsersMock.mockReset();
    getAdminUserMock.mockReset();
    suspendAdminUserMock.mockReset();
    listAdminActivityMock.mockResolvedValue([]);
    listAdminUsersMock.mockResolvedValue({ items: [USER], total: 1, page: 1, page_size: 25 });
    getAdminUserMock.mockResolvedValue({ ...USER, extra_screens: [], restricted_screens: [], failed_login_attempts: 0 });
  });

  it('shows the parallel preview and loads real tenant users', async () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(screen.getByText('Administração 2')).toBeInTheDocument();
    expect(await screen.findByText('Ações administrativas')).toBeInTheDocument();
    expect(screen.getByText('Alertas administrativos')).toBeInTheDocument();
    expect(screen.getByText('Status de segurança')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usuários' }));
    expect(await screen.findByText('Editor Local')).toBeInTheDocument();
    expect(listAdminUsersMock).toHaveBeenCalledWith({ page: 1, pageSize: 100, search: '', status: '' });
  });

  it('opens user detail and persists suspension only after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    suspendAdminUserMock.mockResolvedValue({ ...USER, status: 'suspended' });
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Usuários' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Editor Local' }));
    expect(await screen.findByRole('heading', { name: 'Editor Local' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suspender usuário' }));
    await waitFor(() => expect(suspendAdminUserMock).toHaveBeenCalledWith('user-1', 'Suspensão confirmada pelo administrador.'));
    expect((await screen.findAllByText('Suspenso')).length).toBeGreaterThan(0);
  });

  it('embeds the existing access screen without replacing it', () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Acessos por Função' }));
    expect(screen.getByText('Tela atual preservada')).toBeInTheDocument();
  });

  it('exposes every administration area from the approved specification', () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    ['Acervo 2', 'Gestão 2', 'Cadastros 2', 'Integrações 2', 'Configurações 2'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });
  });

  it('shows real user data across the detail tabs', async () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Usuários' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Editor Local' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Módulos' }));
    expect(screen.getByText('Nenhuma tela extra liberada.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Segurança' })[1]);
    expect(screen.getByText('Tentativas falhas')).toBeInTheDocument();
  });

  it('opens a requested administration section from the URL', async () => {
    render(<MemoryRouter initialEntries={['/administration2?tab=users']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByText('Contas, convites, perfis e atividade de acesso.')).toBeInTheDocument();
  });

  it('uses the compact core navigation and keeps contextual areas separate', async () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByLabelText('Navegação principal da Administração 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Áreas relacionadas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acervo 2' })).toBeInTheDocument();
  });
});
