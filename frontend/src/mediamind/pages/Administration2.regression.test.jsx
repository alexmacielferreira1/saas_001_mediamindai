import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAdminUsersMock = vi.fn();
const getAdminUserMock = vi.fn();

vi.mock('../../api/admin', () => ({
  listAdminUsers: (...args) => listAdminUsersMock(...args),
  getAdminUser: (...args) => getAdminUserMock(...args),
  suspendAdminUser: vi.fn(),
  listAdminActivity: vi.fn().mockResolvedValue([]),
  getAdminSettings: vi.fn().mockRejectedValue(new Error('offline')),
  updateAdminSettings: vi.fn(),
}));
vi.mock('../../api/permissions', () => ({ listPermissionGroups: vi.fn().mockResolvedValue([]) }));
vi.mock('../components/corp/roles/AdminAcessosPage', () => ({ default: () => <div>Acessos</div> }));

import Administration2 from './Administration2';

function renderAdministration(path = '/administration2') {
  return render(<MemoryRouter initialEntries={[path]}><Administration2 /></MemoryRouter>);
}

describe('Administration2 regressions', () => {
  beforeEach(() => {
    listAdminUsersMock.mockReset();
    getAdminUserMock.mockReset();
  });

  it('opens demo user details locally without making a failing API request', async () => {
    listAdminUsersMock.mockRejectedValue(new Error('offline'));
    renderAdministration('/administration2?tab=users');

    fireEvent.click(await screen.findByRole('button', { name: 'Ver Alex Maciel Ferreira' }));

    expect(await screen.findByRole('heading', { name: 'Alex Maciel Ferreira' })).toBeInTheDocument();
    expect(getAdminUserMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Suspender usuário' })).not.toBeInTheDocument();
    expect(screen.getByText(/detalhe de demonstração/i)).toBeInTheDocument();
  });

  it('does not present navigation shortcuts as creation actions', async () => {
    listAdminUsersMock.mockRejectedValue(new Error('offline'));
    renderAdministration();

    expect(await screen.findByRole('button', { name: /Gerenciar usuários/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo usuário/i })).not.toBeInTheDocument();
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
  });

  it('updates the form preview when another demonstration form is selected', async () => {
    listAdminUsersMock.mockRejectedValue(new Error('offline'));
    renderAdministration('/administration2?tab=forms');

    fireEvent.click(await screen.findByRole('button', { name: /Autorização de imagem/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Autorização de imagem' })).toBeInTheDocument());
  });
});
