import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Workspace2 from './Workspace2';

const mediaApi = vi.hoisted(() => ({
  listMediaAssets: vi.fn(),
  uploadMediaAsset: vi.fn(),
}));

vi.mock('../../api/media', () => ({
  ...mediaApi,
  mediaStreamUrl: (asset) => asset.stream_url,
}));

describe('Workspace 2 flow', () => {
  beforeEach(() => {
    localStorage.clear();
    mediaApi.listMediaAssets.mockReset().mockResolvedValue([]);
    mediaApi.uploadMediaAsset.mockReset();
  });
  it('goes from media selection to the simplified creation screen and then the editor', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Nome do arquivo'), { target: { value: 'enchente' } });
    fireEvent.click(screen.getByRole('button', { name: /2\s*Criar/i }));
    expect(screen.getByRole('heading', { name: 'Como você quer criar seu roteiro?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Pesquisa de mídias persistente')).toHaveValue('enchente');
    expect(screen.queryByRole('heading', { name: 'Últimos rascunhos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Modelos sugeridos' })).not.toBeInTheDocument();
    expect(screen.getByText('Informações iniciais')).toBeInTheDocument();
    expect(screen.getByText('Montar roteiro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir roteiro existente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir rascunho existente/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /A partir de mídia/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar para montar/i }));

    expect(screen.getByTestId('workspace2-script')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Biblioteca do roteiro' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Preview da mídia' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Roteiro editável' })).toBeInTheDocument();
  }, 10000);

  it('shows demonstrative media and numbered script blocks when the archive is unavailable', async () => {
    mediaApi.listMediaAssets.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /3\s*Roteiro/i }));

    expect((await screen.findAllByText('Entrevista Prefeito')).length).toBeGreaterThan(0);
    expect(screen.getByRole('article', { name: /Bloco 1:/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Detalhes do bloco 1/i })).toBeInTheDocument();
  });
  it('keeps the media search while navigating to scripts, creation and the editor', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Workspace 2' })).toBeInTheDocument();
    expect(screen.getByTestId('workspace2-search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar mídias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Travar' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome do arquivo'), { target: { value: 'enchente' } });
    fireEvent.click(screen.getByRole('button', { name: /2\s*criar/i }));
    expect(screen.getByLabelText('Pesquisa de mídias persistente')).toHaveValue('enchente');

    fireEvent.click(screen.getByRole('button', { name: /3\s*roteiro/i }));
    expect(screen.getByTestId('workspace2-script')).toBeInTheDocument();
    expect(screen.getByLabelText('Pesquisa rápida de mídias')).toHaveValue('enchente');
    expect(screen.getByRole('region', { name: 'Preview da mídia' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /4\s*timeline/i }));
    expect(localStorage.getItem('mm_workspace2_timeline2_draft')).toContain('tracks');
  });

  it('uses the global toolbar to show and hide search and preview across Workspace steps', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Ocultar pesquisa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prévia' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar pesquisa' }));
    expect(screen.getByRole('button', { name: 'Mostrar pesquisa' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome do arquivo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /2\s*Criar/i }));
    expect(screen.queryByRole('complementary', { name: 'Pesquisa e seleção de mídias' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prévia' }));
    expect(screen.queryByRole('complementary', { name: 'Contexto da criação' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /3\s*Roteiro/i }));
    expect(screen.queryByRole('complementary', { name: 'Biblioteca do roteiro' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Preview da mídia' })).not.toBeInTheDocument();
  });

  it('saves and resets the local Workspace 2 draft', () => {
    localStorage.clear();
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar projeto' }));
    expect(localStorage.getItem('mm_workspace2_draft')).toContain('selectedIds');
    expect(screen.getByRole('status')).toHaveTextContent(/salvo localmente/i);
    fireEvent.click(screen.getByRole('button', { name: 'Resetar projeto' }));
    expect(screen.getByRole('status')).toHaveTextContent(/restaurado/i);
  });

  it('prepares the shared project and opens Timeline 2', () => {
    localStorage.clear();
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /4\s*timeline/i }));

    const saved = JSON.parse(localStorage.getItem('mm_workspace2_timeline2_draft'));
    expect(saved.name).toBe('Jornal 12h - 15/05/2026');
    expect(saved.tracks).toHaveLength(5);
  });

  it('shows an expandable upload receipt with file, storage, protocol and SHA-256', async () => {
    mediaApi.uploadMediaAsset.mockResolvedValue({
      id: '51acbd30-7da0-4f58-b7b5-651f8af72af1', filename: 'entrevista final.mp4',
      title: 'Entrevista final', asset_type: 'video', mime_type: 'video/mp4', file_size: 123456,
      sha256: 'c986372cb64bb5d854d6d97a58e6a893564850db144f18b23daea00fcb72d5a5',
      stream_url: '/api/v1/media/assets/51acbd30-7da0-4f58-b7b5-651f8af72af1/stream',
      created_date: '2026-09-29T21:37:00Z', media_status: 'uploaded',
    });
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    const file = new File(['conteudo-real'], 'entrevista final.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('Importar mídias'), { target: { files: [file] } });

    expect(await screen.findByText('Upload confirmado')).toBeInTheDocument();
    expect(screen.getByText('entrevista final.mp4')).toBeInTheDocument();
    expect(screen.getByText(/MM-51ACBD30-C986372C/)).toBeInTheDocument();
    expect(screen.getByText(/c986372cb64bb5d/)).toBeInTheDocument();
    expect(screen.getByText(/Armazenamento local persistente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar comprovantes de upload' }));
    expect(screen.queryByText('entrevista final.mp4')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar comprovantes de upload' })).toBeInTheDocument();
  });
});
