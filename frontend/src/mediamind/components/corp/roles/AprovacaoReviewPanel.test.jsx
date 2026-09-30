import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => localStorage.clear());
  it('shows a pen annotation on video, timeline and review list', () => {
    render(<AprovacaoReviewPanel project={project} />);
    const canvas = draw('Caneta');
    expect(canvas.querySelector('[data-annotation-shape="pen"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Marcação 00:00')).toBeInTheDocument();
    expect(screen.getByLabelText('Comentário da marcação 1')).toBeInTheDocument();
  });
  it.each([['Seta', 'arrow'], ['Retângulo', 'rectangle'], ['Círculo', 'circle']])('creates %s with editable review item', (label, shape) => {
    render(<AprovacaoReviewPanel project={project} />);
    const canvas = draw(label);
    expect(canvas.querySelector(`[data-annotation-shape="${shape}"]`)).toBeInTheDocument();
    expect(screen.getByLabelText('Comentário da marcação 1')).toBeInTheDocument();
  });
  it('creates text at the selected frame', () => {
    render(<AprovacaoReviewPanel project={project} />);
    const canvas = draw('Texto', [140, 120], [140, 120]);
    expect(canvas.querySelector('[data-annotation-shape="text"]')).toHaveTextContent('Texto');
    expect(screen.getByLabelText('Comentário da marcação 1')).toBeInTheDocument();
  });

  it('persists review notes locally and returns immediately to Alteração', () => {
    const onEnviarEditor = vi.fn();
    render(<AprovacaoReviewPanel project={project} onEnviarEditor={onEnviarEditor} />);
    fireEvent.change(screen.getByPlaceholderText('Ajustes principais desta revisão...'), { target: { value: 'Corrigir o GC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para Alteração', exact: true }));
    expect(onEnviarEditor).toHaveBeenCalledWith('p1');
    expect(JSON.parse(localStorage.getItem('mediamind:review:p1')).generalComment).toBe('Corrigir o GC');
  });
});
