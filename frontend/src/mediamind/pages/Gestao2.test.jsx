import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listAdminUsers: vi.fn(), listAdminActivity: vi.fn(), listMemberships: vi.fn(), listPermissionGroups: vi.fn(),
}));
vi.mock('../../api/admin', () => ({ listAdminUsers: api.listAdminUsers, listAdminActivity: api.listAdminActivity }));
vi.mock('../../api/permissions', () => ({ listMemberships: api.listMemberships, listPermissionGroups: api.listPermissionGroups }));
const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../auth', () => ({ useAuth: () => auth }));

import Gestao2 from './Gestao2';
import { ApiError } from '../../api/httpClient';

const NOW = new Date().toISOString();
const USERS = [
  { id: 'u-marina', full_name: 'Marina Costa', email: 'marina@x.dev', tenant_role: 'editor', profile_name: 'Editor', status: 'active', last_access_at: NOW },
  { id: 'u-joao', full_name: 'João Lima', email: 'joao@x.dev', tenant_role: 'journalist', profile_name: null, status: 'invited' },
];
const MEMBERSHIPS = [
  { id: 'm-1', user_id: 'u-marina', email: 'marina@x.dev', full_name: 'Marina Costa', role: 'editor', permission_group_id: null, extra_screens: ['qualidade'], restricted_screens: ['editor_video'] },
  { id: 'm-2', user_id: 'u-joao', email: 'joao@x.dev', full_name: 'João Lima', role: 'journalist', permission_group_id: null, extra_screens: [], restricted_screens: [] },
];
const AUDIT = [
  { id: 'abc12345-0000', action: 'user.reactivated', entity_type: 'User', entity_id: 'u-marina', user_id: 'adm-user', details: { reason: 'Retorno de férias' }, created_date: NOW },
  { id: 'def67890-0000', action: 'record.created', entity_type: 'Pauta', entity_id: 'p-1', user_id: 'u-joao', details: {}, created_date: '2020-01-01T10:00:00Z' },
];

function renderAt(path = '/telas2/gestao') {
  return render(<MemoryRouter initialEntries={[path]}><Gestao2 /></MemoryRouter>);
}

function withData() {
  api.listAdminUsers.mockResolvedValue({ items: USERS, total: 2, page: 1, page_size: 100 });
  api.listMemberships.mockResolvedValue(MEMBERSHIPS);
  api.listPermissionGroups.mockResolvedValue([{ id: 'g-1', name: 'Editor', description: '', is_active: true, permission_codes: ['media.write'] }]);
  api.listAdminActivity.mockResolvedValue(AUDIT);
}

