const DEFAULT_TRACKS = [
  { id: 'v1', kind: 'video', name: 'Vídeo principal' },
  { id: 'v2', kind: 'video', name: 'B-roll e apoio' },
  { id: 't1', kind: 'text', name: 'Textos e legendas' },
  { id: 'a1', kind: 'audio', name: 'Áudio principal' },
  { id: 'a2', kind: 'audio', name: 'Trilha e efeitos' },
];

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

const trackNumber = (track) => Number(String(track?.id || '').replace(/\D/g, '')) || 0;

export function getTimelineDisplayTracks(document) {
  const rank = { text: 0, video: 1, audio: 2 };
  return [...(document?.tracks || [])].sort((left, right) => {
    const kindDifference = (rank[left.kind] ?? 3) - (rank[right.kind] ?? 3);
    if (kindDifference) return kindDifference;
    const numberDifference = trackNumber(left) - trackNumber(right);
    return left.kind === 'audio' ? numberDifference : -numberDifference;
  });
}

export function getTimelineGeometry(duration, zoom = 1) {
  const pixelsPerSecond = 40 * Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoom) || 1));
  return { pixelsPerSecond, width: Math.max(900, Math.max(0, Number(duration) || 0) * pixelsPerSecond) };
}

export function pointerToTimelineTime(clientX, bounds, duration) {
  const ratio = (Number(clientX) - Number(bounds?.left || 0)) / Math.max(1, Number(bounds?.width) || 1);
  return Math.max(0, Math.min(Math.max(0, Number(duration) || 0), ratio * Math.max(0, Number(duration) || 0)));
}

const cloneTrack = (track) => ({ ...track, clips: track.clips.map((clip) => ({ ...clip })) });

const computeDuration = (tracks) => tracks.reduce(
  (maximum, track) => track.clips.reduce((trackMaximum, clip) => Math.max(trackMaximum, clip.start + clip.duration), maximum),
  0,
);

const locateClip = (document, clipId) => {
  for (let trackIndex = 0; trackIndex < document.tracks.length; trackIndex += 1) {
    const clipIndex = document.tracks[trackIndex].clips.findIndex((clip) => clip.id === clipId);
    if (clipIndex >= 0) return { trackIndex, clipIndex, track: document.tracks[trackIndex], clip: document.tracks[trackIndex].clips[clipIndex] };
  }
  return null;
};

const replaceTracks = (document, tracks) => ({
  ...document,
  tracks,
  duration: computeDuration(tracks),
  updatedAt: new Date().toISOString(),
});

function overwriteTrackClips(clips, incoming, fps) {
  const frame = 1 / fps;
  const incomingStart = incoming.start;
  const incomingEnd = incoming.start + incoming.duration;
  return clips.flatMap((clip) => {
    const clipEnd = clip.start + clip.duration;
    if (clipEnd <= incomingStart || clip.start >= incomingEnd) return [clip];
    if (clip.start >= incomingStart && clipEnd <= incomingEnd) return [];
    if (clip.start < incomingStart && clipEnd > incomingEnd) {
      const leftDuration = incomingStart - clip.start;
      const rightDuration = clipEnd - incomingEnd;
      const left = { ...clip, duration: leftDuration, sourceOut: clip.sourceIn + leftDuration };
      const rightSourceIn = clip.sourceIn + (incomingEnd - clip.start);
      const right = { ...clip, id: `${clip.id}-overwrite-${Math.round(incomingEnd * fps)}`, start: incomingEnd, duration: rightDuration, sourceIn: rightSourceIn };
      return [left, right].filter((item) => item.duration >= frame);
    }
    if (clip.start < incomingStart) {
      const duration = incomingStart - clip.start;
      return duration >= frame ? [{ ...clip, duration, sourceOut: clip.sourceIn + duration }] : [];
    }
    const delta = incomingEnd - clip.start;
    const duration = clipEnd - incomingEnd;
    return duration >= frame ? [{ ...clip, start: incomingEnd, duration, sourceIn: clip.sourceIn + delta }] : [];
  });
}

export function createTimeline2Document({ id = 'timeline2-draft', name = 'Projeto sem título', fps = 30 } = {}) {
  return {
    id,
    name,
    fps,
    duration: 0,
    playhead: 0,
    inPoint: null,
    outPoint: null,
    zoom: 1,
    snapEnabled: true,
    tracks: DEFAULT_TRACKS.map((track) => ({ ...track, locked: false, muted: false, hidden: false, clips: [] })),
    markers: [],
    updatedAt: new Date().toISOString(),
  };
}

