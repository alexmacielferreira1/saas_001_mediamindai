import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MediaPlayer from './MediaPlayer';

describe('real media transport', () => {
  it('plays the source, seeks to a review marker and pauses', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    render(<MediaPlayer src="/sample.mp4" markers={[{ id: 'm1', time: 12, text: 'Corrigir corte' }]} />);
    const video = screen.getByTestId('media-player-video');
    Object.defineProperty(video, 'duration', { configurable: true, value: 60 });
    fireEvent.loadedMetadata(video);
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir mídia' }));
    await waitFor(() => expect(play).toHaveBeenCalled());
    fireEvent.play(video);
    fireEvent.click(screen.getByRole('button', { name: /Corrigir corte/ }));
    expect(video.currentTime).toBe(12);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar mídia' }));
    expect(pause).toHaveBeenCalled();
    play.mockRestore(); pause.mockRestore();
  });
  it('does not pretend to play a missing source', () => {
    render(<MediaPlayer />);
    expect(screen.getByRole('button', { name: 'Reproduzir mídia' })).toBeDisabled();
  });
});
