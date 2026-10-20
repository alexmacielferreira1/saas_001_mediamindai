import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Workspace2Export from './Workspace2Export';
import { exportTimeline } from '../../../api/media';

vi.mock('../../../api/media', () => ({
  exportTimeline: vi.fn(),
  exportMediaClip: vi.fn(),
  resolveMediaUrl: (url) => url,
}));

const emptyTimeline = { name: 'Sequência', tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 't1', kind: 'text', name: 'Título', start: 0, duration: 3 }] }] };
const timeline = { name: 'Sequência', tracks: [{ id: 'v1', kind: 'video', clips: [{ id: 'c1', kind: 'video', assetId: '11111111-1111-1111-1111-111111111111', name: 'Cena', start: 0, duration: 4, sourceIn: 0 }] }] };

function renderExport(props = {}) {
  const onNotice = vi.fn();
  render(<Workspace2Export project={{ title: 'Projeto' }} timeline={timeline} onSave={vi.fn()} onNotice={onNotice} {...props} />);
  return onNotice;
}

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:render');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.clearAllMocks());

describe('Workspace2Export — Render e entrega', () => {
  it('desabilita render e fila quando a trilha principal não tem clipe do acervo', () => {
    renderExport({ timeline: emptyTimeline });
    for (const label of ['Renderizar sequência agora', 'Enviar sequência para fila', 'Gerar versão para aprovação']) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
    expect(screen.getByRole('status', { name: 'Resultado do render' })).toHaveTextContent('Adicione à trilha principal de vídeo um clipe do acervo');
    expect(exportTimeline).not.toHaveBeenCalled();
  });

  it('mostra o arquivo gerado ao lado dos botões quando o render conclui', async () => {
    exportTimeline.mockResolvedValue({ blob: new Blob(['mp4']), filename: 'Projeto-editado.mp4' });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderExport();
    fireEvent.click(screen.getByRole('button', { name: 'Renderizar sequência agora' }));
    await waitFor(() => expect(screen.getByRole('status', { name: 'Resultado do render' })).toHaveTextContent('Render concluído: Projeto-editado.mp4'));
    expect(exportTimeline).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sequência', tracks: timeline.tracks }));
    expect(clickSpy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Renderizar sequência agora' })).toBeEnabled();
  });

  it('mostra o erro real do servidor sem fingir sucesso', async () => {
    exportTimeline.mockRejectedValue(new Error('FFmpeg indisponível'));
    const onNotice = renderExport();
    fireEvent.click(screen.getByRole('button', { name: 'Renderizar sequência agora' }));
    await waitFor(() => expect(screen.getByRole('status', { name: 'Resultado do render' })).toHaveTextContent('FFmpeg indisponível'));
    expect(screen.queryByText(/Render concluído/)).toBeNull();
    expect(onNotice).toHaveBeenLastCalledWith('FFmpeg indisponível');
  });
});
