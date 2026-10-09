import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMembershipsMock = vi.fn();
const updateMembershipRoleMock = vi.fn();

vi.mock('../../../../api/permissions', () => ({
  listMemberships: (...args) => listMembershipsMock(...args),
  updateMembershipRole: (...args) => updateMembershipRoleMock(...args),
}));

vi.mock('../../../auth', () => ({
  useAuth: () => ({ user: { id: 'user-admin' } }),
}));

vi.mock('./AcessoIAPanel', () => ({
  default: () => null,
}));

import AdminAcessosPage from './AdminAcessosPage';

describe('AdminAcessosPage local permission administration', () => {
  beforeEach(() => {
    listMembershipsMock.mockReset();
    updateMembershipRoleMock.mockReset();
  });

  it('loads employees from the local tenant membership API', async () => {
    listMembershipsMock.mockResolvedValue([
      {
        id: 'membership-editor',
        user_id: 'user-editor',
        email: 'editor@mediamind.ai',
        full_name: 'Editor Local',
        role: 'editor',
        permission_group_id: null,
      },
    ]);

    render(<AdminAcessosPage />);

    expect(screen.getByText('Carregando funcionários…')).toBeInTheDocument();
    expect(await screen.findByText('Editor Local')).toBeInTheDocument();
    expect(screen.getByText('editor@mediamind.ai')).toBeInTheDocument();
    expect(listMembershipsMock).toHaveBeenCalledOnce();
  });

  it('shows the existing empty state when the selected tenant has no memberships', async () => {
    listMembershipsMock.mockResolvedValue([]);

    render(<AdminAcessosPage />);

    await waitFor(() => expect(listMembershipsMock).toHaveBeenCalledOnce());
    expect(
      await screen.findByText(/Nenhum funcionário cadastrado/),
    ).toBeInTheDocument();
  });

  it('keeps the server role and shows an error when role persistence fails', async () => {
    listMembershipsMock.mockResolvedValue([
      {
        id: 'membership-editor',
        user_id: 'user-editor',
        email: 'editor@mediamind.ai',
        full_name: 'Editor Local',
        role: 'editor',
        permission_group_id: null,
      },
    ]);
    updateMembershipRoleMock.mockRejectedValue(new Error('offline'));
    render(<AdminAcessosPage />);
    await screen.findByText('Editor Local');

    fireEvent.change(screen.getByTitle('Cargo do funcionário'), {
      target: { value: 'reporter' },
    });

    expect(
      await screen.findByText('Não foi possível alterar o cargo. Tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Cargo do funcionário')).toHaveValue('editor');
  });
});
