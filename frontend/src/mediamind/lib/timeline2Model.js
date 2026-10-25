const DEFAULT_TRACKS = [
  { id: 'v1', kind: 'video', name: 'Vídeo principal' },
  { id: 'v2', kind: 'video', name: 'B-roll e apoio' },
  { id: 't1', kind: 'text', name: 'Textos e legendas' },
  { id: 'a1', kind: 'audio', name: 'Áudio principal' },
  { id: 'a2', kind: 'audio', name: 'Trilha e efeitos' },
];

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const BASE_PIXELS_PER_SECOND = 40;
const TRACK_NAME_LIMIT = 60;

export const TIMELINE2_FRAME_RATES = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
export const TIMELINE2_TRANSITIONS = [
  { id: 'crossfade', label: 'Dissolver (crossfade)' },
  { id: 'dip', label: 'Mergulho no preto' },
];

const clipSpeed = (clip) => Math.max(0.25, Math.min(4, Number(clip?.properties?.speed) || 1));
const clipSourceIn = (clip) => Math.max(0, Number(clip?.sourceIn) || 0);
const safeFps = (document) => (Number(document?.fps) > 0 ? Number(document.fps) : 30);
const isVisualTrack = (track) => track?.kind !== 'audio';
const now = () => new Date().toISOString();

const trackNumber = (track) => Number(String(track?.id || '').replace(/\D/g, '')) || 0;

function legacyDisplayOrder(tracks) {
  const rank = { text: 0, video: 1, audio: 2 };
  return [...tracks].sort((left, right) => {
    const kindDifference = (rank[left.kind] ?? 3) - (rank[right.kind] ?? 3);
    if (kindDifference) return kindDifference;
    const numberDifference = trackNumber(left) - trackNumber(right);
    return left.kind === 'audio' ? numberDifference : -numberDifference;
  });
}

/**
 * Display order, top to bottom. Visual tracks (video/text) are always above audio tracks.
 * Without an explicit `trackOrder` the historical ordering is kept (texts above videos,
 * higher numbers above lower ones). After a manual reorder, `trackOrder` decides.
 */
export function getTimelineDisplayTracks(document) {
  const tracks = document?.tracks || [];
  const legacy = legacyDisplayOrder(tracks);
  const order = Array.isArray(document?.trackOrder) ? document.trackOrder : null;
  if (!order) return legacy;
  const position = new Map(order.map((id, index) => [id, index]));
  const byGroup = (visual) => {
    const group = legacy.filter((track) => isVisualTrack(track) === visual);
    const known = group.filter((track) => position.has(track.id)).sort((left, right) => position.get(left.id) - position.get(right.id));
    const unknown = group.filter((track) => !position.has(track.id));
    return visual ? [...unknown, ...known] : [...known, ...unknown];
  };
  return [...byGroup(true), ...byGroup(false)];
}

/** Compositing layer per visual track: 0 is the bottom layer, matching the timeline display (upper rows on top). */
export function getVisualLayerMap(document) {
  const visual = getTimelineDisplayTracks(document).filter(isVisualTrack);
  return new Map(visual.map((track, index) => [track.id, visual.length - 1 - index]));
}

export function getTimelineGeometry(duration, zoom = 1) {
  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoom) || 1));
  return { pixelsPerSecond, width: Math.max(900, Math.max(0, Number(duration) || 0) * pixelsPerSecond) };
}

/** Seconds represented by the full canvas width (the canvas has a 900 px minimum width). */
export function getTimelineSpan(duration, zoom = 1) {
  const { pixelsPerSecond, width } = getTimelineGeometry(duration, zoom);
  return Math.max(Math.max(0, Number(duration) || 0), width / pixelsPerSecond);
}

export function pointerToTimelineTime(clientX, bounds, duration) {
  const ratio = (Number(clientX) - Number(bounds?.left || 0)) / Math.max(1, Number(bounds?.width) || 1);
  return Math.max(0, Math.min(Math.max(0, Number(duration) || 0), ratio * Math.max(0, Number(duration) || 0)));
}

/** Zoom that makes the whole sequence fit the visible width (clamped to the supported zoom range). */
export function getZoomToFit(duration, viewportWidth) {
  const safeDuration = Math.max(1, Number(duration) || 0);
  const width = Math.max(100, Number(viewportWidth) || 0);
  const zoom = (width * 0.95) / (safeDuration * BASE_PIXELS_PER_SECOND);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(zoom * 100) / 100));
}

/**
 * Non-drop-frame timecode HH:MM:SS:FF counted in frames of the document rate.
 * For 29.97/59.94 the frame label uses the nominal rate (30/60), like NDF timecode.
 */
export function formatTimecode(seconds, fps = 30) {
  const rate = Number(fps) > 0 ? Number(fps) : 30;
  const nominal = Math.max(1, Math.round(rate));
  const safe = Math.max(0, Number(seconds) || 0);
  const totalFrames = Math.floor((safe * rate) + 1e-6);
  const frames = totalFrames % nominal;
  const totalSeconds = Math.floor(totalFrames / nominal);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hours, minutes, secs, frames].map((value) => String(value).padStart(2, '0')).join(':');
}

