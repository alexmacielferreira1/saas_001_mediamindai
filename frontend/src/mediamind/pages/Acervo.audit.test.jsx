import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auditList } = vi.hoisted(() => ({ auditList: vi.fn() }));
vi.mock('@/api/base44Client', () => ({
  base44: { entities: { Asset: { list: vi.fn().mockResolvedValue([]) }, LogAuditoria: { list: (...args) => auditList(...args) } } },
}));
vi.mock('../../api/management', () => ({ getManagementOverview: vi.fn().mockRejectedValue(new Error('offline')) }));
vi.mock('../../api/permissions', () => ({ listMemberships: vi.fn().mockResolvedValue([]), updateMembershipScreens: vi.fn() }));

import Acervo from './Acervo';
import { DEMO_AUDIT_LOGS } from '../lib/managementDemoData';

const renderAdmin = () => render(<MemoryRouter initialEntries={['/acervo?tab=admin']}><Acervo /></MemoryRouter>);

describe('Acervo — logs de auditoria', () => {
  beforeEach(() => { auditList.mockReset(); });

  it('shows "sem permissão" on 403 instead of demo audit logs', async () => {
    auditList.mockRejectedValue(Object.assign(new Error('Proibido'), { status: 403 }));
    renderAdmin();

    expect(await screen.findByText('Sem permissão para ver a auditoria.')).toBeInTheDocument();
    const demoAction = DEMO_AUDIT_LOGS[0]?.action;
    if (demoAction) expect(screen.queryByText(demoAction)).toBeNull();
    expect(screen.queryByText('Nenhum evento de auditoria.')).toBeNull();
  });

  it('shows the error message on other failures, without fictitious data', async () => {
    auditList.mockRejectedValue(Object.assign(new Error('Servidor fora'), { status: 500 }));
    renderAdmin();

    expect(await screen.findByText('Servidor fora')).toBeInTheDocument();
    const demoAction = DEMO_AUDIT_LOGS[0]?.action;
    if (demoAction) expect(screen.queryByText(demoAction)).toBeNull();
  });

  it('shows an honest empty state when the server has no events', async () => {
    auditList.mockResolvedValue([]);
    renderAdmin();
    expect(await screen.findByText('Nenhum evento de auditoria.')).toBeInTheDocument();
  });
});
