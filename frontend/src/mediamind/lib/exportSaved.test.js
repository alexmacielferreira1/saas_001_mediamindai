import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('../../api/media', () => ({ uploadMediaAsset: (...args) => upload(...args) }));

import { saveExportToLibrary, savedNote } from './exportSaved';

describe('savedNote', () => {
  it('diz onde a exportação ficou salva', () => {
    expect(savedNote({ assetId: 'a', exportPath: 'empresa/2026-10-28/Jornal.mp4' })).toBe(' · salvo no Acervo e na pasta de destino (empresa/2026-10-28/Jornal.mp4)');
    expect(savedNote({ assetId: 'a', exportPath: null })).toBe(' · salvo no Acervo');
    expect(savedNote({ assetId: null })).toBe('');
    expect(savedNote()).toBe('');
  });
});

describe('saveExportToLibrary', () => {
  beforeEach(() => upload.mockReset());

  it('envia a peça como exportação, com o tipo sem parâmetros de codec', async () => {
    upload.mockResolvedValueOnce({ id: 'a1', export_path: 'empresa/2026-10-28/x.webm' }).mockResolvedValueOnce(null);
    await expect(saveExportToLibrary(new Blob(['v'], { type: 'video/webm;codecs=vp9' }), 'x.webm'))
      .resolves.toEqual({ assetId: 'a1', exportPath: 'empresa/2026-10-28/x.webm' });
    const [file, meta] = upload.mock.calls[0];
    expect(file).toMatchObject({ name: 'x.webm', type: 'video/webm' });
    expect(meta).toEqual({ origin: 'export' });
    await expect(saveExportToLibrary(new Blob(['?']), 'sem-tipo.bin')).resolves.toEqual({ assetId: null, exportPath: null });
    expect(upload.mock.calls[1][0].type).toBe('application/octet-stream');
  });
});
