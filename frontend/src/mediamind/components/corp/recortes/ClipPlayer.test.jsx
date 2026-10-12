import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
