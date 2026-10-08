import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createThumbnailDraft } from '../../lib/thumbnailStudio';
vi.mock('../../lib/thumbnailRenderer', () => ({
  renderThumbnail: vi.fn().mockResolvedValue([]),
  thumbnailLayers: () => [{ id: 'headline', x: 5, y: 30, w: 50, h: 30, order: 3, hidden: false, locked: false, rotation: 0 }],
}));
import ThumbnailCanvas from './ThumbnailCanvas';
import { renderThumbnail } from '../../lib/thumbnailRenderer';
describe('thumbnail preview', () => {
  it('uses the shared render and marks completion before export', async () => {
    const draft = createThumbnailDraft({ programa: 'Prontuário Jurídico', headline: 'NOVAS ESCOLAS' });
    render(<ThumbnailCanvas draft={draft} format="horizontal" />);
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('data-render-status', 'ready'));
    expect(renderThumbnail).toHaveBeenCalledWith(expect.anything(), draft, 'horizontal', expect.objectContaining({ simers: true }));
  });
  it('reports image failures instead of silently showing a completed preview', async () => {
    renderThumbnail.mockRejectedValueOnce(new Error('Imagem inválida'));
    render(<ThumbnailCanvas draft={createThumbnailDraft()} format="vertical" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Imagem inválida');
  });
  it('selects a layer on pointer interaction', () => {
    const select = vi.fn(); render(<ThumbnailCanvas draft={createThumbnailDraft()} format="horizontal" onSelectLayer={select} />);
    const element = screen.getByTestId('thumbnail-canvas-horizontal');
    element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 }); element.setPointerCapture = vi.fn();
    fireEvent.pointerDown(element, { clientX: 100, clientY: 250, pointerId: 1 });
    expect(select).toHaveBeenCalledWith('headline', 'horizontal');
  });
});
