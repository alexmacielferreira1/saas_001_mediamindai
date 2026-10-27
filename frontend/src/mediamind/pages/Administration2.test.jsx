import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAdminUsersMock = vi.fn();
const getAdminUserMock = vi.fn();
const suspendAdminUserMock = vi.fn();
const reactivateAdminUserMock = vi.fn();
const revokeAdminUserSessionsMock = vi.fn();
const listAdminActivityMock = vi.fn();
const getAdminSettingsMock = vi.fn();
const updateAdminSettingsMock = vi.fn();
const readLocalDemoSessionMock = vi.fn();

vi.mock('../../api/admin', () => ({
  listAdminUsers: (...args) => listAdminUsersMock(...args),
  getAdminUser: (...args) => getAdminUserMock(...args),
  suspendAdminUser: (...args) => suspendAdminUserMock(...args),
  reactivateAdminUser: (...args) => reactivateAdminUserMock(...args),
  revokeAdminUserSessions: (...args) => revokeAdminUserSessionsMock(...args),
  listAdminActivity: (...args) => listAdminActivityMock(...args),
  getAdminSettings: (...args) => getAdminSettingsMock(...args),
  updateAdminSettings: (...args) => updateAdminSettingsMock(...args),
}));

vi.mock('../../api/permissions', () => ({ listPermissionGroups: vi.fn().mockResolvedValue([]) }));
vi.mock('../lib/demoAccess', () => ({
  readLocalDemoSession: (...args) => readLocalDemoSessionMock(...args),
}));

vi.mock('../components/corp/roles/AdminAcessosPage', () => ({
  default: () => <div>Tela atual preservada</div>,
}));

import Administration2 from './Administration2';
import { ApiError } from '../../api/httpClient';
import { listPermissionGroups } from '../../api/permissions';

