import { describe, expect, it } from 'vitest';
import {
  addMediaClip,
  addMarker,
  addTextClip,
  createTimeline2Document,
  deleteClips,
  moveClip,
  duplicateClip,
  rippleDelete,
  setPlayhead,
  setZoom,
  splitClip,
  toggleSnapping,
  trimClip,
  updateClipProperties,
  workspace2ToTimeline2,
  getActiveClips,
  getTimelineGeometry,
  pointerToTimelineTime,
  addPropertyKeyframe,
  addTrack,
  getClipPropertiesAtTime,
  removePropertyKeyframe,
  updateKeyframeCurve,
  removeTrack,
  separateClipAudio,
  setTimelineIn,
  setTimelineOut,
  clearTimelineRange,
} from './timeline2Model';

describe('Timeline 2 document model', () => {
  it('creates a non-destructive document with video, audio and text tracks', () => {
    const document = createTimeline2Document({ id: 'news-1', name: 'Jornal 12h' });

    expect(document).toMatchObject({ id: 'news-1', name: 'Jornal 12h', fps: 30, playhead: 0, zoom: 1, snapEnabled: true });
    expect(document.tracks.map((track) => track.kind)).toEqual(['video', 'video', 'text', 'audio', 'audio']);
  });

  it('adds compatible tracks and only removes empty user tracks', () => {
    const base = createTimeline2Document();
    const expanded = addTrack(addTrack(base, 'video'), 'audio');
    expect(expanded.tracks.find((track) => track.id === 'v3')).toMatchObject({ kind: 'video', name: 'Vídeo 3' });
    expect(expanded.tracks.find((track) => track.id === 'a3')).toMatchObject({ kind: 'audio', name: 'Áudio 3' });
    expect(removeTrack(expanded, 'v3').tracks.some((track) => track.id === 'v3')).toBe(false);
    expect(removeTrack(addMediaClip(expanded, { id: 'x', kind: 'video', duration: 2 }, { trackId: 'v3' }), 'v3').tracks.some((track) => track.id === 'v3')).toBe(true);
  });

  it('converts every Workspace 2 block and keeps asset ids', () => {
    const document = workspace2ToTimeline2({
      project: { title: 'Especial' },
      blocks: [
        { id: 'b1', assetId: 7, title: 'Entrevista', type: 'media', duration: 12 },
        { id: 'b2', title: 'Abertura', type: 'text', duration: 5 },
      ],
    });

    const clips = document.tracks.flatMap((track) => track.clips);
    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({ id: 'b1', assetId: 7, start: 0, duration: 12, sourceIn: 0, sourceOut: 12 });
    expect(clips[1]).toMatchObject({ id: 'b2', kind: 'text', start: 12, duration: 5 });
  });

  it('snaps a moved clip to a nearby clip edge and keeps exact time when disabled', () => {
    const base = workspace2ToTimeline2({ blocks: [
      { id: 'a', title: 'A', type: 'media', duration: 10 },
      { id: 'b', title: 'B', type: 'media', duration: 5 },
    ] });
    const snapped = moveClip(base, 'b', { start: 9.92 });
    const exact = moveClip(toggleSnapping(base), 'b', { start: 9.92 });

    expect(snapped.tracks[0].clips.find((clip) => clip.id === 'b').start).toBe(10);
    expect(exact.tracks[0].clips.find((clip) => clip.id === 'b').start).toBe(9.92);
  });

  it('trims and splits clips without mutating the source document', () => {
    const base = workspace2ToTimeline2({ blocks: [{ id: 'a', title: 'A', type: 'media', duration: 10 }] });
    const trimmed = trimClip(base, 'a', { edge: 'start', time: 2 });
    const split = splitClip(trimmed, 'a', 6);
    const clips = split.tracks[0].clips;

    expect(base.tracks[0].clips[0]).toMatchObject({ start: 0, duration: 10, sourceIn: 0 });
    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({ start: 2, duration: 4, sourceIn: 2, sourceOut: 6 });
    expect(clips[1]).toMatchObject({ start: 6, duration: 4, sourceIn: 6, sourceOut: 10 });
  });

  it('rejects edits on locked tracks and no-ops split at clip boundaries', () => {
    const base = workspace2ToTimeline2({ blocks: [{ id: 'a', title: 'A', type: 'media', duration: 10 }] });
    const locked = { ...base, tracks: base.tracks.map((track, index) => index === 0 ? { ...track, locked: true } : track) };

    expect(moveClip(locked, 'a', { start: 5 })).toBe(locked);
    expect(trimClip(locked, 'a', { edge: 'end', time: 8 })).toBe(locked);
    expect(deleteClips(locked, ['a'])).toBe(locked);
    expect(splitClip(base, 'a', 0)).toBe(base);
  });

  it('clamps playhead and zoom to valid ranges', () => {
    const base = workspace2ToTimeline2({ blocks: [{ id: 'a', title: 'A', type: 'media', duration: 10 }] });

    expect(setPlayhead(base, 50).playhead).toBe(10);
    expect(setZoom(base, 0.01).zoom).toBe(0.25);
    expect(setZoom(base, 20).zoom).toBe(8);
  });

  it('stores a valid sequence IN/OUT range and can clear it', () => {
    const base = workspace2ToTimeline2({ blocks: [{ id: 'a', title: 'A', type: 'media', duration: 10 }] });
    const ranged = setTimelineOut(setTimelineIn(setPlayhead(base, 2), 2), 8);
    expect(ranged).toMatchObject({ inPoint: 2, outPoint: 8 });
    expect(setTimelineIn(ranged, 9)).toMatchObject({ inPoint: 8, outPoint: 8 });
    expect(setTimelineOut(ranged, 1)).toMatchObject({ inPoint: 1, outPoint: 1 });
    expect(clearTimelineRange(ranged)).toMatchObject({ inPoint: null, outPoint: null });
  });

  it('adds real media references to a compatible track at the requested time', () => {
    const document = createTimeline2Document();
    const withVideo = addMediaClip(document, {
      id: 'upload-1', name: 'camera.mp4', kind: 'video', duration: 14, src: 'blob:camera',
    }, { start: 3 });
    const clip = withVideo.tracks.find((track) => track.id === 'v1').clips[0];

    expect(clip).toMatchObject({ assetId: 'upload-1', name: 'camera.mp4', start: 3, duration: 14, src: 'blob:camera' });
    expect(withVideo.duration).toBe(17);

    const withAudio = addMediaClip(withVideo, { id: 'audio-1', name: 'trilha.mp3', kind: 'audio', duration: 9 }, { trackId: 'a2' });
    expect(withAudio.tracks.find((track) => track.id === 'a2').clips[0].kind).toBe('audio');
  });

  it('separates embedded video audio into a linked editable audio clip', () => {
    const withVideo = addMediaClip(createTimeline2Document(), { id: 'camera', name: 'camera.mp4', kind: 'video', duration: 8, src: '/camera.mp4' });
    const separated = separateClipAudio(withVideo, withVideo.tracks.find((track) => track.id === 'v1').clips[0].id);
    const video = separated.tracks.find((track) => track.id === 'v1').clips[0];
    const audio = separated.tracks.find((track) => track.id === 'a1').clips[0];

    expect(video.properties.audioDisabled).toBe(true);
    expect(audio).toMatchObject({ kind: 'audio', src: '/camera.mp4', linkedTo: video.id, start: 0, duration: 8 });
    expect(separateClipAudio(separated, video.id)).toBe(separated);
  });

  it('duplicates, ripple deletes and edits clip properties', () => {
    const base = workspace2ToTimeline2({ blocks: [
      { id: 'a', title: 'A', type: 'media', duration: 5 },
      { id: 'b', title: 'B', type: 'media', duration: 5 },
    ] });
    const duplicated = duplicateClip(base, 'a');
    expect(duplicated.tracks[0].clips).toHaveLength(3);
    const styled = updateClipProperties(duplicated, 'a', { opacity: 55, scale: 120, volume: -6 });
    expect(styled.tracks[0].clips.find((clip) => clip.id === 'a').properties).toMatchObject({ opacity: 55, scale: 120, volume: -6 });
    const rippled = rippleDelete(styled, ['a']);
    expect(rippled.tracks[0].clips.find((clip) => clip.id === 'b').start).toBe(0);
  });

  it('adds text and markers at the playhead', () => {
    const base = setPlayhead(workspace2ToTimeline2({ blocks: [{ id: 'a', type: 'media', duration: 10 }] }), 4);
    const withText = addTextClip(base, 'Plantão MediaMind');
    const withMarker = addMarker(withText, { label: 'Revisar corte' });
    expect(withText.tracks.find((track) => track.id === 't1').clips[0]).toMatchObject({ name: 'Plantão MediaMind', start: 4, kind: 'text' });
    expect(withMarker.markers[0]).toMatchObject({ time: 4, label: 'Revisar corte' });
  });

  it('resolves visible overlapping layers and source times at the playhead', () => {
    let document = createTimeline2Document();
    document = addMediaClip(document, { id: 'base', name: 'Base', kind: 'video', duration: 10, src: '/base.mp4' }, { trackId: 'v1', start: 0 });
    document = addMediaClip(document, { id: 'overlay', name: 'Overlay', kind: 'video', duration: 6, src: '/overlay.mp4', properties: { speed: 2 } }, { trackId: 'v2', start: 2 });

    const active = getActiveClips(document, 4);

    expect(active.map((item) => item.name)).toEqual(['Base', 'Overlay']);
    expect(active[1]).toMatchObject({ sourceTime: 4, layerIndex: 1 });
    const hidden = { ...document, tracks: document.tracks.map((track) => track.id === 'v2' ? { ...track, hidden: true } : track) };
    expect(getActiveClips(hidden, 4).map((item) => item.name)).toEqual(['Base']);
  });

  it('stores, interpolates and removes property keyframes without changing the source clip', () => {
    const base = workspace2ToTimeline2({ blocks: [{ id: 'a', title: 'A', type: 'media', duration: 10 }] });
    const first = addPropertyKeyframe(base, 'a', 'scale', { time: 0, value: 100, easing: 'linear' });
    const animated = addPropertyKeyframe(first, 'a', 'scale', { time: 10, value: 200, easing: 'linear' });
    const clip = animated.tracks[0].clips[0];

    expect(base.tracks[0].clips[0].keyframes).toBeUndefined();
    expect(clip.keyframes.scale).toHaveLength(2);
    expect(getClipPropertiesAtTime(clip, 5).scale).toBe(150);

    const curved = updateKeyframeCurve(animated, 'a', 'scale', 10, { easing: 'bezier', bezier: [0.2, 0.8, 0.8, 0.2] });
    expect(curved.tracks[0].clips[0].keyframes.scale[1]).toMatchObject({ easing: 'bezier', bezier: [0.2, 0.8, 0.8, 0.2] });
    expect(removePropertyKeyframe(curved, 'a', 'scale', 10).tracks[0].clips[0].keyframes.scale).toHaveLength(1);
  });
});

describe('timeline geometry', () => {
  it('keeps clips, ruler and playhead on the same pixel scale', () => {
    expect(getTimelineGeometry(30, 1)).toEqual({ pixelsPerSecond: 40, width: 1200 });
    expect(getTimelineGeometry(10, 0.5)).toEqual({ pixelsPerSecond: 20, width: 900 });
    expect(pointerToTimelineTime(610, { left: 10, width: 1200 }, 30)).toBe(15);
    expect(pointerToTimelineTime(-50, { left: 10, width: 1200 }, 30)).toBe(0);
  });
});

it('prepares selected real assets when the workspace has no script blocks yet', () => {
  const prepared = workspace2ToTimeline2({
    project: { id: 'p1', title: 'Real project' },
    selectedAssets: [{ id: 'asset-1', title: 'Interview.mp4', asset_type: 'video', duration: 12, stream_url: '/api/v1/media/assets/asset-1/stream', mime_type: 'video/mp4' }],
  });
  const clip = prepared.tracks.find((track) => track.id === 'v1').clips[0];
  expect(clip).toMatchObject({ assetId: 'asset-1', name: 'Interview.mp4', duration: 12, src: '/api/v1/media/assets/asset-1/stream' });
});