export function setTimelineIn(document, time = document.playhead) {
  const next = Math.max(0, Math.min(document.duration, Number(time) || 0));
  return { ...document, inPoint: document.outPoint == null ? next : Math.min(next, document.outPoint), updatedAt: new Date().toISOString() };
}

export function setTimelineOut(document, time = document.playhead) {
  const next = Math.max(0, Math.min(document.duration, Number(time) || 0));
  return { ...document, inPoint: document.inPoint == null ? document.inPoint : Math.min(document.inPoint, next), outPoint: next, updatedAt: new Date().toISOString() };
}

export function clearTimelineRange(document) {
  return { ...document, inPoint: null, outPoint: null, updatedAt: new Date().toISOString() };
}

export function addTrack(document, kind = 'video') {
  const normalized = ['video', 'audio', 'text'].includes(kind) ? kind : 'video';
  const prefix = normalized === 'video' ? 'v' : normalized === 'audio' ? 'a' : 't';
  const label = normalized === 'video' ? 'Vídeo' : normalized === 'audio' ? 'Áudio' : 'Texto';
  const nextNumber = Math.max(0, ...document.tracks.filter((track) => track.kind === normalized).map((track) => Number(String(track.id).replace(/\D/g, '')) || 0)) + 1;
  const track = { id: `${prefix}${nextNumber}`, kind: normalized, name: `${label} ${nextNumber}`, locked: false, muted: false, hidden: false, userCreated: true, clips: [] };
  const tracks = [...document.tracks];
  const insertAt = normalized === 'text'
    ? Math.max(0, tracks.findIndex((candidate) => candidate.kind === 'video'))
    : normalized === 'video'
      ? (tracks.findIndex((candidate) => candidate.kind === 'audio') < 0 ? tracks.length : tracks.findIndex((candidate) => candidate.kind === 'audio'))
      : tracks.length;
  tracks.splice(insertAt, 0, track);
  return { ...document, tracks, updatedAt: new Date().toISOString() };
}

export function removeTrack(document, trackId) {
  const track = document.tracks.find((candidate) => candidate.id === trackId);
  if (!track?.userCreated || track.clips.length) return document;
  return { ...document, tracks: document.tracks.filter((candidate) => candidate.id !== trackId), updatedAt: new Date().toISOString() };
}

export function workspace2ToTimeline2({ project = {}, blocks = [], selectedAssets = [] } = {}) {
  const document = createTimeline2Document({ id: project.id || 'workspace2-draft', name: project.title || 'Workspace 2' });
  let cursor = 0;
  const tracks = document.tracks.map(cloneTrack);
  const sourceItems = blocks.length ? blocks : selectedAssets.map((asset) => ({
    id: `asset-block-${asset.id}`,
    assetId: asset.id,
    title: asset.title || asset.filename,
    duration: asset.duration,
    type: asset.asset_type,
    src: asset.stream_url,
    mimeType: asset.mime_type,
  }));
  sourceItems.forEach((block, index) => {
    const kind = block.type === 'text' ? 'text' : block.type === 'audio' ? 'audio' : 'video';
    const trackId = kind === 'text' ? 't1' : kind === 'audio' ? 'a1' : 'v1';
    const track = tracks.find((candidate) => candidate.id === trackId);
    const duration = Math.max(1 / document.fps, Number(block.duration) || 5);
    track.clips.push({
      id: String(block.id || `clip-${index + 1}`),
      assetId: block.assetId ?? null,
      name: block.title || block.text || `Clipe ${index + 1}`,
      kind,
      trackId,
      start: cursor,
      duration,
      sourceIn: 0,
      sourceOut: duration,
      src: block.src || block.stream_url || null,
      mimeType: block.mimeType || block.mime_type || null,
      origin: block.origin || (block.assetId ? 'acervo' : 'workspace'),
      properties: { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, speed: 1, ...(block.properties || {}) },
      selected: false,
    });
    cursor += duration;
  });
  let prepared = { ...document, tracks, duration: cursor };
  tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === 'video' && clip.src).forEach((clip) => {
    prepared = separateClipAudio(prepared, clip.id);
  });
  return prepared;
}

