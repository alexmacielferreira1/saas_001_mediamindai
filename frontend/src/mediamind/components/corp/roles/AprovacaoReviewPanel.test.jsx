import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const filterMock = vi.fn();
vi.mock('@/api/base44Client', () => ({ base44: { entities: { ComentarioRevisao: { filter: (...args) => filterMock(...args), bulkCreate: vi.fn().mockResolvedValue([]) } } } }));
import AprovacaoReviewPanel from './AprovacaoReviewPanel';

const project = { id: 'p1', titulo: 'Produção teste', programa: 'Jornal', episodio: 'EP01' };
function draw(tool, start = [100, 100], end = [220, 180]) {
  fireEvent.click(screen.getByRole('button', { name: tool }));
  const canvas = screen.getByLabelText('Área de marcação do vídeo');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 281, right: 500, bottom: 281, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.pointerDown(canvas, { clientX: start[0], clientY: start[1], pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: end[0], clientY: end[1], pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: end[0], clientY: end[1], pointerId: 1 });
  return canvas;
}

describe('AprovacaoReviewPanel annotations', () => {
  beforeEach(() => filterMock.mockResolvedValue([]));
  it('shows a pen annotation on video, timeline and review list', async () => {
    render(<AprovacaoReviewPanel project={project} />);
    await waitFor(() => expect(filterMock).toHaveBeenCalled());
    const canvas = draw('Caneta');
    expect(canvas.querySelector('[data-annotation-shape="pen"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Marcação 00:00')).toBeInTheDocument();
    expect(screen.getByLabelText('Comentário da marcação 1')).toBeInTheDocument();
  });
  it.each([['Seta', 'arrow'], ['Retângulo', 'rectangle'], ['Círculo', 'circle']])('creates %s with editable review item', async (label, shape) => {
    render(<AprovacaoReviewPanel project={project} />);
    await waitFor(() => expect(filterMock).toHaveBeenCalled());
    const canvas = draw(label);
    expect(canvas.querySelector(`[data-annotation-shape="${shape}"]`)).toBeInTheDocument();
    expect(screen.getByLabelText('Comentário da marcação 1')).toBeInTheDocument();
  });
  it('creates text at the selected frame', async () => {
    render(<AprovacaoReviewPanel project={project} />);
    await waitFor(() => expect(filterMock).toHaveBeenCalled());
    const canvas = draw('Texto', [140, 120], [140, 120]);
    expect(canvas.querySelector('[data-annotation-shape="text"]')).toHaveTextContent('Texto');
    expect(screen.getByLabelText('Comentário da marcação 1')).toBeInTheDocument();
  });
});
