import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { overview } = vi.hoisted(() => ({ overview: vi.fn() }));
vi.mock('../../api/management', () => ({ getManagementOverview: (...args) => overview(...args) }));
vi.mock('../../api/permissions', () => ({ listMemberships: vi.fn().mockResolvedValue([]) }));
vi.mock('../lib/producaoStore', () => ({ useProducaoProjetos: () => [] }));
vi.mock('../components/management/IndicadoresPipelinePanel', () => ({ default: () => null }));

import { DashboardsTab, ReportsTab } from './Management';

const REAL = {
  publications: { published: 1, scheduled: 0, pending: 2, approval_rate: 33, calendar: [] },
  social_metrics: [], assets: { total: 4, indexed: 0, failures: 0, storage_bytes: 10 },
  processing: { total: 0, active: 0, completed: 0, failed: 0 }, audit_events: 0, services: [],
};

describe('Gestão — erro real em vez de demo (achado 15)', () => {
  beforeEach(() => { localStorage.removeItem('mm_demo_session_v1'); overview.mockReset(); });

  it('Visão gerencial: erro com "Tentar de novo" e depois os dados reais', async () => {
    overview.mockRejectedValueOnce(new Error('Servidor fora')).mockResolvedValue(REAL);
    render(<MemoryRouter><DashboardsTab /></MemoryRouter>);
    expect(await screen.findByText('Servidor fora')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Itens no acervo')).toBeInTheDocument();
    expect(overview).toHaveBeenCalledTimes(2);
  });

  it('Relatórios: erro visível, sem números de exemplo', async () => {
    overview.mockRejectedValue(new Error('Sem conexão'));
    render(<MemoryRouter><ReportsTab /></MemoryRouter>);
    expect(await screen.findByText('Sem conexão')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