export function snapToFrame(time, fps = 30) {
  const rate = Number(fps) > 0 ? Number(fps) : 30;
  return Math.round(Math.max(0, Number(time) || 0) * rate) / rate;
}

const cloneTrack = (track) => ({ ...track, clips: (track.clips || []).map((clip) => ({ ...clip })) });

const computeDuration = (tracks) => tracks.reduce(
  (maximum, track) => (track.clips || []).reduce((trackMaximum, clip) => Math.max(trackMaximum, clip.start + clip.duration), maximum),
  0,
);

const locateClip = (document, clipId) => {
  for (let trackIndex = 0; trackIndex < document.tracks.length; trackIndex += 1) {
    const clipIndex = (document.tracks[trackIndex].clips || []).findIndex((clip) => clip.id === clipId);
    if (clipIndex >= 0) return { trackIndex, clipIndex, track: document.tracks[trackIndex], clip: document.tracks[trackIndex].clips[clipIndex] };
  }
  return null;
};

const replaceTracks = (document, tracks) => ({
  ...document,
  tracks,
  duration: computeDuration(tracks),
  updatedAt: now(),
});

function overwriteTrackClips(clips, incoming, fps) {
  const frame = 1 / fps;
  const incomingStart = incoming.start;
  const incomingEnd = incoming.start + incoming.duration;
  return clips.flatMap((clip) => {
    const speed = clipSpeed(clip);
    const sourceIn = clipSourceIn(clip);
    const clipEnd = clip.start + clip.duration;
    if (clipEnd <= incomingStart || clip.start >= incomingEnd) return [clip];
    if (clip.start >= incomingStart && clipEnd <= incomingEnd) return [];
    if (clip.start < incomingStart && clipEnd > incomingEnd) {
      const leftDuration = incomingStart - clip.start;
      const rightDuration = clipEnd - incomingEnd;
      const left = { ...clip, duration: leftDuration, sourceOut: sourceIn + (leftDuration * speed) };
      const rightSourceIn = sourceIn + ((incomingEnd - clip.start) * speed);
      const right = { ...clip, id: `${clip.id}-overwrite-${Math.round(incomingEnd * fps)}`, start: incomingEnd, duration: rightDuration, sourceIn: rightSourceIn };
      delete right.transitionIn;
      return [left, right].filter((item) => item.duration >= frame);
    }
    if (clip.start < incomingStart) {
      const duration = incomingStart - clip.start;
      return duration >= frame ? [{ ...clip, duration, sourceOut: sourceIn + (duration * speed) }] : [];
    }
    const delta = incomingEnd - clip.start;
    const duration = clipEnd - incomingEnd;
    if (duration < frame) return [];
    const trimmed = { ...clip, start: incomingEnd, duration, sourceIn: sourceIn + (delta * speed) };
    delete trimmed.transitionIn;
    return [trimmed];
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
    updatedAt: now(),
  };
}

export function setTimelineIn(document, time = document.playhead) {
  const next = Math.max(0, Math.min(document.duration, Number(time) || 0));
  return { ...document, inPoint: document.outPoint == null ? next : Math.min(next, document.outPoint), updatedAt: now() };
}

export function setTimelineOut(document, time = document.playhead) {
  const next = Math.max(0, Math.min(document.duration, Number(time) || 0));
  return { ...document, inPoint: document.inPoint == null ? document.inPoint : Math.min(document.inPoint, next), outPoint: next, updatedAt: now() };
}

export function clearTimelineRange(document) {
  return { ...document, inPoint: null, outPoint: null, updatedAt: now() };
}

export function setFrameRate(document, fps) {
  const requested = Number(fps);
  if (!TIMELINE2_FRAME_RATES.includes(requested) || requested === document.fps) return document;
  return { ...document, fps: requested, updatedAt: now() };
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
  const next = { ...document, tracks, updatedAt: now() };
  if (!Array.isArray(document.trackOrder)) return next;
  // Keep a manual order: new video goes just above the topmost video, new text on top, new audio at the bottom.
  const order = getTimelineDisplayTracks(document).map((item) => item.id);
  if (normalized === 'audio') order.push(track.id);
  else if (normalized === 'text') order.unshift(track.id);
  else {
    const topVideo = order.findIndex((id) => document.tracks.find((item) => item.id === id)?.kind === 'video');
    order.splice(topVideo < 0 ? order.filter((id) => isVisualTrack(document.tracks.find((item) => item.id === id))).length : topVideo, 0, track.id);
  }
  return { ...next, trackOrder: order };
}

export function removeTrack(document, trackId) {
  const track = document.tracks.find((candidate) => candidate.id === trackId);
  if (!track?.userCreated || track.clips.length) return document;
  const next = { ...document, tracks: document.tracks.filter((candidate) => candidate.id !== trackId), updatedAt: now() };
  if (Array.isArray(document.trackOrder)) next.trackOrder = document.trackOrder.filter((id) => id !== trackId);
  return next;
}

export function renameTrack(document, trackId, name) {
  const value = String(name ?? '').trim().slice(0, TRACK_NAME_LIMIT);
  const index = document.tracks.findIndex((track) => track.id === trackId);
  if (index < 0 || !value || document.tracks[index].name === value) return document;
  const tracks = document.tracks.map(cloneTrack);
  tracks[index] = { ...tracks[index], name: value };
  return { ...document, tracks, updatedAt: now() };
}

/** Moves a track one row up or down inside its group (visual tracks or audio tracks). Locked tracks stay put. */
export function moveTrack(document, trackId, direction) {
  const display = getTimelineDisplayTracks(document);
  const track = display.find((item) => item.id === trackId);
  if (!track || track.locked || !['up', 'down'].includes(direction)) return document;
  const group = display.filter((item) => isVisualTrack(item) === isVisualTrack(track));
  const index = group.findIndex((item) => item.id === trackId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= group.length) return document;
  const reordered = [...group];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const other = display.filter((item) => isVisualTrack(item) !== isVisualTrack(track));
  const order = (isVisualTrack(track) ? [...reordered, ...other] : [...other, ...reordered]).map((item) => item.id);
  return { ...document, trackOrder: order, updatedAt: now() };
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
      sourceDuration: duration,
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

/** Returns a Portuguese reason when `kind` media cannot be placed on `trackId`, or '' when it can. */
export function getPlacementError(document, kind, trackId) {
  const normalized = kind === 'audio' ? 'audio' : kind === 'text' ? 'text' : 'video';
  const track = document.tracks.find((candidate) => candidate.id === trackId);
  if (!track) return 'Trilha não encontrada.';
  if (track.locked) return `${track.name} está travada.`;
  if (track.kind !== normalized) {
    const expected = normalized === 'audio' ? 'de áudio' : normalized === 'text' ? 'de texto' : 'de vídeo';
    return `Solte este item em uma trilha ${expected}.`;
  }
  return '';
}

/** First unlocked track of `kind` with no clip overlapping [start, start + duration), or null. */
export function findFreeTrack(document, kind, start, duration) {
  const from = Number(start) || 0;
  const to = from + Math.max(0, Number(duration) || 0);
  const track = document.tracks.find((candidate) => candidate.kind === kind && !candidate.locked
    && !(candidate.clips || []).some((clip) => clip.start < to && clip.start + clip.duration > from));
  return track?.id || null;
}

/** Puts a new element on a free track of its kind, creating a track when every one is busy (no overwrite). */
export function addClipOnFreeTrack(document, media, start = document.playhead) {
  const kind = media.kind === 'audio' ? 'audio' : media.kind === 'text' ? 'text' : 'video';
  const duration = Math.max(1 / safeFps(document), Number(media.duration) || 5);
  let next = document;
  let trackId = findFreeTrack(next, kind, start, duration);
  if (!trackId) {
    const before = new Set(next.tracks.map((track) => track.id));
    next = addTrack(next, kind);
    trackId = next.tracks.find((track) => !before.has(track.id))?.id;
  }
  return addMediaClip(next, { ...media, duration }, { trackId, start });
}

export function addMediaClip(document, media, { trackId, start = document.playhead } = {}) {
  const kind = media.kind === 'audio' ? 'audio' : media.kind === 'text' ? 'text' : 'video';
  const preferredTrack = trackId || (kind === 'audio' ? 'a1' : kind === 'text' ? 't1' : 'v1');
  const trackIndex = document.tracks.findIndex((track) => track.id === preferredTrack && track.kind === kind);
  if (trackIndex < 0 || document.tracks[trackIndex].locked) return document;
  const duration = Math.max(1 / safeFps(document), Number(media.duration) || 5);
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
    sourceDuration: Math.max(duration, Number(media.sourceDuration) || duration),
    src: media.src || null,
    mimeType: media.mimeType || null,
    origin: media.origin || 'project',
    properties: { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, speed: 1, ...(media.properties || {}) },
    selected: false,
  };
  tracks[trackIndex].clips = overwriteTrackClips(tracks[trackIndex].clips, incoming, safeFps(document));
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

function snapTargets(document, ignoredIds) {
  const ignored = ignoredIds instanceof Set ? ignoredIds : new Set([ignoredIds].filter(Boolean));
  const targets = [0, document.playhead];
  if (document.inPoint != null) targets.push(document.inPoint);
  if (document.outPoint != null) targets.push(document.outPoint);
  (document.markers || []).forEach((marker) => targets.push(Number(marker.time) || 0));
  document.tracks.forEach((track) => (track.clips || []).forEach((clip) => {
    if (!ignored.has(clip.id)) targets.push(clip.start, clip.start + clip.duration);
  }));
  return targets;
}

function snapTime(document, requested, ignoredClipId) {
  if (!document.snapEnabled) return requested;
  const tolerance = 0.12 / document.zoom;
  const closest = snapTargets(document, ignoredClipId).reduce((best, target) => best == null || Math.abs(target - requested) < Math.abs(best - requested) ? target : best, null);
  return Math.abs(closest - requested) <= tolerance ? closest : requested;
}

/** Snaps a clip start so that either its start or its end lands on the closest target (playhead, edges, markers, IN/OUT). */
export function snapClipStart(document, requestedStart, duration, ignoredIds) {
  if (!document.snapEnabled) return requestedStart;
  const tolerance = 0.12 / document.zoom;
  let best = null;
  snapTargets(document, ignoredIds).forEach((target) => {
    [[target, Math.abs(target - requestedStart)], [target - duration, Math.abs(target - (requestedStart + duration))]].forEach(([start, distance]) => {
      if (distance <= tolerance && (best == null || distance < best.distance)) best = { start, distance };
    });
  });
  return best ? best.start : requestedStart;
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
  const nextStart = Math.max(0, snapClipStart(document, Number(start) || 0, clip.duration, clipId));
  const incoming = { ...clip, trackId: destination.id, start: nextStart };
  tracks[destinationIndex].clips = overwriteTrackClips(tracks[destinationIndex].clips, incoming, safeFps(document));
  tracks[destinationIndex].clips.push(incoming);
  tracks[destinationIndex].clips.sort((a, b) => a.start - b.start);
  return replaceTracks(document, tracks);
}

/**
 * Moves a clip like `moveClip` and keeps its linked clips (video ↔ separated audio)
 * in sync by shifting them by the same time offset on their own tracks.
 */
export function moveClipWithLinked(document, clipId, options = {}) {
  const located = locateClip(document, clipId);
  if (!located) return document;
  const moved = moveClip(document, clipId, options);
  const linked = expandLinkedClipIds(document, [clipId]).filter((id) => id !== clipId);
  if (moved === document || !linked.length) return moved;
  const after = locateClip(moved, clipId);
  const delta = after ? after.clip.start - located.clip.start : 0;
  return Math.abs(delta) > 1e-9 ? moveClipsBy(moved, linked, delta) : moved;
}

/**
 * Moves several clips by the same time offset on their own tracks (group drag).
 * Clips on locked tracks are not moved; the offset never moves a clip before 0.
 */
export function moveClipsBy(document, clipIds, delta) {
  const wanted = new Set(clipIds);
  const movable = document.tracks.flatMap((track) => (track.locked ? [] : (track.clips || []).filter((clip) => wanted.has(clip.id)).map((clip) => ({ clip, trackId: track.id }))));
  if (!movable.length || !Number.isFinite(Number(delta))) return document;
  const offset = Math.max(-Math.min(...movable.map((item) => item.clip.start)), Number(delta));
  if (!offset) return document;
  const fps = safeFps(document);
  const tracks = document.tracks.map((track) => (track.locked ? cloneTrack(track) : { ...track, clips: (track.clips || []).filter((clip) => !wanted.has(clip.id)).map((clip) => ({ ...clip })) }));
  movable.forEach(({ clip, trackId }) => {
    const track = tracks.find((item) => item.id === trackId);
    const incoming = { ...clip, start: clip.start + offset };
    track.clips = overwriteTrackClips(track.clips, incoming, fps);
    track.clips.push(incoming);
    track.clips.sort((a, b) => a.start - b.start);
  });
  return replaceTracks(document, tracks);
}

export function trimClip(document, clipId, { edge, time } = {}) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked) return document;
  const frame = 1 / safeFps(document);
  const speed = clipSpeed(located.clip);
  const sourceIn = clipSourceIn(located.clip);
  const requested = snapTime(document, Number(time), clipId);
  const clipEnd = located.clip.start + located.clip.duration;
  const sourceDuration = Math.max(Number(located.clip.sourceOut) || 0, Number(located.clip.sourceDuration) || Number(located.clip.sourceOut) || 0);
  const neighbours = located.track.clips.filter((clip) => clip.id !== clipId);
  const previousEnd = neighbours.filter((clip) => clip.start + clip.duration <= located.clip.start).reduce((latest, clip) => Math.max(latest, clip.start + clip.duration), 0);
  const nextStart = neighbours.filter((clip) => clip.start >= clipEnd).reduce((earliest, clip) => Math.min(earliest, clip.start), Number.POSITIVE_INFINITY);
  if (edge === 'start') {
    const earliestSourceStart = Math.max(0, located.clip.start - (sourceIn / speed));
    const nextStartTime = Math.max(previousEnd, earliestSourceStart, Math.min(requested, clipEnd - frame));
    const delta = nextStartTime - located.clip.start;
    const tracks = document.tracks.map(cloneTrack);
    tracks[located.trackIndex].clips[located.clipIndex] = { ...located.clip, start: nextStartTime, duration: located.clip.duration - delta, sourceIn: sourceIn + (delta * speed), sourceDuration };
    return replaceTracks(document, tracks);
  }
  if (edge === 'end') {
    const latestSourceEnd = located.clip.start + ((sourceDuration - sourceIn) / speed);
    const nextEndTime = Math.max(located.clip.start + frame, Math.min(requested, latestSourceEnd, nextStart));
    const tracks = document.tracks.map(cloneTrack);
    const duration = nextEndTime - located.clip.start;
    tracks[located.trackIndex].clips[located.clipIndex] = { ...located.clip, duration, sourceOut: sourceIn + (duration * speed), sourceDuration };
    return replaceTracks(document, tracks);
  }
  return document;
}

