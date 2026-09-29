import { describe, expect, it, vi } from 'vitest';

import { uploadRecordingFiles } from './gravacoesUpload';

describe('upload de materiais de gravação', () => {
  it('registra somente arquivos confirmados pela API e preserva a pasta relativa', async () => {
    const file = { name: 'CAM_A_001.mp4', size: 2048, webkitRelativePath: 'gravacao/camera/CAM_A_001.mp4' };
    const upload = vi.fn().mockResolvedValue({ file_url: '/api/v1/uploads/a.mp4', sha256: 'abc' });

    const result = await uploadRecordingFiles([file], upload);

    expect(result.failed).toEqual([]);
    expect(result.uploaded).toEqual([expect.objectContaining({
      nome: 'CAM_A_001.mp4',
      caminhoRelativo: 'gravacao/camera/CAM_A_001.mp4',
      pastaOrigem: 'gravacao',
      url: '/api/v1/uploads/a.mp4',
      sha256: 'abc',
    })]);
  });

  it('aceita a resposta do Acervo e preserva o vínculo com o ativo de mídia', async () => {
    const file = { name: 'CAM_B_002.mp4', size: 4096, webkitRelativePath: '' };
    const upload = vi.fn().mockResolvedValue({
      id: 'asset-42',
      stream_url: '/api/v1/media/local/assets/asset-42/stream',
      sha256: 'media-sha',
    });

    const result = await uploadRecordingFiles([file], upload);

    expect(result.failed).toEqual([]);
    expect(result.uploaded).toEqual([expect.objectContaining({
      id: 'asset-42',
      mediaAssetId: 'asset-42',
      nome: 'CAM_B_002.mp4',
      url: '/api/v1/media/local/assets/asset-42/stream',
      sha256: 'media-sha',
    })]);
  });

  it('não inventa URL local ao falhar e continua os outros arquivos', async () => {
    const files = [{ name: 'falhou.mp4', size: 10 }, { name: 'ok.mp4', size: 20 }];
    const upload = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ file_url: '/api/v1/uploads/ok.mp4', sha256: 'xyz' });

    const result = await uploadRecordingFiles(files, upload);

    expect(result.failed).toEqual(['falhou.mp4']);
    expect(result.uploaded).toEqual([expect.objectContaining({ nome: 'ok.mp4', url: '/api/v1/uploads/ok.mp4' })]);
  });

  it('trata resposta sem URL como falha, não como material recebido', async () => {
    const result = await uploadRecordingFiles([{ name: 'sem-url.mp4', size: 10 }],
      async () => ({ file_url: '' }));

    expect(result.uploaded).toEqual([]);
    expect(result.failed).toEqual(['sem-url.mp4']);
  });

  it('não envia uma gravação vazia como material válido', async () => {
    const upload = vi.fn().mockResolvedValue({ file_url: '/api/v1/uploads/empty.mp4' });

    const result = await uploadRecordingFiles([{ name: 'empty.mp4', size: 0 }], upload);

    expect(result.uploaded).toEqual([]);
    expect(result.failed).toEqual(['empty.mp4']);
    expect(upload).not.toHaveBeenCalled();
  });
});
