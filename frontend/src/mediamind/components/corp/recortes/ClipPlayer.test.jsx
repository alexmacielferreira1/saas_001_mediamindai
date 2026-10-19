import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClipPlayer from './ClipPlayer';

describe('clip playback availability', () => {
  it('disables playback when there is no source instead of showing a pretend programme', () => {
    render(<ClipPlayer in_ms={0} out_ms={0}/>);
    expect(screen.getByRole('button',{name:'Reproduzir'})).toBeDisabled();
    expect(screen.queryByText('Prefeito fala sobre obras')).not.toBeInTheDocument();
  });
  it('pauses after crossing OUT even when timeupdate skips the exact boundary', () => {
    const {container}=render(<ClipPlayer source_url="/clip.mp4" in_ms={0} out_ms={10000}/>);
    const video=container.querySelector('video');
    const pause=()=>Object.defineProperty(video,'paused',{value:true,configurable:true});
    video.pause=pause;
    Object.defineProperty(video,'paused',{value:false,configurable:true});
    fireEvent.play(video);video.currentTime=11;fireEvent.timeUpdate(video);
    expect(video.paused).toBe(true);
  });
  it('skips removed video intervals in the preview and shows timed text layers only while active', () => {
    const { container } = render(<ClipPlayer source_url="/clip.mp4" videoCuts={[{ start_ms: 1000, end_ms: 4000 }]} overlays={[{ id: 't1', tipo: 'titulo', titulo: 'Título de teste', start_ms: 4000, end_ms: 6000 }]} />);
    const video = container.querySelector('video');
    video.currentTime = 2;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(4);
    expect(within(video.parentElement).getByText('Título de teste')).toBeInTheDocument();
    video.currentTime = 7;
    fireEvent.timeUpdate(video);
    expect(within(video.parentElement).queryByText('Título de teste')).not.toBeInTheDocument();
  });
  it('moves a text layer in the timeline and preserves its duration', () => {
    const onMoveLayer = vi.fn();
    const { container } = render(<ClipPlayer source_url="/clip.mp4" overlays={[{ id: 'text-1', tipo: 'titulo', titulo: 'Chamada', start_ms: 1000, end_ms: 3000 }]} onMoveLayer={onMoveLayer} />);
    const video = container.querySelector('video');
    Object.defineProperty(video, 'duration', { value: 10, configurable: true });
    fireEvent.loadedMetadata(video);
    const lane = screen.getByLabelText('Trilha de textos');
    lane.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100 });
    fireEvent.dragStart(screen.getByRole('button', { name: 'Mover camada Chamada' }), { dataTransfer: { setData() {}, effectAllowed: '' } });
    const drop = createEvent.drop(lane, { dataTransfer: { getData: () => 'text-1' } });
    Object.defineProperty(drop, 'clientX', { value: 50 });
    fireEvent(lane, drop);
    expect(onMoveLayer).toHaveBeenCalledWith('text-1', 5000, 7000);
  });
});
