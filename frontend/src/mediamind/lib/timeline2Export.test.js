import { describe, expect, it } from 'vitest';
import { describeTimelineExport, getExportMainTrack } from './timeline2Export';
import { addMediaClip, addTextClip, createTimeline2Document, updateClipProperties } from './timeline2Model';
import { getPipPlacement } from './timeline2Presets';

describe('timeline export summary', () => {
  it('uses the same main track rule as the backend (v1, else the first video track)', () => {
    expect(getExportMainTrack(createTimeline2Document()).id).toBe('v1');
    expect(getExportMainTrack({ tracks: [{ id: 'a1', kind: 'audio' }, { id: 'v7', kind: 'video' }] }).id).toBe('v7');
    expect(getExportMainTrack({ tracks: [] })).toBeNull();
  });

  it('lists clips outside the main track and preview-only effects without claiming multi-track export', () => {
    let document = addMediaClip(createTimeline2Document(), { id: 'asset-1', clipId: 'main', name: 'Main', kind: 'video', duration: 5 }, { trackId: 'v1', start: 0 });
    document = addMediaClip(document, { id: 'asset-2', clipId: 'pip', name: 'PiP', kind: 'video', duration: 5 }, { trackId: 'v2', start: 0 });
    document = addMediaClip(document, { id: null, clipId: 'local', name: 'Sem acervo', kind: 'video', duration: 2 }, { trackId: 'v1', start: 6 });
    document = addTextClip(document, 'Título', { start: 0 });
    document = updateClipProperties(document, 'main', { saturation: 0, fadeIn: 1 });
    const summary = describeTimelineExport(document);

    expect(summary).toMatchObject({ includedCount: 1, canExport: true });
    expect(summary.included[0]).toMatch(/1 clipe\(s\) do Acervo/);
    expect(summary.omitted).toEqual(expect.arrayContaining([
      expect.stringMatching(/1 clipe\(s\) da trilha principal sem mídia/),
      expect.stringMatching(/B-roll e apoio \(v2\)/),
      expect.stringMatching(/Textos e legendas \(t1\)/),
    ]));
    expect(summary.previewOnly).toEqual(expect.arrayContaining(['filtros de cor e desfoque', 'fades de entrada e saída']));
  });

  it('respects the IN/OUT range when counting what is exported', () => {
    const document = { ...addMediaClip(createTimeline2Document(), { id: 'asset-1', clipId: 'main', name: 'Main', kind: 'video', duration: 5 }, { trackId: 'v1', start: 10 }), inPoint: 0, outPoint: 4 };
    expect(describeTimelineExport(document)).toMatchObject({ includedCount: 0, canExport: false });
  });
});

describe('picture-in-picture placement', () => {
  it('puts a 35% layer in the requested corner of the preview', () => {
    expect(getPipPlacement('top-right', 800, 450)).toEqual({ scale: 35, x: 244, y: -130 });
    expect(getPipPlacement('bottom-left', 800, 450)).toEqual({ scale: 35, x: -244, y: 130 });
  });
});
