import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfilesSection, TeamsSection, UsersSection } from './PeopleAccessSections';

const users = [
  { id: 'u1', full_name: 'Alex Maciel', email: 'alex@empresa.com', tenant_role: 'Administrador', profile_name: 'Administrador', profile_id: 'p1', status: 'active' },
  { id: 'u2', full_name: 'Marina Alves', email: 'marina@empresa.com', tenant_role: 'Produtora', profile_name: 'Editor', profile_id: 'p2', status: 'invited' },
];

describe('PeopleAccessSections', () => {
  it('opens_user_detail_without_removing_the_list', () => {
    render(<UsersSection users={users} total={2} demoMode />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver Alex Maciel' }));

    expect(screen.getByRole('table', { name: 'Usuários do tenant' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Alex Maciel' })).toBeVisible();
  });

  it('preserves_filter_after_closing_detail', () => {
    render(<UsersSection users={users} total={2} demoMode />);
    const search = screen.getByPlaceholderText('Buscar nome, e-mail ou função');
    fireEvent.change(search, { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver Alex Maciel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }));

    expect(search).toHaveValue('Alex');
    expect(screen.getByText('alex@empresa.com')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ver Alex Maciel' })).toHaveFocus();
  });

  it('closes_detail_when_filter_removes_selected_user', () => {
    render(<UsersSection users={users} total={2} demoMode />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver Alex Maciel' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar nome, e-mail ou função'), { target: { value: 'Marina' } });

    expect(screen.queryByRole('heading', { name: 'Alex Maciel' })).not.toBeInTheDocument();
    expect(screen.getByText('marina@empresa.com')).toBeVisible();
  });

  it('does_not_offer_real_account_mutation_in_demo_mode', () => {
    const onSuspend = vi.fn();
    render(<UsersSection users={users} total={2} demoMode onSuspend={onSuspend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver Alex Maciel' }));

    expect(screen.queryByRole('button', { name: 'Suspender usuário' })).not.toBeInTheDocument();
    expect(onSuspend).not.toHaveBeenCalled();
  });

  it('loads_full_user_detail_and_keeps_the_existing_module_and_security_data', async () => {
    const loadUser = vi.fn().mockResolvedValue({ ...users[0], extra_screens: [], restricted_screens: [], failed_login_attempts: 2 });
    render(<UsersSection users={users} total={2} loadUser={loadUser} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver Alex Maciel' }));
    await waitFor(() => expect(loadUser).toHaveBeenCalledWith('u1'));
    fireEvent.click(screen.getByRole('button', { name: 'Módulos' }));
    expect(await screen.findByText('Nenhuma tela extra liberada.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Segurança' }));
    expect(screen.getByText('Tentativas falhas')).toBeVisible();
    expect(screen.getAllByText('2')).toHaveLength(2);
  });

  it('reflects_a_confirmed_suspension_in_the_same_context', async () => {
    const onSuspend = vi.fn().mockResolvedValue({ ...users[0], status: 'suspended' });
    render(<UsersSection users={users} total={2} onSuspend={onSuspend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver Alex Maciel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suspender usuário' }));

    expect((await screen.findAllByText('Suspenso')).length).toBeGreaterThan(0);
  });

  it('opens_linked_user_subdetail_and_returns_to_profile', () => {
    const groups = [{ id: 'p1', name: 'Administrador', description: 'Acesso total', is_active: true, permission_codes: ['admin.manage'] }];
    render(<ProfilesSection groups={groups} users={users} />);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir usuário Alex Maciel' }));
    expect(screen.getByRole('heading', { name: 'Alex Maciel' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao perfil' }));
    expect(screen.getByRole('heading', { name: 'Administrador' })).toBeVisible();
  });

  it('opens_team_member_subdetail_and_returns_to_team', () => {
    render(<TeamsSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir membro Rafael Lima' }));
    expect(screen.getByRole('heading', { name: 'Rafael Lima' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à equipe' }));
    expect(screen.getByRole('heading', { name: 'Audiovisual' })).toBeVisible();
  });
});
