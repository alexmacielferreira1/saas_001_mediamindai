import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAsset = vi.fn();
const uploadMediaAsset = vi.fn();

vi.mock('../../api/media', () => ({ uploadMediaAsset: (...args) => uploadMediaAsset(...args) }));
vi.mock('../../api/uploads', () => ({ uploadFile: vi.fn() }));
vi.mock('../../api/base44Client', () => ({ base44: { entities: { Asset: { create: (...args) => createAsset(...args) } } } }));

import IngestNewPackage from './IngestNewPackage';

describe('nova ingestão funcional', () => {
  beforeEach(() => {
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({ id: 'demo' }));
    uploadMediaAsset.mockResolvedValue({ id: 'media-1', stream_url: '/api/v1/media/local/assets/media-1/stream', sha256: 'abc' });
    createAsset.mockResolvedValue({ id: 'asset-1' });
  });

  it('permite pacote sem nome e usa o upload local funcional no modo demo', async () => {
    render(<MemoryRouter><IngestNewPackage /></MemoryRouter>);
    const file = new File(['video'], 'entrevista.mp4', { type: 'video/mp4' });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /Criar pacote e continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Criar pacote e continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Iniciar envio/i }));

    await waitFor(() => expect(uploadMediaAsset).toHaveBeenCalledWith(file));
    expect(createAsset).toHaveBeenCalledWith(expect.objectContaining({
      package_name: null,
      media_asset_id: 'media-1',
      file_url: '/api/v1/media/local/assets/media-1/stream',
    }));
  });
});
