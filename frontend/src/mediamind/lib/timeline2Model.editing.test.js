import { describe, expect, it } from 'vitest';
import {
  addClipOnFreeTrack, addMarker, addMediaClip, addTrack, copyClips, findFreeTrack, createTimeline2Document, duplicateClips, expandLinkedClipIds, extractRange,
  formatTimecode, getActiveClips, getClipFadeFactor, getClipFilterCss, getClipsInRegion, getPlacementError, getPreviousAdjacentClip,
  getTimelineDisplayTracks, getTimelineSpan, getVisualLayerMap, getZoomToFit, moveClip, moveClipsBy, moveTrack, pasteClips, pastedClipId,
  removeTrack, renameTrack, rippleDelete, separateClipAudio, setClipSpeed, setClipTransition, setFrameRate, setPlayhead, snapClipStart,
  splitClip, splitClipsAtTime, stepFrames, toggleRippleEditing, toggleSnapping, trimClip, updateClipProperties,
} from './timeline2Model';

const clipsOf = (document, trackId) => document.tracks.find((track) => track.id === trackId).clips;
const lock = (document, trackId) => ({ ...document, tracks: document.tracks.map((track) => (track.id === trackId ? { ...track, locked: true } : track)) });
const place = (document, id, trackId, start, duration, extra = {}) => addMediaClip(document, {
  id, clipId: id, name: id.toUpperCase(), kind: trackId.startsWith('a') ? 'audio' : trackId.startsWith('t') ? 'text' : 'video', duration, src: `/${id}.mp4`, ...extra,
}, { trackId, start });

describe('frame rate and timecode', () => {
  it('formats non-drop timecode with the document rate instead of a fixed 30 fps', () => {
    expect(formatTimecode(2, 30)).toBe('00:00:02:00');
    expect(formatTimecode(1.5, 24)).toBe('00:00:01:12');
    expect(formatTimecode(1.5, 25)).toBe('00:00:01:12');
    expect(formatTimecode(3725.5, 25)).toBe('01:02:05:12');
    expect(formatTimecode(1, 29.97)).toBe('00:00:00:29');
    expect(formatTimecode(-4, 30)).toBe('00:00:00:00');
  });

  it('steps exactly one frame of the project rate and accepts only supported rates', () => {
    let document = place(createTimeline2Document(), 'a', 'v1', 0, 10);
    document = setFrameRate(document, 25);
    expect(document.fps).toBe(25);
    expect(setFrameRate(document, 31)).toBe(document);
    expect(stepFrames(document, 1).playhead).toBeCloseTo(0.04, 6);
    expect(stepFrames(setPlayhead(document, 1.013), 1).playhead).toBeCloseTo(1.04, 6);
    expect(stepFrames(document, -3).playhead).toBe(0);
  });

  it('uses the document rate for the minimum split distance', () => {
    const document = setFrameRate(place(createTimeline2Document(), 'a', 'v1', 0, 10), 24);
    expect(splitClip(document, 'a', 1 / 48)).toBe(document);
    expect(clipsOf(splitClip(document, 'a', 1 / 24), 'v1')).toHaveLength(2);
  });
});

