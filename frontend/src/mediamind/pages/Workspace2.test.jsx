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
  it('opens in search and navigates through script, preview and the Timeline 2 entry', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Workspace 2' })).toBeInTheDocument();
    expect(screen.getByTestId('workspace2-search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar mídias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Travar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2\s*roteiro/i }));
    expect(screen.getByTestId('workspace2-script')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /3\s*prévia/i }));
    expect(screen.getByTestId('workspace2-preview')).toBeInTheDocument();
    expect(screen.queryByText('Cortar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir Timeline' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /4\s*timeline/i }));
    expect(localStorage.getItem('mm_workspace2_timeline2_draft')).toContain('tracks');
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
