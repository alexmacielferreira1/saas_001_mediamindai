import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { filterMock } = vi.hoisted(() => ({ filterMock: vi.fn() }));
vi.mock('@/api/base44Client', () => ({
  base44: { entities: { TranscricaoSegmento: { filter: (...args) => filterMock(...args) } } },
}));

import RoteiroMediaSelector, { parseClock } from './RoteiroMediaSelector';

describe('RoteiroMediaSelector', () => {
  beforeEach(() => { filterMock.mockReset().mockResolvedValue([]); });

  it('confirms the selected time range instead of adding the whole media', () => {
    const onConfirm = vi.fn();
    render(<RoteiroMediaSelector asset={{ id: 7, title: 'Mobilidade urbana', duration: 501 }} onCancel={() => {}} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Deixa inicial'), { target: { value: '00:01:14' } });
    fireEvent.change(screen.getByLabelText('Deixa final'), { target: { value: '00:01:42' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao roteiro/i }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      id: 7,
      clipIn: '00:01:14',
      clipOut: '00:01:42',
    }));
  });

  it('shows the real transcript of the selected range and the computed duration', async () => {
    filterMock.mockResolvedValue([
      { id: 's1', start_ms: 10000, end_ms: 20000, texto: 'Fala fora do trecho' },
      { id: 's2', start_ms: 75000, end_ms: 80000, texto: 'Fala real dentro do trecho' },
    ]);
    render(<RoteiroMediaSelector asset={{ id: 7, title: 'Mídia', duration: 501 }} onCancel={() => {}} onConfirm={() => {}} />);

    expect(await screen.findByText('Fala real dentro do trecho')).toBeInTheDocument();
    expect(screen.queryByText('Fala fora do trecho')).toBeNull();
    expect(filterMock).toHaveBeenCalledWith({ asset_id: '7' }, 'start_ms', 500);
    expect(screen.getByText('00:00:28')).toBeInTheDocument();
    expect(screen.queryByText(/novas obras de mobilidade/)).toBeNull();
  });

  it('says honestly when the media has no transcript or it fails to load', async () => {
    const { unmount } = render(<RoteiroMediaSelector asset={{ id: 8, title: 'Sem fala' }} onCancel={() => {}} onConfirm={() => {}} />);
    expect(await screen.findByText('Esta mídia ainda não tem transcrição.')).toBeInTheDocument();
    expect(screen.getByText('Programa').nextSibling).toHaveTextContent('—');
    unmount();

    filterMock.mockRejectedValue(new Error('Servidor fora'));
    render(<RoteiroMediaSelector asset={{ id: 9, title: 'Erro' }} onCancel={() => {}} onConfirm={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Servidor fora');
  });

  it('uses inline transcript segments from the asset when present', async () => {
    render(<RoteiroMediaSelector asset={{ id: 10, title: 'Inline', transcript_segments: [{ start_ms: 80000, end_ms: 90000, texto: 'Segmento do asset' }] }} onCancel={() => {}} onConfirm={() => {}} />);
    expect(await screen.findByText('Segmento do asset')).toBeInTheDocument();
    expect(filterMock).not.toHaveBeenCalled();
    expect(parseClock('01:02:03')).toBe(3723);
    expect(parseClock('xx')).toBeNull();
  });
});