describe('multi-track layers', () => {
  it('reorders visual layers, keeps audio below and stacks the preview like the display', () => {
    let document = place(place(createTimeline2Document(), 'base', 'v1', 0, 10), 'over', 'v2', 0, 10);
    expect(getActiveClips(document, 1).find((clip) => clip.id === 'over').layerIndex).toBeGreaterThan(getActiveClips(document, 1).find((clip) => clip.id === 'base').layerIndex);
    document = moveTrack(document, 'v2', 'down');
    expect(getTimelineDisplayTracks(document).map((track) => track.id)).toEqual(['t1', 'v1', 'v2', 'a1', 'a2']);
    const active = getActiveClips(document, 1);
    expect(active.find((clip) => clip.id === 'base').layerIndex).toBeGreaterThan(active.find((clip) => clip.id === 'over').layerIndex);
    expect(moveTrack(document, 'a1', 'up')).toBe(document);
    expect(getTimelineDisplayTracks(moveTrack(document, 'a1', 'down')).map((track) => track.id).slice(-2)).toEqual(['a2', 'a1']);
  });

  it('keeps the preview stacking consistent with the display for added video tracks', () => {
    const document = addTrack(createTimeline2Document(), 'video');
    const layers = getVisualLayerMap(document);
    expect(layers.get('t1')).toBeGreaterThan(layers.get('v3'));
    expect(layers.get('v3')).toBeGreaterThan(layers.get('v2'));
  });

  it('does not reorder locked tracks and keeps manual order when tracks are added or removed', () => {
    const base = moveTrack(createTimeline2Document(), 't1', 'down');
    const locked = lock(base, 'v2');
    expect(moveTrack(locked, 'v2', 'up')).toBe(locked);
    const withVideo = addTrack(base, 'video');
    expect(getTimelineDisplayTracks(withVideo).map((track) => track.id)).toEqual(['v3', 'v2', 't1', 'v1', 'a1', 'a2']);
    const withAudio = addTrack(withVideo, 'audio');
    expect(getTimelineDisplayTracks(withAudio).at(-1).id).toBe('a3');
    expect(removeTrack(withAudio, 'v3').trackOrder).not.toContain('v3');
  });

  it('renames tracks with trimmed, bounded names and ignores empty names', () => {
    const document = createTimeline2Document();
    expect(renameTrack(document, 'v2', '  Câmera 2  ').tracks.find((track) => track.id === 'v2').name).toBe('Câmera 2');
    expect(renameTrack(document, 'v2', '   ')).toBe(document);
    expect(renameTrack(document, 'v2', 'x'.repeat(90)).tracks.find((track) => track.id === 'v2').name).toHaveLength(60);
  });

  it('places new elements on a free track of their kind instead of overwriting, creating one if needed', () => {
    let document = place(createTimeline2Document(), 'title', 't1', 0, 5);
    expect(findFreeTrack(document, 'text', 1, 2)).toBeNull();
    expect(findFreeTrack(document, 'text', 5, 2)).toBe('t1');
    document = addClipOnFreeTrack(document, { id: 'sticker', clipId: 'sticker', name: '🔥', kind: 'text', duration: 3 }, 1);
    expect(clipsOf(document, 't1')).toHaveLength(1);
    expect(clipsOf(document, 't2')[0]).toMatchObject({ id: 'sticker', start: 1, duration: 3 });
    expect(findFreeTrack(lock(document, 't2'), 'text', 10, 1)).toBe('t1');
  });

  it('reports why media cannot be dropped on a track', () => {
    const document = lock(createTimeline2Document(), 'v2');
    expect(getPlacementError(document, 'video', 'v1')).toBe('');
    expect(getPlacementError(document, 'video', 'v2')).toMatch(/travada/);
    expect(getPlacementError(document, 'audio', 'v1')).toMatch(/áudio/);
    expect(getPlacementError(document, 'text', 'x9')).toMatch(/não encontrada/);
  });
});

