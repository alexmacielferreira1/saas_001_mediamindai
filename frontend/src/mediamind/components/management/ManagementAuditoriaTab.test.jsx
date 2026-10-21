import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }));

vi.mock('@/api/base44Client', () => ({
  base44: { entities: { LogAuditoria: { list: (...args) => listMock(...args) } } },
}));

import ManagementAuditoriaTab, { normalizeAuditLog } from './ManagementAuditoriaTab';

// Formato real devolvido por GET /records/LogAuditoria (serialize + add_audit).
const SERVER_LOGS = [
  { id: 'a1', action: 'user.suspended', entity_type: 'User', entity_id: 'u-9', user_id: 'gestor-1', details: { reason: 'Saiu da empresa' }, created_date: '2026-10-20T10:00:00+00:00' },
  { id: 'a2', action: 'records.bulk_created', entity_type: 'ProducaoProjeto', entity_id: 'bulk', user_id: 'gestor-2', details: { count: 3 }, created_date: '2026-10-20T11:00:00+00:00' },
  { id: 'a3', action: 'record.export_failed', entity_type: 'MediaAsset', entity_id: 'm-1', user_id: 'gestor-1', details: {}, created_date: '2026-10-20T12:00:00+00:00' },
];

describe('ManagementAuditoriaTab', () => {
  beforeEach(() => { listMock.mockReset(); });

  it('shows server audit events using action/entity_type/details/user_id', async () => {
    listMock.mockResolvedValue(SERVER_LOGS);
    render(<ManagementAuditoriaTab />);

    expect(await screen.findByText('user.suspended', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/User #u-9/)).toBeInTheDocument();
    expect(screen.getByText('reason: Saiu da empresa')).toBeInTheDocument();
    expect(screen.getByText('count: 3')).toBeInTheDocument();
    expect(screen.getAllByText('gestor-1')).toHaveLength(2);

    const usuarios = screen.getByText('Usuários').parentElement;
    expect(within(usuarios).getByText('2')).toBeInTheDocument();
    const eventos = screen.getByText('Eventos').parentElement;
    expect(within(eventos).getByText('3')).toBeInTheDocument();
    const erros = screen.getByText('Erros').parentElement;
    expect(within(erros).getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'user.suspended' })).toBeInTheDocument();
  });

  it('still reads legacy acao/entidade/detalhe records', () => {
    expect(normalizeAuditLog({ acao: 'aprovar', entidade: 'Roteiro', detalhe: 'ok', created_by: 'ana@x.com' }))
      .toMatchObject({ acao: 'aprovar', entidade: 'Roteiro', detalhe: 'ok', ator: 'ana@x.com' });
  });

  it('shows "sem permissão" on 403 without demo data', async () => {
    listMock.mockRejectedValue(Object.assign(new Error('Proibido'), { status: 403 }));
    render(<ManagementAuditoriaTab />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão para ver a auditoria.');
    expect(screen.queryByText('Nenhum registro.')).toBeNull();
    const eventos = screen.getByText('Eventos').parentElement;
    expect(within(eventos).getByText('0')).toBeInTheDocument();
  });

  it('reports a load failure instead of an empty "Nenhum registro"', async () => {
    listMock.mockRejectedValue(new Error('Sem permissão'));
    render(<ManagementAuditoriaTab />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a auditoria: Sem permissão');
    expect(screen.queryByText('Nenhum registro.')).toBeNull();
  });

  it('shows before/after/reason/actor_role/correlation_id in the row detail when present', async () => {
    listMock.mockResolvedValue([{
      id: 'a9', action: 'membership.role_changed', entity_type: 'Membership', entity_id: 'm-1', user_id: 'gestor-1',
      details: {}, before: { role: 'editor' }, after: { role: 'reporter' }, reason: 'Troca de equipe',
      actor_role: 'admin', correlation_id: 'corr-42', target_user_id: 'u-7', created_date: '2026-10-20T13:00:00+00:00',
    }]);
    render(<ManagementAuditoriaTab />);

    expect(await screen.findByText(
      'Antes: role: editor · Depois: role: reporter · Motivo: Troca de equipe · Cargo do responsável: admin · Correlação: corr-42',
    )).toBeInTheDocument();
  });

  it('does not repeat a legacy details.reason already shown in the detail', () => {
    const log = normalizeAuditLog({ action: 'user.suspended', details: { reason: 'Saiu' }, reason: 'Saiu', actor_role: 'admin' });
    expect(log.detalhe).toBe('reason: Saiu');
    expect(log.mudanca).toBe('Cargo do responsável: admin');
    expect(normalizeAuditLog({ action: 'x' }).mudanca).toBe('');
  });
});