export function splitClip(document, clipId, time) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked) return document;
  const fps = safeFps(document);
  const frame = 1 / fps;
  const splitAt = Number(time);
  const end = located.clip.start + located.clip.duration;
  if (splitAt < located.clip.start + frame || splitAt > end - frame) return document;
  const speed = clipSpeed(located.clip);
  const leftDuration = splitAt - located.clip.start;
  const rightDuration = end - splitAt;
  const sourceSplit = clipSourceIn(located.clip) + (leftDuration * speed);
  const properties = located.clip.properties || {};
  const left = { ...located.clip, duration: leftDuration, sourceOut: sourceSplit };
  const right = { ...located.clip, id: `${located.clip.id}-split-${Math.round(splitAt * fps)}`, start: splitAt, duration: rightDuration, sourceIn: sourceSplit };
  delete right.transitionIn;
  // A cut keeps the fade-in on the left part and the fade-out on the right part.
  if (properties.fadeOut) left.properties = { ...properties, fadeOut: 0 };
  if (properties.fadeIn) right.properties = { ...properties, fadeIn: 0 };
  if (located.clip.keyframes) {
    const shiftKeyframes = (list) => list.filter((item) => item.time >= leftDuration - 1e-9).map((item) => ({ ...item, time: item.time - leftDuration }));
    right.keyframes = Object.fromEntries(Object.entries(located.clip.keyframes).map(([property, list]) => [property, shiftKeyframes(list || [])]));
  }
  const tracks = document.tracks.map(cloneTrack);
  tracks[located.trackIndex].clips.splice(located.clipIndex, 1, left, right);
  return replaceTracks(document, tracks);
}

