import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadMediaAsset = vi.fn();
const legacyUpload = vi.fn();
const updateProjeto = vi.fn();
const toast = vi.fn();

vi.mock('../../../api/media', () => ({
  uploadMediaAsset: (...args) => uploadMediaAsset(...args),
}));
vi.mock('../../../api/base44Client', () => ({
  base44: { integrations: { Core: { UploadPublicFile: (...args) => legacyUpload(...args) } } },
}));
vi.mock('../../lib/producaoStore', () => ({
  useProducaoProjetos: () => [{
    id: 'gravacao-1', etapa: 'gravacoes', grav_status: 'gravada', gravada: true,
    titulo: 'Entrevista', programa: 'Jornal', episodio: 'EP 1', materiais: [],
    gravacao: { data: '29/09/2026', horario: '20:00', estudio: 'Estúdio 1' },
  }],
  updateProjeto: (...args) => updateProjeto(...args),
  transicionar: vi.fn(),
}));
vi.mock('../../lib/producaoConfig', () => ({
  useModoTransicao: () => 'editor_puxa',
  setModoTransicao: vi.fn(),
  TRANSITION_MODES: [{ value: 'editor_puxa', label: 'Editor puxa' }],
}));
vi.mock('../../auth', () => ({ useAuth: () => ({ user: { name: 'Alex' } }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));

import GravacoesMateriais from './GravacoesMateriais';

describe('materiais de gravação', () => {
  beforeEach(() => {
    uploadMediaAsset.mockReset();
    legacyUpload.mockReset();
    updateProjeto.mockReset();
    uploadMediaAsset.mockResolvedValue({
      id: 'asset-42',
      stream_url: '/api/v1/media/local/assets/asset-42/stream',
      sha256: 'abc',
    });
  });

  it('envia a gravação pelo Acervo funcional e vincula o ativo ao projeto', async () => {
    const { container } = render(<GravacoesMateriais />);
    const file = new File(['video real'], 'entrevista.mp4', { type: 'video/mp4' });
    const input = container.querySelector('input[type="file"]');

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadMediaAsset).toHaveBeenCalledWith(file));
    expect(legacyUpload).not.toHaveBeenCalled();
    expect(updateProjeto).toHaveBeenCalledWith('gravacao-1', {
      materiais: [expect.objectContaining({
        id: 'asset-42',
        mediaAssetId: 'asset-42',
        nome: 'entrevista.mp4',
        url: '/api/v1/media/local/assets/asset-42/stream',
      })],
    });
  });
});