describe('selection, clipboard and group edits', () => {
  const base = () => place(place(place(createTimeline2Document(), 'a', 'v1', 0, 4), 'b', 'v1', 4, 4), 'm', 'a2', 1, 2);

  it('selects clips intersecting a marquee region on chosen tracks', () => {
    const document = base();
    expect(getClipsInRegion(document, { start: 3, end: 5, trackIds: ['v1'] })).toEqual(['a', 'b']);
    expect(getClipsInRegion(document, { start: 5, end: 0.5, trackIds: ['v1', 'a2'] })).toEqual(['a', 'b', 'm']);
    expect(getClipsInRegion(document, { start: 8.5, end: 9, trackIds: ['v1'] })).toEqual([]);
  });

  it('copies and pastes clips at the playhead keeping relative timing and new ids', () => {
    const document = base();
    const items = copyClips(document, ['a', 'm']);
    const pasted = pasteClips(document, items, 10, { token: 't1' });
    expect(clipsOf(pasted, 'v1').find((clip) => clip.id === pastedClipId('a', 't1'))).toMatchObject({ start: 10, duration: 4 });
    expect(clipsOf(pasted, 'a2').find((clip) => clip.id === pastedClipId('m', 't1'))).toMatchObject({ start: 11, duration: 2 });
    expect(clipsOf(document, 'v1')).toHaveLength(2);
  });

  it('pastes into another compatible track when the original is locked and skips when none exists', () => {
    const document = lock(base(), 'v1');
    const pasted = pasteClips(document, copyClips(base(), ['a']), 0, { token: 'x' });
    expect(clipsOf(pasted, 'v2')[0]).toMatchObject({ id: pastedClipId('a', 'x'), trackId: 'v2' });
    const allLocked = lock(lock(document, 'v2'), 'v2');
    expect(pasteClips(allLocked, copyClips(base(), ['a']), 0, { token: 'y' })).toBe(allLocked);
  });

  it('duplicates a multi-selection right after its end', () => {
    const duplicated = duplicateClips(base(), ['a', 'b'], { token: 'd' });
    expect(clipsOf(duplicated, 'v1').map((clip) => [clip.id, clip.start])).toEqual([['a', 0], ['b', 4], [pastedClipId('a', 'd'), 8], [pastedClipId('b', 'd'), 12]]);
  });

  it('moves a group by the same offset, never before zero and never on locked tracks', () => {
    const document = base();
    const moved = moveClipsBy(document, ['a', 'm'], 3);
    expect(clipsOf(moved, 'a2')[0].start).toBe(4);
    expect(clipsOf(moved, 'v1').find((clip) => clip.id === 'a')).toMatchObject({ start: 3, duration: 4 });
    expect(clipsOf(moved, 'v1').find((clip) => clip.id === 'b')).toMatchObject({ start: 7, duration: 1 });
    expect(clipsOf(moveClipsBy(document, ['m'], -5), 'a2')[0].start).toBe(0);
    const locked = lock(document, 'a2');
    expect(moveClipsBy(locked, ['m'], 2)).toBe(locked);
  });

  it('splits every selected clip, or every clip under the playhead on unlocked tracks', () => {
    const document = base();
    expect(clipsOf(splitClipsAtTime(document, ['a', 'm'], 2), 'v1')).toHaveLength(3);
    const underPlayhead = splitClipsAtTime(lock(document, 'a2'), [], 2);
    expect(clipsOf(underPlayhead, 'v1')).toHaveLength(3);
    expect(clipsOf(underPlayhead, 'a2')).toHaveLength(1);
  });
});