/** Splits every listed clip that crosses `time`. When `clipIds` is empty, splits all clips under `time` on unlocked tracks. */
export function splitClipsAtTime(document, clipIds, time) {
  const at = Number(time);
  const ids = clipIds?.length
    ? clipIds
    : document.tracks.flatMap((track) => (track.locked ? [] : track.clips.filter((clip) => at > clip.start && at < clip.start + clip.duration).map((clip) => clip.id)));
  return ids.reduce((current, id) => splitClip(current, id, at), document);
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
  const frame = 1 / safeFps(document);
  const copy = { ...located.clip, id: `${located.clip.id}-copy-${Date.now()}`, name: `${located.clip.name} (cópia)`, start: located.clip.start + located.clip.duration + frame };
  tracks[located.trackIndex].clips.push(copy);
  tracks[located.trackIndex].clips.sort((a, b) => a.start - b.start);
  return replaceTracks(document, tracks);
}

// Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md (ripple/diff.ts e ripple/apply.ts):
// intervals are normalized (sorted and merged) and subtracted so a gap is closed only once.
function normalizeIntervals(intervals) {
  const sorted = intervals.filter((item) => item.end > item.start).map((item) => ({ ...item })).sort((left, right) => left.start - right.start);
  return sorted.reduce((merged, interval) => {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push(interval);
    return merged;
  }, []);
}

