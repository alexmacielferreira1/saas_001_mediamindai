import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assetList, overview } = vi.hoisted(() => ({ assetList: vi.fn(), overview: vi.fn() }));
vi.mock('@/api/base44Client', () => ({
  base44: { entities: { Asset: { list: (...args) => assetList(...args) }, LogAuditoria: { list: vi.fn().mockResolvedValue([]) } } },
}));
vi.mock('../../api/management', () => ({ getManagementOverview: (...args) => overview(...args) }));
vi.mock('../../api/permissions', () => ({ listMemberships: vi.fn().mockRejectedValue(new Error('403')), updateMembershipScreens: vi.fn() }));

import Acervo from './Acervo';
import { DEMO_ASSETS } from '../lib/managementDemoData';

const EMPTY_OVERVIEW = {
  publications: { published: 0, scheduled: 0, pending: 0, approval_rate: 0, calendar: [] },
  social_metrics: [], assets: { total: 0, indexed: 0, failures: 0, storage_bytes: 0 },
  processing: { total: 0, active: 0, completed: 0, failed: 0 }, audit_events: 0, services: [],
};

describe('Acervo — sem dados de exemplo fora da sessão demo (achado 15)', () => {
  beforeEach(() => {
    localStorage.removeItem('mm_demo_session_v1');
    assetList.mockReset();
    overview.mockReset().mockResolvedValue(EMPTY_OVERVIEW);
  });

  it('empresa nova vê Total 0 e nenhuma linha de exemplo', async () => {
    assetList.mockResolvedValue([]);
    render(<MemoryRouter><Acervo /></MemoryRouter>);
    expect(await screen.findByText('Total de arquivos')).toBeInTheDocument();
    expect(screen.queryByText(DEMO_ASSETS[0].title)).toBeNull();
    expect(screen.queryByText(DEMO_ASSETS[0].filename)).toBeNull();
  });

  it('falha ao listar arquivos mostra erro e "Tentar de novo" carrega os reais', async () => {
    assetList.mockRejectedValueOnce(new Error('Servidor fora')).mockResolvedValue([{ id: 'r1', title: 'Mídia real', filename: 'real.mp4', asset_type: 'video', file_size: 10 }]);
    render(<MemoryRouter><Acervo /></MemoryRouter>);
    expect(await screen.findByText(/Não foi possível carregar o acervo: Servidor fora/)).toBeInTheDocument();
    expect(screen.queryByText(DEMO_ASSETS[0].title)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findAllByText('Mídia real')).not.toHaveLength(0);
  });

  it('sem visão gerencial liberada, os totais vêm da própria lista (sem demo)', async () => {
    overview.mockRejectedValue(new Error('Sem permissão'));
    assetList.mockResolvedValue([{ id: 'r1', title: 'Mídia real', filename: 'real.mp4', asset_type: 'video', file_size: 10 }]);
    render(<MemoryRouter><Acervo /></MemoryRouter>);
    expect(await screen.findByText(/Indicadores gerenciais indisponíveis/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(DEMO_ASSETS[0].title)).toBeNull());
  });
});
