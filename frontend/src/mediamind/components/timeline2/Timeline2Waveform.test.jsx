import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Timeline2Waveform from './Timeline2Waveform';

describe('Timeline2Waveform', () => {
  it('draws bars from the decoded summary for the visible source window', async () => {
    const loader = vi.fn(async () => ({ duration: 2, peaks: Float32Array.from([0.2, 0.4, 0.6, 0.8]) }));
    render(<Timeline2Waveform src="/a.mp3" sourceIn={0} sourceSpan={2} width={12} loader={loader} />);
    const svg = await screen.findByTestId('timeline2-waveform');
    expect(loader).toHaveBeenCalledWith('/a.mp3');
    expect(svg.querySelector('path').getAttribute('d').match(/M/g)).toHaveLength(4);
  });

  it('renders nothing when the audio cannot be decoded', async () => {
    const loader = vi.fn(() => Promise.reject(new Error('sem áudio')));
    const { container } = render(<Timeline2Waveform src="/b.mp3" sourceIn={0} sourceSpan={2} width={30} loader={loader} />);
    await waitFor(() => expect(loader).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