function subtractIntervals(sources, blockers) {
  const normalizedBlockers = normalizeIntervals(blockers);
  return normalizeIntervals(sources).flatMap((source) => normalizedBlockers.reduce((remaining, blocker) => remaining.flatMap((piece) => {
    if (blocker.end <= piece.start || blocker.start >= piece.end) return [piece];
    return [{ start: piece.start, end: blocker.start }, { start: blocker.end, end: piece.end }].filter((item) => item.end > item.start);
  }), [source]));
}

/** Clips linked by audio separation (video ↔ its separated audio) that should follow `clipIds`. */
export function expandLinkedClipIds(document, clipIds) {
  const ids = new Set(clipIds);
  document.tracks.forEach((track) => track.clips.forEach((clip) => {
    if (clip.linkedTo && ids.has(clip.linkedTo)) ids.add(clip.id);
  }));
  document.tracks.forEach((track) => track.clips.forEach((clip) => {
    if (ids.has(clip.id) && clip.linkedTo) ids.add(clip.linkedTo);
  }));
  return [...ids];
}

/**
 * Removes the clips and closes the freed time on each affected, unlocked track.
 * Freed intervals are the removed spans minus spans still occupied by remaining clips
 * of that track; each interval shifts later clips of the same track left by its length.
 * Locked tracks are never edited nor shifted. With `includeLinked`, separated audio/video
 * partners are removed too so linked tracks stay in sync.
 */
