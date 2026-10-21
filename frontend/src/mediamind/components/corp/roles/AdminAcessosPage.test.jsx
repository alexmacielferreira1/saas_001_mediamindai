import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMembershipsMock = vi.fn();
const updateMembershipRoleMock = vi.fn();
const updateMembershipScreensMock = vi.fn();

vi.mock('../../../../api/permissions', () => ({
  listMemberships: (...args) => listMembershipsMock(...args),
  updateMembershipRole: (...args) => updateMembershipRoleMock(...args),
  updateMembershipScreens: (...args) => updateMembershipScreensMock(...args),
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
    updateMembershipScreensMock.mockReset();
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

  const EDITOR = {
    id: 'membership-editor', user_id: 'user-editor', email: 'editor@mediamind.ai', full_name: 'Editor Local',
    role: 'editor', permission_group_id: null, extra_screens: [], restricted_screens: [],
  };
  const forbidden = (code, message) => Object.assign(new Error(message), { status: 403, code });

  it('shows the server message on GRANT_EXCEEDS_AUTHORITY and keeps the previous role', async () => {
    listMembershipsMock.mockResolvedValue([EDITOR]);
    updateMembershipRoleMock.mockRejectedValue(forbidden('GRANT_EXCEEDS_AUTHORITY', 'Você não pode conceder telas que não possui.'));
    render(<AdminAcessosPage />);
    await screen.findByText('Editor Local');

    fireEvent.change(screen.getByTitle('Cargo do funcionário'), { target: { value: 'gestao' } });

    expect(await screen.findByText('Você não pode conceder telas que não possui.')).toBeInTheDocument();
    expect(screen.getByTitle('Cargo do funcionário')).toHaveValue('editor');
    expect(screen.getByText('Editor Local')).toBeInTheDocument();
  });

  it('shows the server message when a screen grant is refused and keeps the screens', async () => {
    listMembershipsMock.mockResolvedValue([EDITOR]);
    updateMembershipScreensMock.mockRejectedValue(forbidden('GRANT_EXCEEDS_AUTHORITY', 'Concessão acima da sua autoridade.'));
    render(<AdminAcessosPage />);
    await screen.findByText('Editor Local');
    const screensCount = () => screen.getByText(/^\d+ telas$/).textContent;
    const before = screensCount();

    fireEvent.click(screen.getByText('Editor Local').closest('.rounded-lg').querySelector('button:last-of-type'));
    const firstScreen = screen.getAllByTitle('Padrão (clique p/ incluir)')[0];
    fireEvent.click(firstScreen);

    expect(await screen.findByText('Concessão acima da sua autoridade.')).toBeInTheDocument();
    expect(updateMembershipScreensMock).toHaveBeenCalledOnce();
    expect(screensCount()).toBe(before);
    expect(firstScreen).toHaveAttribute('title', 'Padrão (clique p/ incluir)');
  });

  it('keeps the generic text for 403 without a known code', async () => {
    listMembershipsMock.mockResolvedValue([EDITOR]);
    updateMembershipRoleMock.mockRejectedValue(forbidden('PERMISSION_DENIED', 'Você não possui permissão para esta ação.'));
    render(<AdminAcessosPage />);
    await screen.findByText('Editor Local');
    fireEvent.change(screen.getByTitle('Cargo do funcionário'), { target: { value: 'reporter' } });
    expect(await screen.findByText('Não foi possível alterar o cargo. Tente novamente.')).toBeInTheDocument();
  });

  it('shows the server message when listing is refused with SCREEN_ACCESS_DENIED', async () => {
    listMembershipsMock.mockRejectedValue(forbidden('SCREEN_ACCESS_DENIED', 'Esta tela não está liberada para você.'));
    render(<AdminAcessosPage />);
    expect(await screen.findByText('Esta tela não está liberada para você.')).toBeInTheDocument();
    expect(screen.getByText(/Nenhum funcionário cadastrado/)).toBeInTheDocument();
  });

  it('reflects the saved role when copying access fails on the screens step', async () => {
    const peer = { ...EDITOR, id: 'membership-rep', user_id: 'user-rep', full_name: 'Repórter Local', email: 'rep@mediamind.ai', role: 'reporter' };
    listMembershipsMock.mockResolvedValue([EDITOR, peer]);
    updateMembershipRoleMock.mockResolvedValue({});
    updateMembershipScreensMock.mockRejectedValue(forbidden('GRANT_EXCEEDS_AUTHORITY', 'Concessão acima da sua autoridade.'));
    render(<AdminAcessosPage />);
    await screen.findByText('Editor Local');

    fireEvent.click(screen.getByText('Editor Local').closest('.rounded-lg').querySelector('button:last-of-type'));
    fireEvent.change(screen.getByTitle('Substitui o acesso atual pelo do colega selecionado'), { target: { value: 'user-rep' } });

    expect(await screen.findByText('Concessão acima da sua autoridade.')).toBeInTheDocument();
    expect(screen.getAllByTitle('Cargo do funcionário')[0]).toHaveValue('reporter');
  });
});