export function addMediaClip(document, media, { trackId, start = document.playhead } = {}) {
  const kind = media.kind === 'audio' ? 'audio' : media.kind === 'text' ? 'text' : 'video';
  const preferredTrack = trackId || (kind === 'audio' ? 'a1' : kind === 'text' ? 't1' : 'v1');
  const trackIndex = document.tracks.findIndex((track) => track.id === preferredTrack && track.kind === kind);
  if (trackIndex < 0 || document.tracks[trackIndex].locked) return document;
  const duration = Math.max(1 / document.fps, Number(media.duration) || 5);
  const clipStart = Math.max(0, snapTime(document, Number(start) || 0));
  const tracks = document.tracks.map(cloneTrack);
  const baseId = String(media.id || `media-${Date.now()}`);
  const incoming = {
    id: media.clipId || `${baseId}-${Date.now()}-${tracks[trackIndex].clips.length}`,
    assetId: media.id ?? null,
    name: media.name || 'Mídia sem título',
    kind,
    trackId: preferredTrack,
    start: clipStart,
    duration,
    sourceIn: 0,
    sourceOut: duration,
    src: media.src || null,
    mimeType: media.mimeType || null,
    origin: media.origin || 'project',
    properties: { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, speed: 1, ...(media.properties || {}) },
    selected: false,
  };
  tracks[trackIndex].clips = overwriteTrackClips(tracks[trackIndex].clips, incoming, document.fps);
  tracks[trackIndex].clips.push(incoming);
  tracks[trackIndex].clips.sort((a, b) => a.start - b.start);
  return replaceTracks(document, tracks);
}

export function separateClipAudio(document, clipId) {
  const located = locateClip(document, clipId);
  if (!located || located.clip.kind !== 'video' || !located.clip.src || located.clip.properties?.audioDisabled) return document;
  const audioTrackIndex = document.tracks.findIndex((track) => track.kind === 'audio' && !track.locked);
  if (audioTrackIndex < 0) return document;
  const tracks = document.tracks.map(cloneTrack);
  const video = tracks[located.trackIndex].clips[located.clipIndex];
  video.properties = { ...video.properties, audioDisabled: true };
  tracks[audioTrackIndex].clips.push({
    ...video,
    id: `${video.id}-audio`,
    name: `${video.name} · áudio`,
    kind: 'audio',
    trackId: tracks[audioTrackIndex].id,
    linkedTo: video.id,
    properties: { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: Number(video.properties?.volume) || 0, speed: Number(video.properties?.speed) || 1 },
  });
  tracks[audioTrackIndex].clips.sort((a, b) => a.start - b.start);
  return replaceTracks(document, tracks);
}

function snapTime(document, requested, ignoredClipId) {
  if (!document.snapEnabled) return requested;
  const tolerance = 0.12 / document.zoom;
  const targets = [0, document.playhead];
  document.tracks.forEach((track) => track.clips.forEach((clip) => {
    if (clip.id !== ignoredClipId) targets.push(clip.start, clip.start + clip.duration);
  }));
  const closest = targets.reduce((best, target) => best == null || Math.abs(target - requested) < Math.abs(best - requested) ? target : best, null);
  return Math.abs(closest - requested) <= tolerance ? closest : requested;
}

export function moveClip(document, clipId, { start, trackId } = {}) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked) return document;
  const destinationIndex = trackId ? document.tracks.findIndex((track) => track.id === trackId) : located.trackIndex;
  if (destinationIndex < 0 || document.tracks[destinationIndex].locked) return document;
  const destination = document.tracks[destinationIndex];
  if (destination.kind !== located.clip.kind && !(destination.kind === 'video' && located.clip.kind === 'text')) return document;
  const tracks = document.tracks.map(cloneTrack);
  const [clip] = tracks[located.trackIndex].clips.splice(located.clipIndex, 1);
  const nextStart = Math.max(0, snapTime(document, Number(start) || 0, clipId));
  const incoming = { ...clip, trackId: destination.id, start: nextStart };
  tracks[destinationIndex].clips = overwriteTrackClips(tracks[destinationIndex].clips, incoming, document.fps);
  tracks[destinationIndex].clips.push(incoming);
  tracks[destinationIndex].clips.sort((a, b) => a.start - b.start);
  return replaceTracks(document, tracks);
}

export function trimClip(document, clipId, { edge, time } = {}) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked) return document;
  const frame = 1 / document.fps;
  const clipEnd = located.clip.start + located.clip.duration;
  const requested = snapTime(document, Number(time), clipId);
  if (edge === 'start' && requested >= located.clip.start && requested <= clipEnd - frame) {
    const delta = requested - located.clip.start;
    const tracks = document.tracks.map(cloneTrack);
    tracks[located.trackIndex].clips[located.clipIndex] = { ...located.clip, start: requested, duration: located.clip.duration - delta, sourceIn: located.clip.sourceIn + delta };
    return replaceTracks(document, tracks);
  }
  if (edge === 'end' && requested >= located.clip.start + frame && requested <= clipEnd) {
    const tracks = document.tracks.map(cloneTrack);
    const duration = requested - located.clip.start;
    tracks[located.trackIndex].clips[located.clipIndex] = { ...located.clip, duration, sourceOut: located.clip.sourceIn + duration };
    return replaceTracks(document, tracks);
  }
  return document;
}