export function rippleDelete(document, clipIds, { includeLinked = false } = {}) {
  const wanted = new Set(includeLinked ? expandLinkedClipIds(document, clipIds) : clipIds);
  let changed = false;
  const tracks = document.tracks.map((track) => {
    if (track.locked) return cloneTrack(track);
    const removed = track.clips.filter((clip) => wanted.has(clip.id));
    if (!removed.length) return cloneTrack(track);
    changed = true;
    const remaining = track.clips.filter((clip) => !wanted.has(clip.id));
    const freed = subtractIntervals(
      removed.map((clip) => ({ start: clip.start, end: clip.start + clip.duration })),
      remaining.map((clip) => ({ start: clip.start, end: clip.start + clip.duration })),
    );
    return {
      ...track,
      clips: remaining.map((clip) => {
        const shift = freed.filter((interval) => clip.start >= interval.end - 1e-9).reduce((total, interval) => total + (interval.end - interval.start), 0);
        return { ...clip, start: Math.max(0, clip.start - shift) };
      }),
    };
  });
  return changed ? replaceTracks(document, tracks) : document;
}

/**
 * Extracts the time range [start, end) from every unlocked track: clips are cut at the
 * boundaries, the inside is removed and later clips move left by the range length.
 * Locked tracks keep their clips untouched. Markers inside are removed and later markers shift.
 */
export function extractRange(document, start, end) {
  const from = Math.max(0, Math.min(Number(start), Number(end)));
  const to = Math.max(Number(start), Number(end));
  const fps = safeFps(document);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to - from < (1 / fps) - 1e-9) return document;
  const length = to - from;
  let changed = false;
  const tracks = document.tracks.map((track) => {
    if (track.locked) return cloneTrack(track);
    const clips = overwriteTrackClips(track.clips, { start: from, duration: length }, fps)
      .map((clip) => (clip.start >= to - 1e-9 ? { ...clip, start: clip.start - length } : { ...clip }));
    if (clips.length !== track.clips.length || clips.some((clip, index) => clip.start !== track.clips[index]?.start || clip.duration !== track.clips[index]?.duration)) changed = true;
    return { ...track, clips };
  });
  if (!changed) return document;
  const markers = (document.markers || [])
    .filter((marker) => marker.time < from || marker.time >= to)
    .map((marker) => (marker.time >= to ? { ...marker, time: marker.time - length } : marker));
  const next = replaceTracks({ ...document, markers, inPoint: null, outPoint: null }, tracks);
  return { ...next, playhead: Math.min(from, next.duration) };
}

/** Clips intersecting a time range on the given tracks (marquee selection). */
export function getClipsInRegion(document, { start, end, trackIds }) {
  const from = Math.min(Number(start), Number(end));
  const to = Math.max(Number(start), Number(end));
  const allowed = new Set(trackIds || document.tracks.map((track) => track.id));
  return document.tracks.flatMap((track) => (allowed.has(track.id)
    ? track.clips.filter((clip) => clip.start < to && clip.start + clip.duration > from).map((clip) => clip.id)
    : []));
}

/** Snapshot of clips for the editor clipboard. */
export function copyClips(document, clipIds) {
  const wanted = new Set(clipIds);
  return document.tracks.flatMap((track) => track.clips.filter((clip) => wanted.has(clip.id)).map((clip) => ({ trackId: track.id, clip: JSON.parse(JSON.stringify(clip)) })));
}

export const pastedClipId = (clipId, token) => `${clipId}-paste-${token}`;

/**
 * Pastes clipboard items keeping their relative timing, with the earliest at `time`.
 * Each item goes to its original track when it still exists, is unlocked and compatible;
 * otherwise to the first compatible unlocked track. Items without a destination are skipped.
 */
export function pasteClips(document, items, time = document.playhead, { token = Date.now() } = {}) {
  if (!items?.length) return document;
  const origin = Math.min(...items.map((item) => item.clip.start));
  const offset = Math.max(0, Number(time) || 0) - origin;
  const fps = safeFps(document);
  const pastedIds = new Map(items.map((item) => [item.clip.id, pastedClipId(item.clip.id, token)]));
  const tracks = document.tracks.map(cloneTrack);
  let pasted = 0;
  items.forEach(({ trackId, clip }) => {
    const compatible = (track) => !track.locked && track.kind === clip.kind;
    const track = tracks.find((item) => item.id === trackId && compatible(item)) || tracks.find(compatible);
    if (!track) return;
    const incoming = { ...JSON.parse(JSON.stringify(clip)), id: pastedIds.get(clip.id), trackId: track.id, start: Math.max(0, clip.start + offset) };
    if (incoming.linkedTo) {
      if (pastedIds.has(incoming.linkedTo)) incoming.linkedTo = pastedIds.get(incoming.linkedTo);
      else delete incoming.linkedTo;
    }
    track.clips = overwriteTrackClips(track.clips, incoming, fps);
    track.clips.push(incoming);
    track.clips.sort((a, b) => a.start - b.start);
    pasted += 1;
  });
  return pasted ? replaceTracks(document, tracks) : document;
}

/** Duplicates the clips right after the end of the selection, on the same tracks. */
export function duplicateClips(document, clipIds, { token = Date.now() } = {}) {
  const items = copyClips(document, clipIds).filter((item) => !document.tracks.find((track) => track.id === item.trackId)?.locked);
  if (!items.length) return document;
  const end = Math.max(...items.map((item) => item.clip.start + item.clip.duration));
  return pasteClips(document, items, end, { token });
}

