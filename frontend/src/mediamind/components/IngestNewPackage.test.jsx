import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAsset = vi.fn();
const updateAsset = vi.fn();
const uploadMediaAsset = vi.fn();
const uploadMediaAssetWithProgress = vi.fn();
const uploadFile = vi.fn();

vi.mock('../../api/media', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    MEDIA_UPLOAD_LIMIT_BYTES: actual.MEDIA_UPLOAD_LIMIT_BYTES,
    isSupportedMediaFile: actual.isSupportedMediaFile,
    uploadMediaAsset: (...args) => uploadMediaAsset(...args),
    uploadMediaAssetWithProgress: (...args) => uploadMediaAssetWithProgress(...args),
  };
});
vi.mock('../../api/uploads', () => ({ GENERIC_UPLOAD_LIMIT_BYTES: 100 * 1024 * 1024, uploadFile: (...args) => uploadFile(...args) }));
vi.mock('../../api/base44Client', () => ({ base44: { entities: { Asset: { create: (...args) => createAsset(...args), update: (...args) => updateAsset(...args) } } } }));

import IngestNewPackage from './IngestNewPackage';

function startUpload(files) {
  render(<MemoryRouter><IngestNewPackage /></MemoryRouter>);
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files } });
  fireEvent.click(screen.getByRole('button', { name: /Criar pacote e continuar/i }));
  fireEvent.click(screen.getByRole('button', { name: /Criar pacote e continuar/i }));
  fireEvent.click(screen.getByRole('button', { name: /Iniciar envio/i }));
}

describe('nova ingestão funcional', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const mock of [createAsset, updateAsset, uploadMediaAsset, uploadMediaAssetWithProgress, uploadFile]) mock.mockReset();
    createAsset.mockResolvedValue({ id: 'asset-1' });
    updateAsset.mockResolvedValue({ id: 'media-1' });
  });

  it('permite pacote sem nome e usa o upload local funcional no modo demo', async () => {
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({ id: 'demo' }));
    uploadMediaAsset.mockResolvedValue({ id: 'media-1', stream_url: '/api/v1/media/local/assets/media-1/stream', sha256: 'abc' });
    const file = new File(['video'], 'entrevista.mp4', { type: 'video/mp4' });
    startUpload([file]);

    await waitFor(() => expect(uploadMediaAsset).toHaveBeenCalledWith(file));
    expect(createAsset).toHaveBeenCalledWith(expect.objectContaining({
      package_name: null,
      media_asset_id: 'media-1',
      file_url: '/api/v1/media/local/assets/media-1/stream',
    }));
  });

  it('B3: vídeo vai para a rota real de mídia e o pacote é gravado no mesmo Asset (sem /uploads nem Asset sem storage_key)', async () => {
    uploadMediaAssetWithProgress.mockResolvedValue({ id: 'media-1', stream_url: '/api/v1/media/assets/media-1/stream', sha256: 'abc' });
    const file = new File(['video'], 'entrevista.mp4', { type: 'video/mp4' });
    startUpload([file]);

    await waitFor(() => expect(updateAsset).toHaveBeenCalledWith('media-1', expect.objectContaining({ title: 'entrevista.mp4', package_name: null, ai_status: 'pending', file_url: '/api/v1/media/assets/media-1/stream' })));
    expect(uploadMediaAssetWithProgress).toHaveBeenCalledWith(file, { origin: 'ingest' }, expect.objectContaining({ onProgress: expect.any(Function) }));
    expect(uploadFile).not.toHaveBeenCalled();
    expect(createAsset).not.toHaveBeenCalled();
  });

  it('A4: mostra progresso, o motivo da falha por arquivo e reenvia só o que falhou, sem duplicar', async () => {
    let progress;
    let finishGood;
    uploadMediaAssetWithProgress.mockImplementation((file, _meta, { onProgress }) => {
      if (file.name === 'grande.mp4') return Promise.reject(Object.assign(new Error('O arquivo excede o limite permitido.'), { status: 413 }));
      progress = onProgress;
      return new Promise((resolve) => { finishGood = () => resolve({ id: 'media-ok' }); });
    });
    const good = new File(['ok'], 'bom.mp4', { type: 'video/mp4' });
    const bad = new File(['big'], 'grande.mp4', { type: 'video/mp4' });
    startUpload([good, bad]);

    await waitFor(() => expect(progress).toBeTypeOf('function'));
    act(() => progress(40));
    expect(screen.getByRole('progressbar', { name: 'Progresso de bom.mp4' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('Enviando 40%')).toBeInTheDocument();
    await act(async () => { finishGood(); });

    expect(await screen.findByText('O arquivo excede o limite permitido.')).toBeInTheDocument();
    expect(screen.getByText(/1 arquivo\(s\) não foram enviados/)).toBeInTheDocument();
    expect(uploadMediaAssetWithProgress).toHaveBeenCalledTimes(2);

    uploadMediaAssetWithProgress.mockImplementation(() => Promise.resolve({ id: 'media-big' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo grande.mp4' }));
    await waitFor(() => expect(updateAsset).toHaveBeenCalledWith('media-big', expect.anything()));
    expect(uploadMediaAssetWithProgress).toHaveBeenCalledTimes(3);
    expect(uploadMediaAssetWithProgress.mock.calls[2][0]).toBe(bad);
  });

  it('A4: se só os dados do pacote falharem, o reenvio não sobe o arquivo de novo', async () => {
    uploadMediaAssetWithProgress.mockResolvedValue({ id: 'media-7' });
    updateAsset.mockRejectedValueOnce(new Error('Sem permissão')).mockResolvedValue({ id: 'media-7' });
    startUpload([new File(['v'], 'clip.webm', { type: 'video/webm' })]);

    expect(await screen.findByText(/Arquivo enviado, mas os dados do pacote não foram gravados: Sem permissão/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo clip.webm' }));
    await waitFor(() => expect(updateAsset).toHaveBeenCalledTimes(2));
    expect(uploadMediaAssetWithProgress).toHaveBeenCalledTimes(1);
  });

  it('formato que o Acervo não aceita falha na linha com o motivo, sem chamar o servidor', async () => {
    startUpload([new File(['v'], 'bruto.mkv', { type: 'video/x-matroska' })]);
    expect(await screen.findByText(/Formato não aceito pelo Acervo/)).toBeInTheDocument();
    expect(uploadMediaAssetWithProgress).not.toHaveBeenCalled();
  });

  it('documento segue por /uploads com registro Asset', async () => {
    uploadFile.mockResolvedValue({ file_url: '/api/v1/uploads/doc.pdf', sha256: 'f00' });
    const doc = new File(['%PDF'], 'pauta.pdf', { type: 'application/pdf' });
    startUpload([doc]);
    await waitFor(() => expect(createAsset).toHaveBeenCalledWith(expect.objectContaining({ asset_type: 'document', file_url: '/api/v1/uploads/doc.pdf' })));
    expect(uploadFile).toHaveBeenCalledWith(doc, expect.objectContaining({ onProgress: expect.any(Function) }));
  });
});