describe('interval ripple delete and range extraction', () => {
  it('closes only freed intervals on each track and leaves locked tracks untouched', () => {
    let document = place(place(place(createTimeline2Document(), 'a', 'v1', 0, 2), 'b', 'v1', 2, 2), 'c', 'v1', 6, 2);
    document = place(document, 'x', 'v2', 5, 2);
    const rippled = rippleDelete(document, ['a', 'x']);
    expect(clipsOf(rippled, 'v1').map((clip) => [clip.id, clip.start])).toEqual([['b', 0], ['c', 4]]);
    expect(clipsOf(rippled, 'v2')).toHaveLength(0);
    const locked = lock(document, 'v1');
    expect(clipsOf(rippleDelete(locked, ['a']), 'v1').map((clip) => clip.start)).toEqual([0, 2, 6]);
  });

  it('closes a multi-clip selection with gaps as separate intervals', () => {
    const document = place(place(place(place(createTimeline2Document(), 'a', 'v1', 0, 2), 'b', 'v1', 3, 2), 'c', 'v1', 6, 2), 'd', 'v1', 10, 1);
    expect(clipsOf(rippleDelete(document, ['a', 'c']), 'v1').map((clip) => [clip.id, clip.start])).toEqual([['b', 1], ['d', 6]]);
  });

  it('keeps separated audio in sync when ripple includes linked clips', () => {
    let document = place(place(createTimeline2Document(), 'a', 'v1', 0, 3), 'b', 'v1', 3, 3);
    document = separateClipAudio(separateClipAudio(document, 'a'), 'b');
    expect(expandLinkedClipIds(document, ['a'])).toEqual(['a', 'a-audio']);
    const rippled = rippleDelete(document, ['a'], { includeLinked: true });
    expect(clipsOf(rippled, 'v1').map((clip) => clip.start)).toEqual([0]);
    expect(clipsOf(rippled, 'a1').map((clip) => [clip.id, clip.start])).toEqual([['b-audio', 0]]);
  });

  it('extracts the IN/OUT range from unlocked tracks and shifts markers', () => {
    let document = place(place(createTimeline2Document(), 'a', 'v1', 0, 10), 'm', 'a2', 0, 10);
    document = addMarker(addMarker(setPlayhead(document, 3), { label: 'dentro' }), { time: 8, label: 'depois' });
    const extracted = extractRange(lock(document, 'a2'), 2, 5);
    expect(clipsOf(extracted, 'v1').map((clip) => [clip.start, clip.duration, clip.sourceIn])).toEqual([[0, 2, 0], [2, 5, 5]]);
    expect(clipsOf(extracted, 'a2')).toEqual(clipsOf(document, 'a2'));
    expect(extracted.markers.map((marker) => [marker.label, marker.time])).toEqual([['depois', 5]]);
    expect(extracted).toMatchObject({ inPoint: null, outPoint: null, playhead: 2 });
    expect(extractRange(document, 4, 4)).toBe(document);
  });

  it('toggles ripple editing as document state', () => {
    const document = createTimeline2Document();
    expect(toggleRippleEditing(document).rippleEnabled).toBe(true);
    expect(toggleRippleEditing(toggleRippleEditing(document)).rippleEnabled).toBe(false);
  });
});

describe('snapping', () => {
  it('snaps a moved clip end to markers and to the IN point', () => {
    let document = place(createTimeline2Document(), 'a', 'v1', 0, 4);
    document = { ...addMarker(place(document, 'z', 'v1', 20, 5), { time: 12 }), inPoint: 16 };
    expect(clipsOf(moveClip(document, 'a', { start: 7.95 }), 'v1').find((clip) => clip.id === 'a').start).toBe(8);
    expect(snapClipStart(document, 11.93, 4, 'a')).toBe(12);
    expect(snapClipStart(document, 15.9, 4, 'a')).toBe(16);
    expect(snapClipStart(toggleSnapping(document), 11.93, 4, 'a')).toBe(11.93);
  });
});

