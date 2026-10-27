import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { filter, transcribe } = vi.hoisted(() => ({ filter: vi.fn(), transcribe: vi.fn() }));
vi.mock('@/api/base44Client', () => ({ base44: { entities: { TranscricaoSegmento: { filter: (...args) => filter(...args) } } } }));
vi.mock('../../api/media', () => ({ transcribeMediaAsset: (...args) => transcribe(...args) }));

import WorkspaceTranscricaoPanel from './WorkspaceTranscricaoPanel';

const ASSET = { id: 'asset-1', title: 'Sonora' };

describe('WorkspaceTranscricaoPanel', () => {
  beforeEach(() => { filter.mockReset(); transcribe.mockReset(); });

  it('transcreve a própria mídia no servidor e mostra os trechos com o tempo', async () => {
    filter.mockResolvedValueOnce([]).mockResolvedValue([{ id: 's1', start_ms: 65000, texto: 'Bom dia.' }]);
    transcribe.mockResolvedValue({ segments: 1, reused: false });
    const onSeek = vi.fn();
    render(<WorkspaceTranscricaoPanel asset={ASSET} onSeek={onSeek} />);
    expect(await screen.findByText('Nenhuma transcrição. Clique em Transcrever.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Transcrever/ }));
    expect(await screen.findByText('Bom dia.')).toBeInTheDocument();
    expect(transcribe).toHaveBeenCalledWith('asset-1', { force: false });
    expect(screen.getByText('1 trechos transcritos')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Posicionar preview neste trecho'));
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Transcrever de novo/ })).toBeInTheDocument();
  });

  it('refaz quando já existe e mostra o motivo da falha', async () => {
    filter.mockResolvedValue([{ id: 's1', start_ms: 0, texto: 'Antigo.' }]);
    transcribe.mockRejectedValueOnce(new Error('Nenhum transcritor foi configurado.')).mockRejectedValueOnce({});
    render(<WorkspaceTranscricaoPanel asset={{ ...ASSET, media_asset_id: 'media-9' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Transcrever de novo/ }));
    expect(await screen.findByText('Falha: Nenhum transcritor foi configurado.')).toBeInTheDocument();
    expect(transcribe).toHaveBeenCalledWith('media-9', { force: true });
    fireEvent.click(screen.getByRole('button', { name: /Transcrever de novo/ }));
    expect(await screen.findByText('Falha: erro na transcrição')).toBeInTheDocument();
  });

  it('sem asset não mostra nada e lista vazia quando a leitura falha', async () => {
    const { container, rerender } = render(<WorkspaceTranscricaoPanel asset={null} />);
    expect(container).toBeEmptyDOMElement();
    filter.mockRejectedValue(new Error('sem rede'));
    rerender(<WorkspaceTranscricaoPanel asset={ASSET} />);
    expect(await screen.findByText('Nenhuma transcrição. Clique em Transcrever.')).toBeInTheDocument();
  });
});
