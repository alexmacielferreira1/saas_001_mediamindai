import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FinalTimelinePlayer from './FinalTimelinePlayer';

const timeline = {
  duration: 10,
  fps: 30,
  tracks: [{ id: 'v1', kind: 'video', clips: [
    { id: 'one', kind: 'video', name: 'Abertura', src: '/one.mp4', start: 0, duration: 4, sourceIn: 2, properties: { volume: 0 } },
    { id: 'two', kind: 'video', name: 'Encerramento', src: '/two.mp4', start: 4, duration: 6, sourceIn: 0, properties: { volume: 0 } },
  ] }],
};

describe('final timeline player', () => {
  it('seeks through the final sequence and selects the correct source clip', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    render(<FinalTimelinePlayer timeline={timeline} />);
    const video = screen.getByTestId('final-timeline-video');

    expect(video).toHaveAttribute('src', '/one.mp4');
    expect(screen.getByText(/00:00 \/ 00:10/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Posição do vídeo final'), { target: { value: '6' } });
    expect(screen.getByTestId('final-timeline-video')).toHaveAttribute('src', '/two.mp4');
    expect(screen.getByText(/Encerramento/)).toBeInTheDocument();
    expect(screen.getByText(/00:06 \/ 00:10/)).toBeInTheDocument();
    pause.mockRestore();
  });

  it('uses real play and pause controls', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    render(<FinalTimelinePlayer timeline={timeline} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir vídeo final' }));
    expect(play).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Pausar vídeo final' }));
    expect(pause).toHaveBeenCalled();
    play.mockRestore(); pause.mockRestore();
  });

  it('previews only the marked IN/OUT range', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    render(<FinalTimelinePlayer timeline={{ ...timeline, inPoint: 2, outPoint: 8 }} />);

    expect(screen.getByLabelText('Posição do vídeo final')).toHaveAttribute('min', '2');
    expect(screen.getByLabelText('Posição do vídeo final')).toHaveAttribute('max', '8');
    expect(screen.getByText(/00:02 \/ 00:08/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Posição do vídeo final'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao início do vídeo final' }));
    expect(screen.getByLabelText('Posição do vídeo final')).toHaveValue('2');
    pause.mockRestore();
  });
});