export function splitClip(document, clipId, time) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked) return document;
  const frame = 1 / document.fps;
  const splitAt = Number(time);
  const end = located.clip.start + located.clip.duration;
  if (splitAt < located.clip.start + frame || splitAt > end - frame) return document;
  const leftDuration = splitAt - located.clip.start;
  const rightDuration = end - splitAt;
  const sourceSplit = located.clip.sourceIn + leftDuration;
  const left = { ...located.clip, duration: leftDuration, sourceOut: sourceSplit };
  const right = { ...located.clip, id: `${located.clip.id}-split-${Math.round(splitAt * document.fps)}`, start: splitAt, duration: rightDuration, sourceIn: sourceSplit };
  const tracks = document.tracks.map(cloneTrack);
  tracks[located.trackIndex].clips.splice(located.clipIndex, 1, left, right);
  return replaceTracks(document, tracks);
}

export function deleteClips(document, clipIds) {
  const wanted = new Set(clipIds);
  if (!document.tracks.some((track) => !track.locked && track.clips.some((clip) => wanted.has(clip.id)))) return document;
  const tracks = document.tracks.map((track) => track.locked ? cloneTrack(track) : { ...track, clips: track.clips.filter((clip) => !wanted.has(clip.id)).map((clip) => ({ ...clip })) });
  return replaceTracks(document, tracks);
}

export function duplicateClip(document, clipId) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked) return document;
  const tracks = document.tracks.map(cloneTrack);
  const frame = 1 / document.fps;
  const copy = { ...located.clip, id: `${located.clip.id}-copy-${Date.now()}`, name: `${located.clip.name} (cópia)`, start: located.clip.start + located.clip.duration + frame };
  tracks[located.trackIndex].clips.push(copy);
  tracks[located.trackIndex].clips.sort((a, b) => a.start - b.start);
  return replaceTracks(document, tracks);
}

export function rippleDelete(document, clipIds) {
  const wanted = new Set(clipIds);
  let changed = false;
  const tracks = document.tracks.map((track) => {
    if (track.locked) return cloneTrack(track);
    const removed = track.clips.filter((clip) => wanted.has(clip.id));
    if (!removed.length) return cloneTrack(track);
    changed = true;
    return {
      ...track,
      clips: track.clips.filter((clip) => !wanted.has(clip.id)).map((clip) => {
        const shift = removed.filter((item) => item.start < clip.start).reduce((total, item) => total + item.duration, 0);
        return { ...clip, start: Math.max(0, clip.start - shift) };
      }),
    };
  });
  return changed ? replaceTracks(document, tracks) : document;
}

export function updateClipProperties(document, clipId, properties) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked) return document;
  const tracks = document.tracks.map(cloneTrack);
  tracks[located.trackIndex].clips[located.clipIndex] = { ...located.clip, properties: { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, speed: 1, ...(located.clip.properties || {}), ...properties } };
  return replaceTracks(document, tracks);
}

export function addPropertyKeyframe(document, clipId, property, { time = document.playhead, value, easing = 'smooth', bezier = [0.33, 0, 0.67, 1] } = {}) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked || !property) return document;
  const localTime = Math.max(0, Math.min(located.clip.duration, Number(time) - located.clip.start));
  const currentValue = Number(value ?? located.clip.properties?.[property] ?? 0);
  const existing = located.clip.keyframes?.[property] || [];
  const keyframe = { time: localTime, value: currentValue, easing, bezier };
  const keyframes = [...existing.filter((item) => Math.abs(item.time - localTime) > 1e-6), keyframe].sort((a, b) => a.time - b.time);
  const tracks = document.tracks.map(cloneTrack);
  tracks[located.trackIndex].clips[located.clipIndex] = {
    ...located.clip,
    keyframes: { ...(located.clip.keyframes || {}), [property]: keyframes },
  };
  return replaceTracks(document, tracks);
}

export function removePropertyKeyframe(document, clipId, property, time = document.playhead) {
  const located = locateClip(document, clipId);
  const existing = located?.clip.keyframes?.[property];
  if (!located || located.track.locked || !existing?.length) return document;
  const localTime = Math.max(0, Math.min(located.clip.duration, Number(time) - located.clip.start));
  const keyframes = existing.filter((item) => Math.abs(item.time - localTime) > (0.5 / document.fps));
  if (keyframes.length === existing.length) return document;
  const tracks = document.tracks.map(cloneTrack);
  tracks[located.trackIndex].clips[located.clipIndex] = {
    ...located.clip,
    keyframes: { ...(located.clip.keyframes || {}), [property]: keyframes },
  };
  return replaceTracks(document, tracks);
}