const GROUPS = [
  { id: 'g-editors', name: 'Editores Reais', description: 'Grupo do tenant', is_active: true, permission_codes: ['users.manage', 'assets.view'] },
  { id: 'g-readers', name: 'Leitura Real', description: '', is_active: false, permission_codes: ['assets.view'] },
];

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
    listAdminActivityMock.mockReset();
    listAdminActivityMock.mockResolvedValue([]);
    getAdminSettingsMock.mockResolvedValue({ organization_name: 'MediaMind AI', locale: 'pt-BR', timezone: 'America/Sao_Paulo', date_format: 'DD/MM/YYYY' });
    updateAdminSettingsMock.mockImplementation(async (value) => value);
    readLocalDemoSessionMock.mockReturnValue(null);
    listAdminUsersMock.mockResolvedValue({ items: [USER], total: 1, page: 1, page_size: 25 });
    getAdminUserMock.mockResolvedValue({ ...USER, extra_screens: [], restricted_screens: [], failed_login_attempts: 0 });
  });

  it('shows the parallel preview and loads real tenant users', async () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Administração' })).toBeInTheDocument();
    expect(screen.queryByText('Administração 2')).not.toBeInTheDocument();
    expect(await screen.findByText('Ações rápidas')).toBeInTheDocument();
    expect(screen.getByText('Alertas administrativos')).toBeInTheDocument();
    expect(screen.getByText('Status de segurança')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usuários' }));
    expect(await screen.findByText('Editor Local')).toBeInTheDocument();
    expect(listAdminUsersMock).toHaveBeenCalledWith({ page: 1, pageSize: 100, search: '', status: '' });
  });

  it('shows an unavailable state without substituting demonstration users', async () => {
    listAdminUsersMock.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText(/dados administrativos indisponíveis/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usuários' }));
    expect(screen.queryByText('Administrador Demo')).not.toBeInTheDocument();
  });

  it('opens demonstration user details only in the explicit local demo session', async () => {
    readLocalDemoSessionMock.mockReturnValue({ id: 'demo-superadmin', selected_tenant_id: 'mediamind-demo' });
    render(<MemoryRouter initialEntries={['/administration2?tab=users']}><Administration2 /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Administrador Demo' }));
    expect(await screen.findByRole('heading', { name: 'Administrador Demo' })).toBeInTheDocument();
    expect(getAdminUserMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Suspender usuário' })).not.toBeInTheDocument();
    expect(screen.getByText(/detalhe de demonstração/i)).toBeInTheDocument();
  });

  it('uses honest navigation labels and offline security status', async () => {
    listAdminUsersMock.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /Gerenciar usuários/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo usuário/i })).not.toBeInTheDocument();
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
  });

  it('keeps a successful empty user response empty', async () => {
    listAdminUsersMock.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 25 });
    render(<MemoryRouter initialEntries={['/administration2?tab=users']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByText(/nenhum usuário encontrado/i)).toBeInTheDocument();
    expect(screen.queryByText('Administrador Demo')).not.toBeInTheDocument();
  });

  it('shows forbidden state for a 403 without demo data', async () => {
    listAdminUsersMock.mockRejectedValueOnce(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Sem acesso.' }));
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText(/sem permissão/i)).toBeInTheDocument();
    expect(screen.queryByText('Administrador Demo')).not.toBeInTheDocument();
  });

  it('shows the server message when the screen is restricted for the member', async () => {
    listAdminUsersMock.mockRejectedValueOnce(new ApiError({ status: 403, code: 'SCREEN_ACCESS_DENIED', message: 'Esta tela não está liberada para você.' }));
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText('Esta tela não está liberada para você.')).toBeInTheDocument();
    expect(screen.queryByText('Administrador Demo')).not.toBeInTheDocument();
  });

  it('changes the selected demonstration form preview', async () => {
    render(<MemoryRouter initialEntries={['/administration2?tab=forms']}><Administration2 /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Autorização de imagem/i }));
    expect(screen.getByRole('heading', { name: 'Autorização de imagem' })).toBeInTheDocument();
  });

  it('does not replace an expired real session with demonstration data', async () => {
    listAdminUsersMock.mockRejectedValueOnce(new ApiError({ status: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Faça login.' }));
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText(/sessão expirou/i)).toBeInTheDocument();
    expect(screen.queryByText(/sessão local de demonstração/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Alex Maciel Ferreira')).not.toBeInTheDocument();
    expect(screen.queryByText(/API indisponível/i)).not.toBeInTheDocument();
  });

  it('uses the official local demo session without calling unavailable administrative endpoints', async () => {
    readLocalDemoSessionMock.mockReturnValue({ id: 'demo-superadmin', selected_tenant_id: 'mediamind-demo' });
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText(/Modo local funcional/)).toBeInTheDocument();
    expect(screen.queryByText(/API indisponível/i)).not.toBeInTheDocument();
    expect(listAdminUsersMock).not.toHaveBeenCalled();
    expect(listAdminActivityMock).not.toHaveBeenCalled();
  });

  it('persists local demo settings without calling the backend', async () => {
    readLocalDemoSessionMock.mockReturnValue({ id: 'demo-superadmin', selected_tenant_id: 'mediamind-demo' });
    render(<MemoryRouter initialEntries={['/administration2?tab=settings']}><Administration2 /></MemoryRouter>);
    const organization = await screen.findByLabelText('Nome da organização');
    fireEvent.change(organization, { target: { value: 'MediaMind Local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));
    expect(await screen.findByText('Configurações locais salvas.')).toBeInTheDocument();
    expect(updateAdminSettingsMock).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem('mediamind_admin_demo_settings_v1')).organization_name).toBe('MediaMind Local');
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

  it('reactivates a suspended user and revokes sessions only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    listAdminUsersMock.mockResolvedValue({ items: [{ ...USER, status: 'suspended' }], total: 1, page: 1, page_size: 25 });
    getAdminUserMock.mockResolvedValue({ ...USER, status: 'suspended', extra_screens: [], restricted_screens: [], failed_login_attempts: 0 });
    reactivateAdminUserMock.mockResolvedValue({ ...USER, status: 'active' });
    revokeAdminUserSessionsMock.mockResolvedValue({ revoked_sessions: 2 });
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Usuários' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Editor Local' }));
    expect(screen.queryByRole('button', { name: 'Suspender usuário' })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Reativar usuário' }));
    await waitFor(() => expect(reactivateAdminUserMock).toHaveBeenCalledWith('user-1', 'Reativação confirmada pelo administrador.'));

    confirm.mockReturnValue(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Encerrar sessões' }));
    expect(revokeAdminUserSessionsMock).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sessões' }));
    expect(await screen.findByText('2 sessão(ões) encerrada(s).')).toBeInTheDocument();
  });

  it('shows the server error instead of a silent failure on user actions', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    suspendAdminUserMock.mockRejectedValue(new Error('A conta não está ativa.'));
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Usuários' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Editor Local' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Suspender usuário' }));
    expect(await screen.findByText('A conta não está ativa.')).toBeInTheDocument();
  });

  it('embeds the existing access screen without replacing it', () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Acessos por Função' }));
    expect(screen.getByText('Tela atual preservada')).toBeInTheDocument();
  });

  it('exposes every administration area from the approved specification', () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    ['Acervo', 'Gestão', 'Cadastros', 'Integrações', 'Configurações'].forEach((name) => {
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
    expect(await screen.findByLabelText('Navegação principal da Administração')).toBeInTheDocument();
    expect(screen.queryByLabelText('Áreas relacionadas')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acervo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Navegação principal da Administração')).toContainElement(screen.getByRole('button', { name: 'Acervo' }));
  });

  it('uses a representative icon in every administration navigation area', async () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    const navigation = await screen.findByLabelText('Navegação principal da Administração');
    const buttons = Array.from(navigation.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(10);
    buttons.forEach((button) => expect(button.querySelector('svg')).not.toBeNull());
  });

  it.each([
    ['Equipes', 'Equipes / Setores / Unidades', 'Membros da equipe'],
    ['Formulários', 'Formulários', 'Pré-visualização do formulário'],
    ['Importações', 'Importação de Dados', 'Mapeamento de colunas'],
  ])('renders a reference-shaped %s screen', async (tab, heading, landmark) => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: tab }));
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: landmark })).toBeInTheDocument();
    expect(screen.getByText(/dados de demonstração visual/i)).toBeInTheDocument();
  });

  it('provides the complete security policy navigation from the reference', async () => {
    readLocalDemoSessionMock.mockReturnValue({ id: 'demo-superadmin', selected_tenant_id: 'mediamind-demo' });
    render(<MemoryRouter initialEntries={['/administration2?tab=security']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Política de segurança' })).toBeInTheDocument();
    ['Autenticação', 'Senha', 'Sessões', 'Bloqueios', 'Convites'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Senha' }));
    expect(screen.getByRole('heading', { name: 'Política de senha' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Convites' }));
    expect(screen.getByRole('heading', { name: 'Política de convites' })).toBeInTheDocument();
  });

  it('opens security actions in a sliding contextual drawer', async () => {
    readLocalDemoSessionMock.mockReturnValue({ id: 'demo-superadmin', selected_tenant_id: 'mediamind-demo' });
    render(<MemoryRouter initialEntries={['/administration2?tab=security']}><Administration2 /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Configurar MFA' }));
    expect(screen.getByRole('dialog', { name: 'Configurar MFA' })).toBeInTheDocument();
    expect(screen.getByText(/alterações desta demonstração ficam somente/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));
    expect(screen.queryByRole('dialog', { name: 'Configurar MFA' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver todas as sessões' })[0]);
    expect(screen.getByRole('dialog', { name: 'Sessões ativas' })).toBeInTheDocument();
  });

  it.each([
    ['Visão Geral', 'Ações rápidas', 'Últimas ações administrativas'],
    ['Usuários', 'Convites pendentes', 'Acessos expirando'],
    ['Perfis e Funções', 'Módulos liberados', 'Matriz resumida de permissões'],
    ['Permissões', 'Resumo do perfil', 'Alterações recentes'],
  ])('renders the main reference landmarks for %s', async (tab, firstLandmark, secondLandmark) => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    if (tab !== 'Visão Geral') fireEvent.click(screen.getByRole('button', { name: tab }));
    expect(await screen.findByRole('heading', { name: firstLandmark })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: secondLandmark })).toBeInTheDocument();
  });

  it.each([
    ['Telas e Módulos', 'Registro de telas e módulos', 'Hierarquia do produto'],
    ['Cadastros', 'Cadastros administrativos', 'Entidades cadastradas'],
    ['Integrações', 'Integrações', 'Saúde das integrações'],
    ['Configurações', 'Configurações administrativas', 'Identidade da organização'],
  ])('renders a structured %s screen instead of an empty placeholder', async (tab, heading, landmark) => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: tab }));
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: landmark })).toBeInTheDocument();
    expect(screen.queryByText('Área em preparação')).not.toBeInTheDocument();
  });

  it('does not present invented catalog and integration totals as real data', async () => {
    render(<MemoryRouter initialEntries={['/administration2?tab=registry']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Registro de telas e módulos' })).toBeInTheDocument();
    expect(screen.queryByText('142')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Integrações' }));
    expect(await screen.findByRole('heading', { name: 'Integrações' })).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma integração validada por esta tela/)).toBeInTheDocument();
  });

  it('hides the real-data seal on tabs that declare demonstration data', async () => {
    render(<MemoryRouter initialEntries={['/administration2?tab=users']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByText('Dados reais do tenant selecionado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Versão anterior' })).toBeInTheDocument();
    expect(screen.queryByText('Anterior +1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Formulários' }));
    expect(await screen.findByRole('heading', { name: 'Formulários' })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-data-seal')).not.toBeInTheDocument();
  });

  it('opens the matching tab from an overview indicator', async () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Perfis.*Ver perfis/s }));
    expect(await screen.findByRole('heading', { name: 'Matriz resumida de permissões' })).toBeInTheDocument();
  });

  it('keeps the previous users view with server-side filters and the reserved detail tabs', async () => {
    render(<MemoryRouter initialEntries={['/administration2?tab=users']}><Administration2 /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Versão anterior' }));
    fireEvent.change(screen.getByLabelText('Filtrar por status'), { target: { value: 'suspended' } });
    fireEvent.change(screen.getByPlaceholderText('Buscar nome ou e-mail'), { target: { value: 'editor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    await waitFor(() => expect(listAdminUsersMock).toHaveBeenLastCalledWith({ page: 1, pageSize: 100, search: 'editor', status: 'suspended' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Ver Editor Local' }));
    expect(await screen.findByRole('heading', { name: 'Editor Local' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atividade' }));
    expect(screen.getByText('Área em preparação')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← Voltar para usuários' }));
    expect(await screen.findByLabelText('Filtrar por status')).toBeInTheDocument();
  });

  it('filters the previous users view locally in the demo session', async () => {
    readLocalDemoSessionMock.mockReturnValue({ id: 'demo-superadmin', selected_tenant_id: 'mediamind-demo' });
    render(<MemoryRouter initialEntries={['/administration2?tab=users']}><Administration2 /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Versão anterior' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar nome ou e-mail'), { target: { value: 'administrador demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    expect(await screen.findByRole('button', { name: 'Ver Administrador Demo' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Ver / })).toHaveLength(1);
    expect(listAdminUsersMock).not.toHaveBeenCalled();
  });

  it('never shows invented overview numbers for a real tenant', async () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText('Ações rápidas')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.queryByText('1 usuário ainda não está vinculado a uma equipe')).not.toBeInTheDocument();
    // 3 indicadores sem fonte (equipes, formulários, importações) + MFA, sessões e senha.
    expect(screen.getAllByText('Não integrado')).toHaveLength(6);
    expect(screen.getByText('Operacional')).toBeInTheDocument();
  });

  it('follows the reference overview layout with honest quick actions', async () => {
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Ações rápidas' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Administração' })).not.toBeInTheDocument();
    ['Novo usuário', 'Convidar usuário', 'Novo perfil', 'Nova importação', 'Novo formulário'].forEach((name) => {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeDisabled();
    });
  });

  it('does not present zeros as real when the users list could not be loaded', async () => {
    listAdminUsersMock.mockRejectedValueOnce(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Sem acesso.' }));
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText(/Convites, bloqueios e acessos não verificados/)).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma conta bloqueada no tenant')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum convite pendente')).not.toBeInTheDocument();
    expect(screen.getAllByText('Não verificado').length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole('button', { name: 'Ver perfis' }));
    expect(await screen.findByRole('heading', { name: 'Matriz resumida de permissões' })).toBeInTheDocument();
  });

  it('says profiles are unavailable when the permission groups fail to load', async () => {
    listPermissionGroups.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter initialEntries={['/administration2?tab=profiles']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByText(/Perfis indisponíveis/)).toBeInTheDocument();
    expect(screen.queryByText('Nenhum perfil cadastrado neste tenant.')).not.toBeInTheDocument();
  });

  it('ignores an unknown status filter in the URL instead of hiding every user', async () => {
    render(<MemoryRouter initialEntries={['/administration2?tab=users&status=xyz']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByLabelText('Filtrar usuários por status')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Ver Editor Local' })).toBeInTheDocument();
  });

  it('counts only active users as active and opens the audit history', async () => {
    listAdminUsersMock.mockResolvedValue({ items: [{ ...USER, status: 'suspended' }], total: 1, page: 1, page_size: 25 });
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    const indicator = await screen.findByRole('button', { name: /Usuários ativos/ });
    expect(indicator).toHaveTextContent('Usuários ativos0');
  });

  it('opens the users tab already filtered from an overview alert', async () => {
    listAdminUsersMock.mockResolvedValue({
      items: [USER, { ...USER, id: 'user-3', full_name: 'Bloqueado Real', email: 'bloq@mediamind.ai', status: 'blocked' }],
      total: 2, page: 1, page_size: 25,
    });
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /1 conta\(s\) bloqueada\(s\)/ }));
    expect(await screen.findByLabelText('Filtrar usuários por status')).toHaveValue('blocked');
    expect(screen.getByRole('button', { name: 'Ver Bloqueado Real' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver Editor Local' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usuários' }));
    expect(await screen.findByLabelText('Filtrar usuários por status')).toHaveValue('');
  });

  it('names the actor of each recent administrative action', async () => {
    listAdminActivityMock.mockResolvedValue([
      { id: 'a1', action: 'user.suspended', entity_type: 'User', user_id: 'user-1', created_date: new Date(Date.now() - 5 * 60000).toISOString() },
      { id: 'a2', action: 'custom.event', entity_type: '', user_id: 'desconhecido', created_date: null },
    ]);
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText('suspendeu o usuário')).toBeInTheDocument();
    expect(screen.getByText('Editor Local')).toBeInTheDocument();
    expect(screen.getByText('Há 5 min')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getByText('horário não informado')).toBeInTheDocument();
  });

  it('marks the audit status as unverified when the activity feed fails', async () => {
    listAdminActivityMock.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText('Não verificada')).toBeInTheDocument();
    expect(screen.queryByText('Operacional')).not.toBeInTheDocument();
  });

  it('keeps the demonstration overview numbers only in the local demo session', async () => {
    readLocalDemoSessionMock.mockReturnValue({ id: 'demo-superadmin', selected_tenant_id: 'mediamind-demo' });
    render(<MemoryRouter><Administration2 /></MemoryRouter>);
    expect(await screen.findByText('1 usuário ainda não está vinculado a uma equipe')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('shows only tenant data in security outside the demo session', async () => {
    listAdminUsersMock.mockResolvedValue({
      items: [USER, { ...USER, id: 'user-2', full_name: 'Convidada Real', email: 'convite@mediamind.ai', status: 'invited' }, { ...USER, id: 'user-3', full_name: 'Bloqueado Real', email: 'bloq@mediamind.ai', status: 'blocked' }],
      total: 3, page: 1, page_size: 25,
    });
    render(<MemoryRouter initialEntries={['/administration2?tab=security']}><Administration2 /></MemoryRouter>);
    const indicators = await screen.findByLabelText('Indicadores de segurança');
    await waitFor(() => expect(indicators).toHaveTextContent('Usuários bloqueados1'));
    expect(indicators).toHaveTextContent('Convites pendentes1');
    expect(indicators).toHaveTextContent('MFA Ativo—');
    expect(screen.queryByText('78%')).not.toBeInTheDocument();
    expect(screen.queryByText('189.124.5.10')).not.toBeInTheDocument();
    expect(screen.queryByText('Encerrar todas as sessões')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'MFA para Superadmin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Configurar MFA' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Convites pendentes/ }));
    const dialog = screen.getByRole('dialog', { name: 'Convites pendentes' });
    expect(dialog).toHaveTextContent('Convidada Real');
    expect(screen.getByRole('button', { name: 'Reenviar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));

    // Fora do demo, o que não tem dado real fica desabilitado com o motivo (não abre painel vazio).
    for (const name of ['Ver todas as sessões', 'Ver todos os logs', 'Ver mais']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /Ver auditoria de segurança/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /MFA Ativo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Usuários bloqueados/ })).toBeEnabled();
  });

  it('keeps the security demonstration data inside the local demo session', async () => {
    readLocalDemoSessionMock.mockReturnValue({ id: 'demo-superadmin', selected_tenant_id: 'mediamind-demo' });
    render(<MemoryRouter initialEntries={['/administration2?tab=security']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByText('78%')).toBeInTheDocument();
    expect(screen.getAllByText('189.124.5.10').length).toBeGreaterThan(0);
    expect(screen.getByRole('switch', { name: 'MFA para Superadmin' })).toBeEnabled();
  });

  it('lists the real permission groups in profiles with their linked users', async () => {
    listPermissionGroups.mockResolvedValueOnce(GROUPS);
    listAdminUsersMock.mockResolvedValue({ items: [{ ...USER, profile_id: 'g-editors', tenant_role: 'editor' }], total: 1, page: 1, page_size: 25 });
    render(<MemoryRouter initialEntries={['/administration2?tab=profiles']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Editores Reais' })).toBeInTheDocument();
    expect(screen.queryByText('Editor Broadcast')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo perfil' })).toBeDisabled();
    expect(screen.getAllByText('users')).toHaveLength(2);
    expect(screen.getByText('manage')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver usuários/ }));
    expect(screen.getByRole('dialog', { name: 'Usuários de Editores Reais' })).toHaveTextContent('Editor Local');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));

    fireEvent.click(screen.getByRole('button', { name: /Leitura Real/ }));
    expect(screen.getByRole('heading', { name: 'Leitura Real' })).toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
    expect(screen.getByText('Nenhum usuário vinculado a este perfil.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar perfil...'), { target: { value: 'inexistente' } });
    expect(screen.getByText('Nenhum perfil corresponde à busca.')).toBeInTheDocument();
  });

  it('builds the permission matrix from the real groups and their critical codes', async () => {
    listPermissionGroups.mockResolvedValueOnce(GROUPS);
    render(<MemoryRouter initialEntries={['/administration2?tab=permissions']}><Administration2 /></MemoryRouter>);
    expect(await screen.findByText('Perfil: Editores Reais')).toBeInTheDocument();
    expect(screen.queryByText('Gestor de Acervo')).not.toBeInTheDocument();
    expect(screen.getAllByText('✓ Permitido')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Perfil'), { target: { value: 'g-readers' } });
    expect(screen.getByText('Perfil: Leitura Real')).toBeInTheDocument();
    expect(screen.getByText('users.manage').nextSibling).toHaveTextContent('Negado');

    fireEvent.change(screen.getByLabelText('Módulo'), { target: { value: 'assets' } });
    expect(screen.queryByRole('button', { name: 'Permissões de users' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Permissões de assets' }));
    expect(screen.getByRole('dialog', { name: 'Permissões de assets' })).toHaveTextContent('assets.view');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }));

    fireEvent.change(screen.getByPlaceholderText('Buscar permissão, módulo ou ação...'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhum módulo corresponde aos filtros.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '↻ Limpar filtros' }));
    expect(screen.getByRole('button', { name: 'Permissões de users' })).toBeInTheDocument();
  });

  it('loads, validates and persists organization settings through the backend', async () => {
    render(<MemoryRouter initialEntries={['/administration2?tab=settings']}><Administration2 /></MemoryRouter>);
    const organization = await screen.findByLabelText('Nome da organização');
    expect(organization).toHaveValue('MediaMind AI');
    fireEvent.change(organization, { target: { value: 'MediaMind Corp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));
    await waitFor(() => expect(updateAdminSettingsMock).toHaveBeenCalledWith(expect.objectContaining({ organization_name: 'MediaMind Corp' })));
    expect(await screen.findByText('Configurações salvas e auditadas.')).toBeInTheDocument();
  });
});