export function updateClipProperties(document, clipId, properties) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked) return document;
  const tracks = document.tracks.map(cloneTrack);
  tracks[located.trackIndex].clips[located.clipIndex] = { ...located.clip, properties: { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, speed: 1, ...(located.clip.properties || {}), ...properties } };
  return replaceTracks(document, tracks);
}

/**
 * Changes playback speed keeping the same source span: the timeline duration becomes
 * span / speed (limited by the next clip on the track). Keyframe times are rescaled.
 * Linked separated audio/video partners on unlocked tracks follow the same change.
 */
export function setClipSpeed(document, clipId, speed) {
  const requested = Math.max(0.25, Math.min(4, Number(speed) || 1));
  const located = locateClip(document, clipId);
  if (!located || located.track.locked || clipSpeed(located.clip) === requested) return document;
  const fps = safeFps(document);
  const tracks = document.tracks.map(cloneTrack);
  const retime = (trackIndex, clipIndex) => {
    const track = tracks[trackIndex];
    if (track.locked) return;
    const clip = track.clips[clipIndex];
    const oldSpeed = clipSpeed(clip);
    const sourceSpan = clip.duration * oldSpeed;
    const nextStart = track.clips.filter((item) => item.id !== clip.id && item.start >= clip.start + clip.duration - 1e-9).reduce((earliest, item) => Math.min(earliest, item.start), Number.POSITIVE_INFINITY);
    const duration = Math.max(1 / fps, Math.min(sourceSpan / requested, nextStart - clip.start));
    const ratio = duration / clip.duration;
    const keyframes = clip.keyframes
      ? Object.fromEntries(Object.entries(clip.keyframes).map(([property, list]) => [property, (list || []).map((item) => ({ ...item, time: Math.min(duration, item.time * ratio) }))]))
      : clip.keyframes;
    track.clips[clipIndex] = {
      ...clip,
      duration,
      sourceOut: clipSourceIn(clip) + (duration * requested),
      properties: { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, ...(clip.properties || {}), speed: requested },
      ...(keyframes ? { keyframes } : {}),
    };
  };
  expandLinkedClipIds(document, [clipId]).forEach((id) => {
    const target = locateClip({ tracks }, id);
    if (target) retime(target.trackIndex, target.clipIndex);
  });
  return replaceTracks(document, tracks);
}

/** Clip on the same track that ends exactly where `clipId` starts (within half a frame). */
export function getPreviousAdjacentClip(document, clipId) {
  const located = locateClip(document, clipId);
  if (!located) return null;
  const tolerance = 0.5 / safeFps(document);
  return located.track.clips.find((clip) => clip.id !== clipId && Math.abs((clip.start + clip.duration) - located.clip.start) <= tolerance) || null;
}

/** Sets (or removes with `null`) the incoming transition between a clip and its adjacent previous clip. */
export function setClipTransition(document, clipId, transition) {
  const located = locateClip(document, clipId);
  if (!located || located.track.locked) return document;
  const tracks = document.tracks.map(cloneTrack);
  const target = tracks[located.trackIndex].clips[located.clipIndex];
  if (!transition) {
    if (!target.transitionIn) return document;
    delete target.transitionIn;
    return replaceTracks(document, tracks);
  }
  const previous = getPreviousAdjacentClip(document, clipId);
  if (!previous || !TIMELINE2_TRANSITIONS.some((item) => item.id === transition.type)) return document;
  const frame = 1 / safeFps(document);
  const duration = Math.max(frame, Math.min(Number(transition.duration) || 1, located.clip.duration, previous.duration));
  target.transitionIn = { type: transition.type, duration };
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
  const keyframes = existing.filter((item) => Math.abs(item.time - localTime) > (0.5 / safeFps(document)));
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
    if (Math.abs(item.time - localTime) > (0.5 / safeFps(document))) return item;
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
    if (!keyframes?.length) return;
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

/** 0..1 multiplier from the clip fade-in/fade-out (seconds in `properties.fadeIn` / `properties.fadeOut`). */
export function getClipFadeFactor(clip, programTime) {
  const local = Number(programTime) - clip.start;
  const fadeIn = Math.max(0, Number(clip.properties?.fadeIn) || 0);
  const fadeOut = Math.max(0, Number(clip.properties?.fadeOut) || 0);
  const inFactor = fadeIn > 0 ? local / fadeIn : 1;
  const outFactor = fadeOut > 0 ? (clip.duration - local) / fadeOut : 1;
  return Math.max(0, Math.min(1, inFactor, outFactor));
}

/** CSS filter string for the per-clip color/blur effects (neutral values produce 'none'). */
export function getClipFilterCss(properties = {}) {
  const brightness = Number(properties.brightness ?? 100);
  const contrast = Number(properties.contrast ?? 100);
  const saturation = Number(properties.saturation ?? 100);
  const blur = Math.max(0, Number(properties.blur ?? 0));
  const parts = [];
  if (brightness !== 100) parts.push(`brightness(${brightness / 100})`);
  if (contrast !== 100) parts.push(`contrast(${contrast / 100})`);
  if (saturation !== 100) parts.push(`saturate(${saturation / 100})`);
  if (blur > 0) parts.push(`blur(${blur}px)`);
  return parts.length ? parts.join(' ') : 'none';
}

export function addTextClip(document, text, options = {}) {
  const value = String(text || '').trim();
  if (!value) return document;
  return addMediaClip(document, { id: `text-${Date.now()}`, clipId: options.clipId, name: value, kind: 'text', duration: options.duration || 5, origin: 'editor', properties: options.properties }, { trackId: options.trackId || 't1', start: options.start ?? document.playhead });
}

export function addMarker(document, { time = document.playhead, label = 'Marcador', color = '#f59e0b' } = {}) {
  const markerTime = Math.max(0, Math.min(document.duration, Number(time) || 0));
  return { ...document, markers: [...document.markers, { id: `marker-${Date.now()}-${document.markers.length}`, time: markerTime, label, color }], updatedAt: now() };
}

export function toggleTrackState(document, trackId, field) {
  if (!['locked', 'muted', 'hidden'].includes(field)) return document;
  const index = document.tracks.findIndex((track) => track.id === trackId);
  if (index < 0) return document;
  const tracks = document.tracks.map(cloneTrack);
  tracks[index] = { ...tracks[index], [field]: !tracks[index][field] };
  return { ...document, tracks, updatedAt: now() };
}

export function setPlayhead(document, time) {
  return { ...document, playhead: Math.max(0, Math.min(document.duration, Number(time) || 0)) };
}

/** Moves the playhead by whole frames of the document rate, from the nearest frame. */
export function stepFrames(document, frames) {
  const fps = safeFps(document);
  const current = Math.floor(((Number(document.playhead) || 0) * fps) + 1e-6);
  return setPlayhead(document, (current + Math.trunc(Number(frames) || 0)) / fps);
}

export function setZoom(document, zoom) {
  return { ...document, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoom) || 1)) };
}