export function updateKeyframeCurve(document, clipId, property, time, curve = {}) {
  const located = locateClip(document, clipId);
  const existing = located?.clip.keyframes?.[property];
  if (!located || located.track.locked || !existing?.length) return document;
  const localTime = Math.max(0, Math.min(located.clip.duration, Number(time) - located.clip.start));
  let changed = false;
  const keyframes = existing.map((item) => {
    if (Math.abs(item.time - localTime) > (0.5 / document.fps)) return item;
    changed = true;
    return { ...item, ...curve };
  });
  if (!changed) return document;
  const tracks = document.tracks.map(cloneTrack);
  tracks[located.trackIndex].clips[located.clipIndex] = { ...located.clip, keyframes: { ...(located.clip.keyframes || {}), [property]: keyframes } };
  return replaceTracks(document, tracks);
}

function interpolationProgress(progress, keyframe) {
  const t = Math.max(0, Math.min(1, progress));
  if (keyframe?.easing === 'hold') return 0;
  if (keyframe?.easing === 'linear') return t;
  if (keyframe?.easing === 'bezier') {
    const [, firstY = 0, , secondY = 1] = keyframe.bezier || [];
    const inverse = 1 - t;
    return (3 * inverse * inverse * t * firstY) + (3 * inverse * t * t * secondY) + (t ** 3);
  }
  return t * t * (3 - (2 * t));
}

export function getClipPropertiesAtTime(clip, programTime) {
  const properties = { ...(clip.properties || {}) };
  const localTime = Math.max(0, Math.min(clip.duration, Number(programTime) - clip.start));
  Object.entries(clip.keyframes || {}).forEach(([property, keyframes]) => {
    if (!keyframes.length) return;
    const rightIndex = keyframes.findIndex((item) => item.time >= localTime);
    if (rightIndex === 0) { properties[property] = keyframes[0].value; return; }
    if (rightIndex < 0) { properties[property] = keyframes.at(-1).value; return; }
    const left = keyframes[rightIndex - 1];
    const right = keyframes[rightIndex];
    const progress = (localTime - left.time) / Math.max(1e-9, right.time - left.time);
    const eased = interpolationProgress(progress, right);
    properties[property] = left.value + ((right.value - left.value) * eased);
  });
  return properties;
}

export function addTextClip(document, text, options = {}) {
  const value = String(text || '').trim();
  if (!value) return document;
  return addMediaClip(document, { id: `text-${Date.now()}`, name: value, kind: 'text', duration: options.duration || 5, origin: 'editor', properties: options.properties }, { trackId: 't1', start: options.start ?? document.playhead });
}

export function addMarker(document, { time = document.playhead, label = 'Marcador', color = '#f59e0b' } = {}) {
  const markerTime = Math.max(0, Math.min(document.duration, Number(time) || 0));
  return { ...document, markers: [...document.markers, { id: `marker-${Date.now()}-${document.markers.length}`, time: markerTime, label, color }], updatedAt: new Date().toISOString() };
}

export function toggleTrackState(document, trackId, field) {
  if (!['locked', 'muted', 'hidden'].includes(field)) return document;
  const index = document.tracks.findIndex((track) => track.id === trackId);
  if (index < 0) return document;
  const tracks = document.tracks.map(cloneTrack);
  tracks[index] = { ...tracks[index], [field]: !tracks[index][field] };
  return { ...document, tracks, updatedAt: new Date().toISOString() };
}

export function setPlayhead(document, time) {
  return { ...document, playhead: Math.max(0, Math.min(document.duration, Number(time) || 0)) };
}

export function setZoom(document, zoom) {
  return { ...document, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoom) || 1)) };
}

export function toggleSnapping(document) {
  return { ...document, snapEnabled: !document.snapEnabled };
}

export function getActiveClips(document, time = document.playhead) {
  const programTime = Math.max(0, Number(time) || 0);
  return document.tracks.flatMap((track, layerIndex) => {
    if (track.hidden || (track.kind === 'audio' && track.muted)) return [];
    return track.clips
      .filter((clip) => programTime >= clip.start && programTime < clip.start + clip.duration)
      .map((clip) => {
        const properties = getClipPropertiesAtTime(clip, programTime);
        const speed = Math.max(0.25, Math.min(4, Number(properties.speed) || 1));
        return {
          ...clip,
          properties,
          layerIndex,
          muted: Boolean(track.muted),
          sourceTime: clip.sourceIn + ((programTime - clip.start) * speed),
        };
      });
  });
}
