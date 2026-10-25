import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { overview } = vi.hoisted(() => ({ overview: vi.fn() }));
vi.mock('../../api/management', () => ({ getManagementOverview: (...args) => overview(...args) }));

import { ConfigView, pipelineBadge } from './Ingest';

const base = {
  publications: { published: 0, scheduled: 0, pending: 0, approval_rate: 0, calendar: [] },
  social_metrics: [], assets: { total: 3, indexed: 0, failures: 0, storage_bytes: 5e9 },
  processing: { total: 0, active: 0, completed: 0, failed: 0 }, audit_events: 0,
};

describe('Ingest › Configurações sem dado inventado (A1)', () => {
  beforeEach(() => { overview.mockReset(); localStorage.removeItem('mm_demo_session_v1'); });

  it('selo segue a API: ativo, inativo e não configurado; sem 72% nem caminho fixo', async () => {
    overview.mockResolvedValue({ ...base, services: [{ key: 'transcription', status: 'ok', detail: 'Whisper respondendo' }, { key: 'ocr', status: 'error', detail: 'OCR sem resposta' }] });
    render(<ConfigView />);
    expect(await screen.findByText('Ativo')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-transcription')).toHaveTextContent('Ativo');
    expect(screen.getByTestId('pipeline-ocr')).toHaveTextContent('Indisponível');
    expect(screen.getByTestId('pipeline-object_detection')).toHaveTextContent('Não configurado');
    expect(screen.getByText('5.0 GB')).toBeInTheDocument();
    expect(screen.queryByText('72%')).toBeNull();
    expect(screen.queryByText('/data/storage')).toBeNull();
  });

  it('erro na consulta mostra aviso, "Status indisponível" e permite tentar de novo', async () => {
    overview.mockRejectedValueOnce(new Error('Sem conexão')).mockResolvedValue({ ...base, services: [] });
    render(<ConfigView />);
    expect(await screen.findByText(/Não foi possível consultar o status real: Sem conexão/)).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-transcription')).toHaveTextContent('Status indisponível');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findAllByText('Não configurado')).toHaveLength(3);
  });

  it('pipelineBadge cobre todos os estados', () => {
    expect(pipelineBadge(null, 'x').label).toBe('Status indisponível');
    expect(pipelineBadge(undefined, '').label).toBe('Não configurado');
    expect(pipelineBadge({ status: 'ok' }, '').label).toBe('Ativo');
    expect(pipelineBadge({ status: 'degraded' }, '').label).toBe('Indisponível');
  });
});
