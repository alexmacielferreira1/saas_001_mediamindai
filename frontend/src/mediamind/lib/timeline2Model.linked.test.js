import { describe, expect, it } from 'vitest';
import { addMediaClip, createTimeline2Document, moveClipWithLinked, separateClipAudio } from './timeline2Model';

const clipOf = (document, id) => document.tracks.flatMap((track) => track.clips).find((clip) => clip.id === id);

function linkedDocument() {
  const base = addMediaClip(createTimeline2Document({ id: 'linked' }), { id: 'asset-v', clipId: 'v', name: 'Vídeo', kind: 'video', duration: 5, src: '/v.mp4' }, { trackId: 'v1', start: 1 });
  return { ...separateClipAudio(base, 'v'), snapEnabled: false };
}

describe('moveClipWithLinked (B4)', () => {
  it('desloca o áudio vinculado pelo mesmo tempo do vídeo', () => {
    const moved = moveClipWithLinked(linkedDocument(), 'v', { start: 4 });
    expect(clipOf(moved, 'v').start).toBe(4);
    expect(clipOf(moved, 'v-audio').start).toBe(4);
  });

  it('arrastar o áudio também leva o vídeo', () => {
    const moved = moveClipWithLinked(linkedDocument(), 'v-audio', { start: 2.5 });
    expect(clipOf(moved, 'v').start).toBe(2.5);
  });

  it('clipe sem vínculo se comporta como moveClip; id inexistente não altera', () => {
    const solo = { ...addMediaClip(createTimeline2Document({ id: 's' }), { id: 'x', clipId: 'solo', name: 'Solo', kind: 'video', duration: 2 }, { trackId: 'v1', start: 0 }), snapEnabled: false };
    expect(clipOf(moveClipWithLinked(solo, 'solo', { start: 3 }), 'solo').start).toBe(3);
    expect(moveClipWithLinked(solo, 'nada', { start: 3 })).toBe(solo);
  });
});
