import { describe, expect, it, vi } from 'vitest';

import { uploadRecordingFiles } from './gravacoesUpload';

describe('upload de materiais de gravação', () => {
  it('registra somente arquivos confirmados pela API e preserva a pasta relativa', async () => {
    const file = { name: 'CAM_A_001.mp4', size: 2048, webkitRelativePath: 'gravacao/camera/CAM_A_001.mp4' };
    const upload = vi.fn().mockResolvedValue({
      id: 'asset-a', stream_url: '/api/v1/media/assets/asset-a/stream', sha256: 'abc',
    });

    const result = await uploadRecordingFiles([file], upload, { projectId: 'project-1', recordingId: 'rec-1' });

    expect(result.failed).toEqual([]);
    expect(result.uploaded).toEqual([expect.objectContaining({
      nome: 'CAM_A_001.mp4',
      caminhoRelativo: 'gravacao/camera/CAM_A_001.mp4',
      pastaOrigem: 'gravacao',
      id: 'asset-a',
      asset_id: 'asset-a',
      url: '/api/v1/media/assets/asset-a/stream',
      stream_url: '/api/v1/media/assets/asset-a/stream',
      sha256: 'abc',
    })]);
    expect(upload).toHaveBeenCalledWith(file, {
      origin: 'recording', projectId: 'project-1', recordingId: 'rec-1',
    });
  });

  it('não inventa URL local ao falhar e continua os outros arquivos', async () => {
    const files = [{ name: 'falhou.mp4', size: 10 }, { name: 'ok.mp4', size: 20 }];
    const upload = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ id: 'asset-ok', stream_url: '/api/v1/media/assets/asset-ok/stream', sha256: 'xyz' });

    const result = await uploadRecordingFiles(files, upload);

    expect(result.failed).toEqual(['falhou.mp4']);
    expect(result.uploaded).toEqual([expect.objectContaining({ nome: 'ok.mp4', url: '/api/v1/media/assets/asset-ok/stream' })]);
  });

  it('trata resposta sem URL como falha, não como material recebido', async () => {
    const result = await uploadRecordingFiles([{ name: 'sem-url.mp4', size: 10 }],
      async () => ({ id: 'sem-url', stream_url: '' }));

    expect(result.uploaded).toEqual([]);
    expect(result.failed).toEqual(['sem-url.mp4']);
  });

  it('não envia uma gravação vazia como material válido', async () => {
    const upload = vi.fn().mockResolvedValue({ id: 'empty', stream_url: '/api/v1/media/assets/empty/stream' });

    const result = await uploadRecordingFiles([{ name: 'empty.mp4', size: 0 }], upload);

    expect(result.uploaded).toEqual([]);
    expect(result.failed).toEqual(['empty.mp4']);
    expect(upload).not.toHaveBeenCalled();
  });
});
