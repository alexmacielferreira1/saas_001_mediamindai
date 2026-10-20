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
