import { describe, expect, it } from 'vitest';
import { gerarLegendas, newClip, SAMPLE_VIDEO } from './clipModel';

describe('clip model safety fallbacks', () => {
  it('does not attach a public sample video to a new clip', () => {
    expect(SAMPLE_VIDEO).toBe('');
    expect(newClip().source_url).toBe('');
  });

  it('uses candidate transcript content instead of invented captions', () => {
    const legendas = gerarLegendas({
      viral: [{ selected: true, start_ms: 1000, end_ms: 4000, texto: 'Fala transcrita real' }],
      in_ms: 0,
      out_ms: 5000,
    });
    expect(legendas).toEqual([expect.objectContaining({
      start_ms: 1000, end_ms: 4000, texto: 'Fala transcrita real',
    })]);
  });
});
