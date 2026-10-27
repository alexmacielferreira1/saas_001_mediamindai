import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listIngestPackages, retryIngestPackage, runIngestPackage } = vi.hoisted(() => ({
  listIngestPackages: vi.fn(), retryIngestPackage: vi.fn(), runIngestPackage: vi.fn(),
}));
vi.mock('../../api/ingest', () => ({
  listIngestPackages: (...args) => listIngestPackages(...args),
  retryIngestPackage: (...args) => retryIngestPackage(...args),
  runIngestPackage: (...args) => runIngestPackage(...args),
  getIngestSource: () => Promise.resolve({ source_folder: 'D:/Entrada', truncated: false, files: [] }),
  createIngestPackage: vi.fn(),
}));

import Ingest from './Ingest';

const PACKAGES = [
  { id: 'a', name: 'Cobertura', status: 'processing', progress: 50, file_count: 2, owner: 'ana@emissora', created_date: '2026-10-27T13:00:00Z', items: [{ status: 'imported' }, { status: 'pending' }] },
  { id: 'b', name: 'Arquivo antigo', status: 'failed', progress: 100, file_count: 1, owner: 'ana@emissora', created_date: 'sem data', items: [{ status: 'failed', error: 'O arquivo não está mais na pasta de referência.' }] },
  { id: 'c', name: 'Pronto', status: 'completed', progress: 100, file_count: 3, owner: 'ana@emissora', created_date: '2026-10-26T10:00:00Z', items: [] },
];

function open(menu) {
  render(<MemoryRouter><Ingest /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(menu) }));
}

describe('Ingest › pacotes reais do servidor', () => {
  beforeEach(() => {
    localStorage.removeItem('mm_demo_session_v1');
    for (const mock of [listIngestPackages, retryIngestPackage, runIngestPackage]) mock.mockReset();
    listIngestPackages.mockResolvedValue(PACKAGES);
  });

  it('conta e lista os pacotes do servidor por estado, sem os pacotes de exemplo', async () => {
    open('Concluídas');
    expect(await screen.findByText('Pronto')).toBeInTheDocument();
    expect(screen.getByText('3 arquivos')).toBeInTheDocument();
    expect(screen.queryByText('Festival de Inovação — Cobertura')).toBeNull();
    expect(screen.queryByRole('button', { name: /Continuar|Reprocessar/ })).toBeNull();
  });

  it('continua um pacote parado e atualiza o progresso', async () => {
    let finish;
    runIngestPackage.mockImplementation((pkg, { onUpdate }) => {
      onUpdate({ ...pkg, progress: 75 });
      return new Promise((resolve) => { finish = resolve; });
    });
    open('Em andamento');
    expect(await screen.findByText('Parado — clique em Continuar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(await screen.findByText('Copiando para a pasta de destino')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(retryIngestPackage).not.toHaveBeenCalled();
    listIngestPackages.mockResolvedValue([{ ...PACKAGES[0], status: 'completed' }]);
    await act(async () => finish({ ...PACKAGES[0], status: 'completed' }));
    await waitFor(() => expect(screen.getByText('0 pacotes')).toBeInTheDocument());
  });

  it('reprocessa falhas mostrando o motivo real e avisa se não conseguir', async () => {
    retryIngestPackage.mockResolvedValue({ ...PACKAGES[1], status: 'processing' });
    runIngestPackage.mockRejectedValue(new Error('Servidor fora do ar'));
    open('Falhas');
    expect(await screen.findByText('1 arquivo(s) com falha: O arquivo não está mais na pasta de referência.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reprocessar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível continuar "Arquivo antigo": Servidor fora do ar');
    expect(retryIngestPackage).toHaveBeenCalledWith('b');
  });

  it('mostra erro ao carregar e textos padrão para falha sem detalhe', async () => {
    listIngestPackages.mockRejectedValueOnce({});
    open('Falhas');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os pacotes.');
    listIngestPackages.mockResolvedValue([{ ...PACKAGES[1], items: [{ status: 'failed' }] }, { ...PACKAGES[1], id: 'd', items: undefined }]);
    retryIngestPackage.mockRejectedValue({});
    fireEvent.click(screen.getByRole('button', { name: /Em andamento/ }));
    fireEvent.click(screen.getByRole('button', { name: /Falhas/ }));
    expect(await screen.findByText('1 arquivo(s) com falha: erro desconhecido')).toBeInTheDocument();
    expect(screen.getByText('Falha no processamento')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Reprocessar/ })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('erro desconhecido');
  });

  it('mostra a transcrição de cada pacote e retoma a que ficou pendente', async () => {
    listIngestPackages.mockResolvedValue([
      { ...PACKAGES[2], id: 'p1', name: 'Pendente', transcription_pending: 2 },
      { ...PACKAGES[2], id: 'p2', name: 'Falhou', items: [{ status: 'imported', transcription: 'failed', transcription_error: 'Nenhum transcritor foi configurado.' }] },
      { ...PACKAGES[2], id: 'p3', name: 'Feito', items: [{ status: 'imported', transcription: 'done' }, { status: 'imported', transcription: 'failed' }] },
      { ...PACKAGES[2], id: 'p4', name: 'Feito 2', items: [{ status: 'imported', transcription: 'done' }] },
    ]);
    runIngestPackage.mockResolvedValue({ ...PACKAGES[2], id: 'p1', transcription_pending: 0 });
    open('Concluídas');
    expect(await screen.findByText('Transcrição pendente: 2 arquivo(s)')).toBeInTheDocument();
    expect(screen.getByText('Transcrição falhou em 1: Nenhum transcritor foi configurado.')).toBeInTheDocument();
    expect(screen.getByText('Transcrição falhou em 1: erro desconhecido')).toBeInTheDocument();
    expect(screen.getByText('Transcrito: 1 arquivo(s)')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /Continuar/ });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(runIngestPackage).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), expect.anything()));
  });

  it('na demonstração sem banco mantém os pacotes de exemplo e não chama o servidor', () => {
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({ id: 'demo' }));
    open('Concluídas');
    const list = screen.getByText('Festival de Inovação — Cobertura').closest('div');
    expect(within(list).getByText('Festival de Inovação — Cobertura')).toBeInTheDocument();
    expect(screen.getByText('2026-09-10 14:00')).toBeInTheDocument();
    expect(listIngestPackages).not.toHaveBeenCalled();
  });
});