export function toggleSnapping(document) {
  return { ...document, snapEnabled: !document.snapEnabled };
}

export function toggleRippleEditing(document) {
  return { ...document, rippleEnabled: !document.rippleEnabled };
}

function transitionFactor(track, clip, programTime, fps) {
  const tolerance = 0.5 / fps;
  let factor = 1;
  const incoming = clip.transitionIn;
  const previous = incoming && track.clips.find((item) => item.id !== clip.id && Math.abs((item.start + item.duration) - clip.start) <= tolerance);
  if (incoming && previous) {
    const local = programTime - clip.start;
    if (incoming.type === 'crossfade' && local < incoming.duration) factor *= local / incoming.duration;
    if (incoming.type === 'dip' && local < incoming.duration / 2) factor *= local / (incoming.duration / 2);
  }
  const clipEnd = clip.start + clip.duration;
  const next = track.clips.find((item) => item.id !== clip.id && item.transitionIn?.type === 'dip' && Math.abs(item.start - clipEnd) <= tolerance);
  if (next) {
    const half = next.transitionIn.duration / 2;
    if (clipEnd - programTime < half) factor *= (clipEnd - programTime) / half;
  }
  return { factor: Math.max(0, Math.min(1, factor)), crossfadeFrom: incoming?.type === 'crossfade' && previous && programTime - clip.start < incoming.duration ? previous : null };
}

export function getActiveClips(document, time = document.playhead) {
  const programTime = Math.max(0, Number(time) || 0);
  const fps = safeFps(document);
  const layers = getVisualLayerMap(document);
  return document.tracks.flatMap((track, arrayIndex) => {
    if (track.hidden || (track.kind === 'audio' && track.muted)) return [];
    const layerIndex = track.kind === 'audio' ? arrayIndex : (layers.get(track.id) ?? arrayIndex);
    return (track.clips || [])
      .filter((clip) => programTime >= clip.start && programTime < clip.start + clip.duration)
      .flatMap((clip) => {
        const properties = getClipPropertiesAtTime(clip, programTime);
        const speed = clipSpeed({ properties });
        const transition = transitionFactor(track, clip, programTime, fps);
        const active = {
          ...clip,
          properties,
          layerIndex,
          muted: Boolean(track.muted),
          fade: getClipFadeFactor(clip, programTime) * transition.factor,
          sourceTime: clipSourceIn(clip) + ((programTime - clip.start) * speed),
        };
        if (!transition.crossfadeFrom) return [active];
        // Crossfade: the outgoing clip keeps playing past its OUT point (source handle) underneath the incoming one.
        const outgoing = transition.crossfadeFrom;
        const outgoingProperties = getClipPropertiesAtTime(outgoing, outgoing.start + outgoing.duration);
        return [{
          ...outgoing,
          properties: outgoingProperties,
          layerIndex,
          muted: Boolean(track.muted),
          transitionRole: 'outgoing',
          fade: track.kind === 'audio' ? 1 - transition.factor : 1,
          sourceTime: clipSourceIn(outgoing) + ((programTime - outgoing.start) * clipSpeed({ properties: outgoingProperties })),
        }, active];
      });
  });
}