describe('Gestão 2 (Telas 2)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    auth.user = { id: 'adm', name: 'Alex', role: 'admin' };
    api.listAdminUsers.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    api.listMemberships.mockResolvedValue([]);
    api.listPermissionGroups.mockResolvedValue([]);
    api.listAdminActivity.mockResolvedValue([]);
  });

  it('mostra estados vazios honestos sem dados', async () => {
    renderAt();
    expect(await screen.findByText('Dados reais do tenant selecionado')).toBeInTheDocument();
    expect(screen.getByText('Indicadores por pessoa ainda não disponíveis')).toBeInTheDocument();
    expect(screen.getAllByText('Nenhuma pessoa encontrada').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Ver como usuário/ })).toHaveAttribute('title', 'Ainda não disponível');
    expect(api.listAdminActivity).toHaveBeenCalledWith(200);
  });

  it('mostra erro real quando as fontes falham, sem dados de exemplo', async () => {
    const denied = new ApiError({ status: 403, message: 'x' });
    api.listAdminUsers.mockRejectedValue(denied);
    api.listMemberships.mockRejectedValue(denied);
    api.listAdminActivity.mockRejectedValue(new Error('falhou'));
    renderAt();
    expect(await screen.findByText('Dados reais indisponíveis')).toBeInTheDocument();
    expect(screen.getAllByText(/Sem permissão para consultar estes dados/).length).toBeGreaterThan(0);
  });

  it('visão geral usa pessoas e auditoria reais', async () => {
    withData();
    renderAt();
    expect(await screen.findByText('Convite ainda não aceito')).toBeInTheDocument();
    expect(screen.getByText('Reativou usuário')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir' })[0]);
    expect(await screen.findByRole('heading', { name: 'Telas e ações' })).toBeInTheDocument();
  });

  it('equipe filtra pessoas e abre o painel Ver como com acessos efetivos', async () => {
    withData();
    renderAt('/telas2/gestao?tab=equipe');
    expect(await screen.findByText('Marina Costa')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar pessoa'), { target: { value: 'joão' } });
    expect(screen.queryByText('Marina Costa')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar pessoa'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filtrar por função'), { target: { value: 'editor' } });
    expect(screen.queryByText('João Lima')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver como' }));
    const panel = screen.getByRole('complementary', { name: 'Ver como usuário' });
    expect(within(panel).getByText('Workspace 2')).toBeInTheDocument();
    expect(within(panel).getByText('Controle de qualidade')).toBeInTheDocument();
    expect(within(panel).getByText(/Você continua identificado como Alex/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /Abrir visualização/ })).toBeDisabled();
    fireEvent.click(within(panel).getByRole('button', { name: 'Fechar painel' }));
    expect(screen.getByText('Nenhuma pessoa selecionada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gerenciar acessos/ }));
    expect(await screen.findByRole('heading', { name: 'Telas e ações' })).toBeInTheDocument();
  });

  it('acessos e telas mostram função, exceções reais e ações desabilitadas', async () => {
    withData();
    renderAt('/telas2/gestao?tab=acessos');
    expect(await screen.findByRole('heading', { name: 'Telas e ações' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pessoa'), { target: { value: 'u-marina' } });
    expect(screen.getByText('Edição de vídeo')).toBeInTheDocument();
    expect(screen.getAllByText('Negar').length).toBeGreaterThan(1);
    fireEvent.change(screen.getByLabelText(/Motivo da alteração/), { target: { value: 'Teste' } });
    expect(screen.getByText('5/500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar alterações/ })).toHaveAttribute('title', 'Ainda não disponível');
    expect(screen.getByRole('button', { name: /Restaurar padrão/ })).toBeDisabled();
  });

  it('acessos e telas sem pessoas mostra vazio', async () => {
    renderAt('/telas2/gestao?tab=acessos');
    expect(await screen.findByText('Nenhuma pessoa para configurar')).toBeInTheDocument();
  });

  it('acessos por função mostram catálogo e alcance reais', async () => {
    withData();
    renderAt('/telas2/gestao?tab=perfis');
    expect(await screen.findByText(/1 colaborador\(es\) · 1 com exceção individual preservada/)).toBeInTheDocument();
    expect(screen.getByText('Editor · 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Redação \/ Jornalista/ }));
    expect(screen.getByText(/1 colaborador\(es\) · 0 com exceção/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar alteração da função/ })).toBeDisabled();
  });

  it('acessos por função sem dados mostram vazio', async () => {
    renderAt('/telas2/gestao?tab=perfis');
    expect(await screen.findByText('Nenhuma função em uso')).toBeInTheDocument();
    expect(screen.getByText('Nenhum perfil cadastrado.')).toBeInTheDocument();
  });

  it('histórico lista auditoria real, filtra e mostra detalhes', async () => {
    withData();
    renderAt('/telas2/gestao?tab=historico');
    expect(await screen.findByText('Retorno de férias')).toBeInTheDocument();
    expect(screen.getByText('AUD-ABC12345')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Criou registro' }));
    expect(screen.getByText('AUD-DEF67890')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '7' } });
    expect(screen.queryByRole('button', { name: 'Criou registro' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Ação'), { target: { value: 'record.created' } });
    expect(screen.queryByRole('button', { name: 'Reativou usuário' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ação'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 'u-joao' } });
    expect(screen.getByRole('button', { name: 'Criou registro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preparar reversão/ })).toHaveAttribute('title', 'Ainda não disponível');
  });

  it('histórico vazio', async () => {
    renderAt('/telas2/gestao?tab=historico');
    expect(await screen.findByText('Nenhum registro encontrado')).toBeInTheDocument();
    expect(screen.getByText('Selecione um registro')).toBeInTheDocument();
  });

  it('sessão expirada, perfis indisponíveis e casos de borda', async () => {
    api.listAdminUsers.mockRejectedValue(new ApiError({ status: 401, message: 'x' }));
    api.listMemberships.mockResolvedValue([
      { id: 'm-a', user_id: 'u-adm', email: 'adm@x.dev', full_name: 'Ana Admin', role: 'admin' },
      { id: 'm-s', user_id: 'u-s', email: 's@x.dev', full_name: 'Sem Função', role: undefined },
    ]);
    api.listPermissionGroups.mockRejectedValue({});
    api.listAdminActivity.mockResolvedValue([{ id: 'z', action: 'record.updated', user_id: null, created_date: null }]);
    renderAt();
    expect(await screen.findByText(/Sessão expirada/)).toBeInTheDocument();
    expect(screen.getByText(/Perfis indisponíveis/)).toBeInTheDocument();
    expect(screen.getByText('Atualizou registro')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver acessos' })[0]);
    expect(await screen.findByText('Administradores acessam todas as áreas da Produção.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Equipe/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver como' })[0]);
    expect(screen.getByText(/Acesso total às áreas da Produção/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver como' })[1]);
    expect(screen.getByText(/Nenhuma tela de módulo liberada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/ }));
    expect(screen.getAllByText('Sistema').length).toBeGreaterThan(0);
  });

  it('respostas nulas e status desconhecidos', async () => {
    auth.user = null;
    api.listAdminUsers.mockResolvedValue({ items: [
      { id: 'u-x', full_name: 'Xis', email: 'x@x', tenant_role: 'editor', status: 'suspended' },
      { id: 'u-y', full_name: 'Ypsilon', email: 'y@x', tenant_role: 'editor', status: 'arquivado' },
      { id: 'u-z', full_name: 'Zeta', email: 'z@x', tenant_role: 'editor' },
    ] });
    api.listMemberships.mockResolvedValue(null);
    api.listPermissionGroups.mockResolvedValue([{ id: 'g', name: 'Antigo', is_active: false }]);
    api.listAdminActivity.mockResolvedValue([{ id: 'q', action: 'user.suspended', entity_type: 'User', entity_id: 'desconhecido', user_id: 'outro', created_date: NOW }, { id: 'r', action: 'x.y', user_id: 'u-x', created_date: NOW }]);
    render(<MemoryRouter initialEntries={['/telas2/gestao']}><Gestao2 /></MemoryRouter>);
    expect(await screen.findByText('Acesso suspenso ou bloqueado')).toBeInTheDocument();
    expect(screen.getByText('arquivado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/ }));
    expect(screen.getAllByText('Usuário não listado').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'x y' }));
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /Acessos por função/ }));
    expect(screen.getByText('Antigo · 0')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Função'), { target: { value: 'admin' } });
    expect(screen.getByText('Administradores acessam todas as telas.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Equipe/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver como' })[0]);
    expect(screen.getByText('Nenhum')).toBeInTheDocument();
    expect(screen.getByText(/identificado como você mesmo/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Gerenciar acessos/ })[0]);
    expect(await screen.findByText(/Alteração será atribuída a você\./)).toBeInTheDocument();
  });

  it('respostas nulas viram listas vazias e função sem áreas mostra vazio', async () => {
    api.listAdminUsers.mockResolvedValue(null);
    api.listMemberships.mockResolvedValue([{ id: 'm-v', user_id: 'u-v', email: 'v@x', full_name: 'Visitante', role: 'viewer' }]);
    api.listPermissionGroups.mockResolvedValue(null);
    api.listAdminActivity.mockResolvedValue(null);
    renderAt('/telas2/gestao?tab=acessos');
    expect(await screen.findByText('Nenhuma área da Produção definida')).toBeInTheDocument();
  });

  it('troca de abas pela navegação', async () => {
    renderAt();
    await screen.findByText('Dados reais do tenant selecionado');
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/ }));
    expect(screen.getByRole('tab', { name: /Histórico/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Visão geral/ }));
    expect(screen.getByRole('tab', { name: /Visão geral/ })).toHaveAttribute('aria-selected', 'true');
  });
});
