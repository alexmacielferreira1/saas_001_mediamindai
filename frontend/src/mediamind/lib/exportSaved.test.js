import { describe, expect, it } from 'vitest';
import { savedNote } from './exportSaved';

describe('savedNote', () => {
  it('diz onde a exportação ficou salva', () => {
    expect(savedNote({ assetId: 'a', exportPath: 'empresa/2026-10-28/Jornal.mp4' })).toBe(' · salvo no Acervo e na pasta de destino (empresa/2026-10-28/Jornal.mp4)');
    expect(savedNote({ assetId: 'a', exportPath: null })).toBe(' · salvo no Acervo');
    expect(savedNote({ assetId: null })).toBe('');
    expect(savedNote()).toBe('');
  });
});