describe('speed, fades, effects and transitions', () => {
  it('keeps the source span when speed changes and splits with speed-aware source times', () => {
    let document = place(createTimeline2Document(), 'a', 'v1', 0, 10, { sourceDuration: 10 });
    document = setClipSpeed(document, 'a', 2);
    expect(clipsOf(document, 'v1')[0]).toMatchObject({ duration: 5, sourceIn: 0, sourceOut: 10 });
    const split = splitClip(document, 'a', 2);
    expect(clipsOf(split, 'v1').map((clip) => [clip.start, clip.sourceIn, clip.sourceOut])).toEqual([[0, 0, 4], [2, 4, 10]]);
    expect(getActiveClips(document, 1)[0].sourceTime).toBe(2);
    const trimmed = trimClip(document, 'a', { edge: 'end', time: 9 });
    expect(clipsOf(trimmed, 'v1')[0].duration).toBe(5);
  });

  it('limits a slower clip to the gap before the next clip and retimes linked audio', () => {
    let document = place(place(createTimeline2Document(), 'a', 'v1', 0, 4), 'b', 'v1', 6, 2);
    document = separateClipAudio(document, 'a');
    const slowed = setClipSpeed(document, 'a', 0.5);
    expect(clipsOf(slowed, 'v1')[0]).toMatchObject({ duration: 6, sourceOut: 3 });
    expect(clipsOf(slowed, 'a1')[0]).toMatchObject({ id: 'a-audio', duration: 8, properties: expect.objectContaining({ speed: 0.5 }) });
  });

  it('computes fade factors and CSS filters for the preview', () => {
    const clip = { start: 2, duration: 4, properties: { fadeIn: 1, fadeOut: 2 } };
    expect(getClipFadeFactor(clip, 2.5)).toBe(0.5);
    expect(getClipFadeFactor(clip, 4)).toBe(1);
    expect(getClipFadeFactor(clip, 5.5)).toBe(0.25);
    expect(getClipFilterCss({})).toBe('none');
    expect(getClipFilterCss({ brightness: 120, contrast: 80, saturation: 0, blur: 3 })).toBe('brightness(1.2) contrast(0.8) saturate(0) blur(3px)');
    const document = updateClipProperties(place(createTimeline2Document(), 'a', 'v1', 0, 4), 'a', { fadeIn: 2 });
    expect(getActiveClips(document, 1)[0].fade).toBe(0.5);
  });

  it('splitting keeps the fade-in on the left part and the fade-out on the right part', () => {
    const document = updateClipProperties(place(createTimeline2Document(), 'a', 'v1', 0, 10), 'a', { fadeIn: 1, fadeOut: 1 });
    const [left, right] = clipsOf(splitClip(document, 'a', 5), 'v1');
    expect(left.properties).toMatchObject({ fadeIn: 1, fadeOut: 0 });
    expect(right.properties).toMatchObject({ fadeIn: 0, fadeOut: 1 });
  });

  it('creates transitions only between adjacent clips and resolves crossfade and dip in the preview', () => {
    let document = place(place(place(createTimeline2Document(), 'a', 'v1', 0, 4), 'b', 'v1', 4, 4), 'c', 'v1', 10, 2);
    expect(getPreviousAdjacentClip(document, 'b').id).toBe('a');
    expect(setClipTransition(document, 'c', { type: 'crossfade', duration: 1 })).toBe(document);
    expect(setClipTransition(document, 'b', { type: 'wipe', duration: 1 })).toBe(document);
    const crossfade = setClipTransition(document, 'b', { type: 'crossfade', duration: 10 });
    expect(clipsOf(crossfade, 'v1')[1].transitionIn).toEqual({ type: 'crossfade', duration: 4 });
    const atHalf = getActiveClips(setClipTransition(document, 'b', { type: 'crossfade', duration: 2 }), 5);
    expect(atHalf.map((clip) => [clip.id, clip.transitionRole || 'active', clip.fade])).toEqual([['a', 'outgoing', 1], ['b', 'active', 0.5]]);
    expect(atHalf[0].sourceTime).toBe(5);
    const dip = setClipTransition(document, 'b', { type: 'dip', duration: 2 });
    expect(getActiveClips(dip, 3.5)[0].fade).toBe(0.5);
    expect(getActiveClips(dip, 4.5)[0].fade).toBe(0.5);
    expect(getActiveClips(dip, 6)[0].fade).toBe(1);
    expect(clipsOf(setClipTransition(dip, 'b', null), 'v1')[1].transitionIn).toBeUndefined();
    expect(clipsOf(splitClip(dip, 'b', 6), 'v1')[2].transitionIn).toBeUndefined();
  });
});

describe('timeline view helpers', () => {
  it('maps the whole canvas width to time even below the minimum canvas width', () => {
    expect(getTimelineSpan(30, 1)).toBe(30);
    expect(getTimelineSpan(30, 0.5)).toBe(45);
    expect(getZoomToFit(120, 1200)).toBeCloseTo(0.25, 2);
    expect(getZoomToFit(20, 1200)).toBeCloseTo(1.42, 2);
    expect(getZoomToFit(1, 99999)).toBe(8);
  });
});
