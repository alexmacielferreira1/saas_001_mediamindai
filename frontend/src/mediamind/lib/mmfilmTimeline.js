const TRACK_ORDER = ["V3", "V2", "V1", "A1", "A2", "A3"];

export function timelineTimeFromPointer(clientX, left, zoom, duration = 60) {
  return Math.max(0, Math.min(duration, (clientX - left) / zoom));
}

export function clipsInsideMarquee(clips, area) {
  const firstTrack = TRACK_ORDER.indexOf(area.startTrack);
  const lastTrack = TRACK_ORDER.indexOf(area.endTrack);
  const minTrack = Math.min(firstTrack, lastTrack);
  const maxTrack = Math.max(firstTrack, lastTrack);
  const minTime = Math.min(area.startTime, area.endTime);
  const maxTime = Math.max(area.startTime, area.endTime);
  return clips
    .filter((clip) => {
      const track = TRACK_ORDER.indexOf(clip.track);
      return (
        track >= minTrack &&
        track <= maxTrack &&
        clip.start < maxTime &&
        clip.start + clip.duration > minTime
      );
    })
    .map((clip) => clip.id);
}

export function clipMediaTime(clip, playhead) {
  return Math.max(
    0,
    (clip.sourceIn || 0) +
      Math.max(0, playhead - clip.start) * ((clip.speed || 100) / 100),
  );
}
