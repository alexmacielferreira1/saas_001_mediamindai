const FPS = 30;
const FC_TICKS = 254016000000;

const esc = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const frames = (seconds) => Math.round(Number(seconds || 0) * FPS);
const seconds = (ticks) => Number(ticks || 0) / FC_TICKS;
const comparableName = (value = "") =>
  String(value)
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    .trim()
    .toLocaleLowerCase();

export function relinkImportedMedia({
  media,
  clips,
  linked,
  onlyExisting = false,
}) {
  const name = comparableName(linked.name);
  const existing = media.find((asset) => comparableName(asset.name) === name);
  if (!existing && onlyExisting) return { media, clips, matched: false };
  const assetId = existing?.id || linked.id;
  const hydrated = { ...existing, ...linked, id: assetId, offline: false };
  return {
    matched: Boolean(existing),
    media: existing
      ? media.map((asset) => (asset.id === existing.id ? hydrated : asset))
      : [...media, hydrated],
    clips: clips.map((clip) =>
      clip.assetId === existing?.id || comparableName(clip.name) === name
        ? {
            ...clip,
            assetId,
            type: linked.type,
            url: linked.url,
            offline: false,
          }
        : clip,
    ),
  };
}

export function relinkAssetById({ media, clips, assetId, linked }) {
  const existing = media.find((asset) => asset.id === assetId);
  if (!existing) return { media, clips, matched: false };
  const hydrated = {
    ...existing,
    type: linked.type || existing.type,
    size: linked.size ?? existing.size,
    duration: linked.duration ?? existing.duration,
    url: linked.url,
    linkedFileName: linked.name,
    offline: false,
  };
  return {
    matched: true,
    media: media.map((asset) => (asset.id === assetId ? hydrated : asset)),
    clips: clips.map((clip) =>
      clip.assetId === assetId
        ? {
            ...clip,
            type: hydrated.type,
            url: linked.url,
            offline: false,
          }
        : clip,
    ),
  };
}

export function createMMFilmProject({
  sequence,
  media,
  clips,
  markers,
  trackState,
}) {
  return {
    format: "mediamind.mmfilm.project",
    schemaVersion: 1,
    generator: "MediaMind MMFilm",
    project: {
      name: sequence,
      settings: {
        width: 1920,
        height: 1080,
        fps: 29.97,
        sampleRate: 48000,
        workingSpace: "Rec. 709",
      },
      bins: ["Mídias", "Áudio", "Gráficos", "Sequências"],
      media: media.map(({ id, name, type, size = 0 }) => ({
        id,
        name,
        type,
        size,
        offline: true,
      })),
      sequence: { name: sequence, clips, markers, tracks: trackState },
    },
  };
}

export function createFilmCraftProject({ sequence, media, clips, markers }) {
  const items = {};
  media.forEach((asset, index) => {
    const id = index + 1;
    items[id] = {
      id,
      name: asset.name,
      label: "Iris",
      kind: {
        Media: {
          media: { File: asset.name },
          info: {
            name: asset.name,
            kind: asset.type?.startsWith("audio") ? "AudioOnly" : "Movie",
            duration: FC_TICKS * 8,
            video: asset.type?.startsWith("audio")
              ? null
              : {
                  width: 1920,
                  height: 1080,
                  frame_rate: { num: 30000, den: 1001 },
                  par: [1, 1],
                  codec: "Linked media",
                },
            audio_streams: asset.type?.startsWith("image")
              ? []
              : [{ sample_rate: 48000, channels: 2, codec: "Linked audio" }],
            container: "External",
            start_timecode: null,
            file_size: asset.size || null,
          },
          interpret: {
            frame_rate: null,
            par: null,
            ignore_alpha: false,
            invert_alpha: false,
          },
          markers: [],
          offline: true,
          proxy: null,
        },
      },
      metadata: {},
      created: id,
    };
  });
  const sequenceId = media.length + 10;
  const track = (id, kind) => ({
    id,
    kind,
    name: `${kind} ${id}`,
    items: clips
      .filter((clip) => clip.track === `${kind === "Video" ? "V" : "A"}${id}`)
      .map((clip, index) => ({
        id: sequenceId + id * 100 + index,
        item: Math.max(
          1,
          media.findIndex((asset) => asset.name === clip.name) + 1,
        ),
        name: clip.name,
        label: "Iris",
        start: Math.round(clip.start * FC_TICKS),
        duration: Math.round(clip.duration * FC_TICKS),
        source_in: 0,
        speed: (clip.speed || 100) / 100,
        reverse: false,
        enabled: clip.enabled !== false,
        link: null,
        group: null,
        effects: [],
        markers: [],
        gain_db: 0,
        frame_hold: null,
        scale_to_frame: false,
      })),
    transitions: [],
    locked: false,
    sync_lock: true,
    enabled: true,
    muted: false,
    solo: false,
    channels: "Stereo",
    volume_db: 0,
    pan: 0,
    effects: [],
    mixer: {
      mode: "Read",
      output: null,
      record_arm: false,
      solo_safe: false,
      input_map: "Stereo",
    },
  });
  items[sequenceId] = {
    id: sequenceId,
    name: sequence,
    label: "Forest",
    kind: {
      Sequence: {
        settings: {
          width: 1920,
          height: 1080,
          frame_rate: { num: 30000, den: 1001 },
          par: [1, 1],
          sample_rate: 48000,
          drop_frame: true,
          preset: "HD 1080p 29.97",
          audio_master: "Stereo",
          preview_codec: "ProRes 422",
          working_space: "Rec. 709",
        },
        video_tracks: [1, 2, 3].map((id) => track(id, "Video")),
        audio_tracks: [1, 2, 3].map((id) => track(id, "Audio")),
        markers: markers.map((start, id) => ({
          id: 800000 + id,
          start: Math.round(start * FC_TICKS),
          duration: 0,
          name: `Marcador ${id + 1}`,
          comment: "",
          kind: "Comment",
          color: "Green",
        })),
        mark_in: null,
        mark_out: null,
        work_area: null,
        start_timecode: 0,
        master_volume_db: 0,
        master_effects: [],
        submix_tracks: [],
        caption_tracks: [],
      },
    },
    metadata: {},
    created: sequenceId,
  };
  return {
    format: "filmcraft.project",
    schema_version: 13,
    generator: "MediaMind MMFilm",
    project: {
      name: sequence,
      settings: {
        renderer: "FilmCraft GPU Acceleration (wgpu)",
        video_display: "Timecode",
        audio_display_samples: true,
      },
      root: {
        id: 0,
        name: sequence,
        children: [
          {
            Bin: {
              id: 1,
              name: "Footage",
              children: media.map((_, index) => ({ Item: index + 1 })),
            },
          },
          {
            Bin: { id: 2, name: "Sequences", children: [{ Item: sequenceId }] },
          },
        ],
      },
      items,
      next_id: sequenceId + 1,
    },
    view: {
      open_sequences: [sequenceId],
      active_sequence: sequenceId,
      sequences: {},
    },
  };
}

export function createFcp7Xml({ sequence, clips, markers = [] }) {
  const clipXml = (clip, index) =>
    `<clipitem id="clipitem-${index + 1}"><name>${esc(clip.name)}</name><duration>${frames(clip.duration)}</duration><rate><timebase>${FPS}</timebase><ntsc>TRUE</ntsc></rate><start>${frames(clip.start)}</start><end>${frames(clip.start + clip.duration)}</end><in>0</in><out>${frames(clip.duration)}</out><file id="file-${index + 1}"><name>${esc(clip.name)}</name><pathurl>file://localhost/${encodeURI(clip.name)}</pathurl><rate><timebase>${FPS}</timebase><ntsc>TRUE</ntsc></rate><duration>${frames(clip.duration)}</duration></file></clipitem>`;
  let itemIndex = 0;
  const tracksXml = (prefix) =>
    [1, 2, 3]
      .map((track) =>
        clips.filter((clip) => clip.track === `${prefix}${track}`),
      )
      .filter((trackClips) => trackClips.length)
      .map(
        (trackClips) =>
          `<track>${trackClips.map((clip) => clipXml(clip, itemIndex++)).join("")}</track>`,
      )
      .join("");
  const markerXml = markers
    .map(
      (marker, index) =>
        `<marker><name>Marcador ${index + 1}</name><in>${frames(marker)}</in><out>-1</out></marker>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE xmeml><xmeml version="5"><sequence id="sequence-1"><name>${esc(sequence)}</name><duration>${Math.max(1, ...clips.map((clip) => frames(clip.start + clip.duration)))}</duration><rate><timebase>${FPS}</timebase><ntsc>TRUE</ntsc></rate>${markerXml}<media><video><format><samplecharacteristics><width>1920</width><height>1080</height></samplecharacteristics></format>${tracksXml("V")}</video><audio><format><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics></format>${tracksXml("A")}</audio></media></sequence></xmeml>`;
}

export function createFcpxml({ sequence, clips }) {
  const duration = Math.max(
    1,
    ...clips.map((clip) => frames(clip.start + clip.duration)),
  );
  const assets = clips
    .map(
      (clip, index) =>
        `<asset id="r${index + 2}" name="${esc(clip.name)}" src="file:///${encodeURI(clip.name)}" start="0s" duration="${frames(clip.duration)}/${FPS}s" hasVideo="${clip.track.startsWith("V") ? "1" : "0"}" hasAudio="${clip.track.startsWith("A") ? "1" : "0"}"/>`,
    )
    .join("");
  const spine = clips
    .map(
      (clip) =>
        `<asset-clip ref="r${clips.indexOf(clip) + 2}" name="${esc(clip.name)}" offset="${frames(clip.start)}/${FPS}s" start="0s" duration="${frames(clip.duration)}/${FPS}s" lane="${clip.track.startsWith("A") ? -Number(clip.track.slice(1)) : Number(clip.track.slice(1)) - 1}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE fcpxml><fcpxml version="1.10"><resources><format id="r1" name="FFVideoFormat1080p30" frameDuration="1/${FPS}s" width="1920" height="1080"/>${assets}</resources><library><event name="MMFilm"><project name="${esc(sequence)}"><sequence format="r1" duration="${duration}/${FPS}s" tcStart="0s" tcFormat="NDF"><spine>${spine}</spine></sequence></project></event></library></fcpxml>`;
}

const tc = (value) => {
  const total = frames(value);
  const ff = total % FPS;
  const secondsTotal = Math.floor(total / FPS);
  return `${String(Math.floor(secondsTotal / 3600)).padStart(2, "0")}:${String(Math.floor((secondsTotal % 3600) / 60)).padStart(2, "0")}:${String(secondsTotal % 60).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
};
export function createEdl({ sequence, clips }) {
  const rows = clips
    .filter((clip) => clip.track === "V1")
    .sort((a, b) => a.start - b.start)
    .map(
      (clip, index) =>
        `${String(index + 1).padStart(3, "0")}  AX       V     C        ${tc(0)} ${tc(clip.duration)} ${tc(clip.start)} ${tc(clip.start + clip.duration)}\n* FROM CLIP NAME: ${clip.name}`,
    );
  return `TITLE: ${sequence}\nFCM: NON-DROP FRAME\n\n${rows.join("\n\n")}\n`;
}

const rationalTime = (value) => ({
  OTIO_SCHEMA: "RationalTime.1",
  rate: FPS,
  value: frames(value),
});
const timeRange = (start, duration) => ({
  OTIO_SCHEMA: "TimeRange.1",
  start_time: rationalTime(start),
  duration: rationalTime(duration),
});

export function createOtio({ sequence, clips, markers = [] }) {
  const trackIds = ["V1", "V2", "V3", "A1", "A2", "A3"];
  const tracks = trackIds
    .map((trackId) => {
      let cursor = 0;
      const children = [];
      clips
        .filter((clip) => clip.track === trackId)
        .sort((a, b) => a.start - b.start)
        .forEach((clip) => {
          if (clip.start > cursor) {
            children.push({
              OTIO_SCHEMA: "Gap.1",
              effects: [],
              markers: [],
              metadata: {},
              name: "",
              source_range: timeRange(0, clip.start - cursor),
            });
          }
          children.push({
            OTIO_SCHEMA: "Clip.2",
            effects: [],
            enabled: clip.enabled !== false,
            markers: [],
            metadata: { mediamind: { clipId: clip.id, track: clip.track } },
            name: clip.name,
            source_range: timeRange(clip.sourceIn || 0, clip.duration),
            media_references: {
              DEFAULT_MEDIA: {
                OTIO_SCHEMA: "ExternalReference.1",
                available_range: null,
                metadata: {},
                name: clip.name,
                target_url: clip.path || clip.name,
              },
            },
            active_media_reference_key: "DEFAULT_MEDIA",
          });
          cursor = Math.max(cursor, clip.start + clip.duration);
        });
      return children.length
        ? {
            OTIO_SCHEMA: "Track.1",
            children,
            effects: [],
            enabled: true,
            kind: trackId.startsWith("A") ? "Audio" : "Video",
            markers: [],
            metadata: { mediamind: { trackId } },
            name: trackId,
            source_range: null,
          }
        : null;
    })
    .filter(Boolean);
  return {
    OTIO_SCHEMA: "Timeline.1",
    metadata: { mediamind: { markersSeconds: markers } },
    name: sequence,
    global_start_time: rationalTime(0),
    tracks: {
      OTIO_SCHEMA: "Stack.1",
      children: tracks,
      effects: [],
      enabled: true,
      markers: [],
      metadata: {},
      name: "tracks",
      source_range: null,
    },
  };
}

export function importProjectDocument(text, fileName = "project") {
  if (/\.edl$/i.test(fileName)) return importEdl(text, fileName);
  if (/^\s*<\?xml|^\s*<xmeml|^\s*<fcpxml/i.test(text)) {
    return /<fcpxml[\s>]/i.test(text)
      ? importFcpxml(text, fileName)
      : importFcp7Xml(text, fileName);
  }
  const data = JSON.parse(text);
  if (data.OTIO_SCHEMA?.startsWith("Timeline."))
    return importOtio(data, fileName);
  if (data.format === "mediamind.mmfilm.project")
    return {
      sequence: data.project.name,
      media: data.project.media || [],
      clips: data.project.sequence?.clips || [],
      markers: data.project.sequence?.markers || [],
      trackState: data.project.sequence?.tracks,
    };
  if (data.format === "filmcraft.project") {
    const entries = Object.values(data.project?.items || {});
    const sequenceItem = entries.find((item) => item.kind?.Sequence);
    const media = entries
      .filter((item) => item.kind?.Media)
      .map((item) => {
        const source = item.kind.Media.media || {};
        const originalPath = source.File || null;
        return {
          id: String(item.id),
          name: item.name,
          type:
            item.kind.Media.info?.kind === "AudioOnly"
              ? "audio/*"
              : "video/*",
          size: item.kind.Media.info?.file_size || 0,
          originalPath,
          sourceKind: source.Generator ? "FilmCraft Generator" : "Arquivo",
          offline: true,
        };
      });
    const seq = sequenceItem?.kind?.Sequence;
    const clips = [
      ...(seq?.video_tracks || []),
      ...(seq?.audio_tracks || []),
    ].flatMap((track, trackIndex) =>
      (track.items || []).map((item) => ({
        id: String(item.id),
        assetId: String(item.item),
        name: item.name,
        type: track.kind === "Audio" ? "audio/*" : "video/*",
        track: `${track.kind === "Audio" ? "A" : "V"}${(trackIndex % 3) + 1}`,
        start: seconds(item.start),
        duration: seconds(item.duration),
        speed: Math.round((item.speed || 1) * 100),
        opacity: 100,
        volume: 100,
        enabled: item.enabled !== false,
        keyframes: [],
      })),
    );
    return {
      sequence:
        sequenceItem?.name ||
        data.project?.name ||
        fileName.replace(/\.fcproj$/i, ""),
      media,
      clips,
      markers: (seq?.markers || []).map((marker) => seconds(marker.start)),
    };
  }
  if (Array.isArray(data.clips))
    return {
      sequence: data.sequence || fileName,
      media: data.media || [],
      clips: data.clips,
      markers: data.markers || [],
    };
  throw new Error("Formato de projeto não reconhecido");
}

function otioSeconds(time) {
  return Number(time?.value || 0) / Number(time?.rate || FPS);
}

function importOtio(data, fileName) {
  const clips = [];
  let videoIndex = 0;
  let audioIndex = 0;
  for (const track of data.tracks?.children || []) {
    const isAudio = track.kind === "Audio";
    const fallbackIndex = isAudio ? ++audioIndex : ++videoIndex;
    const trackId =
      track.metadata?.mediamind?.trackId ||
      `${isAudio ? "A" : "V"}${Math.min(fallbackIndex, 3)}`;
    let cursor = 0;
    for (const child of track.children || []) {
      const duration = otioSeconds(child.source_range?.duration);
      if (child.OTIO_SCHEMA?.startsWith("Gap.")) {
        cursor += duration;
        continue;
      }
      if (!child.OTIO_SCHEMA?.startsWith("Clip.")) continue;
      const id =
        child.metadata?.mediamind?.clipId || `otio-${clips.length + 1}`;
      const mediaReference =
        child.media_references?.[child.active_media_reference_key] ||
        child.media_reference;
      clips.push(
        importedClip({
          id,
          name: child.name || mediaReference?.name || "Clipe OTIO",
          track: trackId,
          start: cursor,
          duration,
        }),
      );
      cursor += duration;
    }
  }
  return {
    sequence: data.name || fileName.replace(/\.otio$/i, ""),
    media: mediaFromClips(clips),
    clips,
    markers: data.metadata?.mediamind?.markersSeconds || [],
  };
}

function importEdl(text, fileName) {
  const lines = text.split(/\r?\n/);
  const clips = [];
  let pending = null;
  for (const line of lines) {
    const match = line.match(
      /^(\d{3})\s+\S+\s+V\s+\S+\s+\S+\s+\S+\s+(\d\d:\d\d:\d\d:\d\d)\s+(\d\d:\d\d:\d\d:\d\d)$/,
    );
    if (match)
      pending = {
        start: parseTc(match[2]),
        end: parseTc(match[3]),
        index: Number(match[1]),
      };
    else if (pending && line.startsWith("* FROM CLIP NAME:")) {
      const name = line.split(":").slice(1).join(":").trim();
      clips.push({
        id: `edl-${pending.index}`,
        name,
        type: "video/*",
        track: "V1",
        start: pending.start,
        duration: pending.end - pending.start,
        speed: 100,
        opacity: 100,
        volume: 100,
        enabled: true,
        keyframes: [],
      });
      pending = null;
    }
  }
  return {
    sequence:
      lines
        .find((line) => line.startsWith("TITLE:"))
        ?.slice(6)
        .trim() || fileName.replace(/\.edl$/i, ""),
    media: clips.map((clip) => ({
      id: clip.id,
      name: clip.name,
      type: clip.type,
      offline: true,
    })),
    clips,
    markers: [],
  };
}
const parseTc = (value) => {
  const [hh, mm, ss, ff] = value.split(":").map(Number);
  return hh * 3600 + mm * 60 + ss + ff / FPS;
};

function parseXml(text) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("XML de projeto inválido");
  }
  return document;
}

function xmlNumber(node, selector, fallback = 0) {
  const value = Number(node.querySelector(selector)?.textContent);
  return Number.isFinite(value) ? value : fallback;
}

function importedClip({ id, name, track, start, duration }) {
  return {
    id,
    assetId: id,
    name,
    type: track.startsWith("A") ? "audio/*" : "video/*",
    track,
    start,
    duration: Math.max(1 / FPS, duration),
    speed: 100,
    opacity: 100,
    volume: 100,
    enabled: true,
    keyframes: [],
  };
}

function mediaFromClips(clips) {
  return clips.map((clip) => ({
    id: clip.assetId,
    name: clip.name,
    type: clip.type,
    size: 0,
    offline: true,
  }));
}

function importFcp7Xml(text, fileName) {
  const document = parseXml(text);
  const sequence = document.querySelector("sequence");
  if (!sequence) throw new Error("O XML não contém uma sequência editável");
  const timebase = xmlNumber(sequence, ":scope > rate > timebase", FPS) || FPS;
  const clips = [];
  sequence
    .querySelectorAll(":scope > media > video > track")
    .forEach((track, trackIndex) => {
      track.querySelectorAll(":scope > clipitem").forEach((item, itemIndex) => {
        const start = xmlNumber(item, ":scope > start") / timebase;
        const end = xmlNumber(item, ":scope > end") / timebase;
        clips.push(
          importedClip({
            id: `xml-v${trackIndex + 1}-${itemIndex + 1}`,
            name:
              item.querySelector(":scope > name")?.textContent ||
              "Clipe de vídeo",
            track: `V${Math.min(trackIndex + 1, 3)}`,
            start,
            duration: end - start,
          }),
        );
      });
    });
  sequence
    .querySelectorAll(":scope > media > audio > track")
    .forEach((track, trackIndex) => {
      track.querySelectorAll(":scope > clipitem").forEach((item, itemIndex) => {
        const start = xmlNumber(item, ":scope > start") / timebase;
        const end = xmlNumber(item, ":scope > end") / timebase;
        clips.push(
          importedClip({
            id: `xml-a${trackIndex + 1}-${itemIndex + 1}`,
            name:
              item.querySelector(":scope > name")?.textContent ||
              "Clipe de áudio",
            track: `A${Math.min(trackIndex + 1, 3)}`,
            start,
            duration: end - start,
          }),
        );
      });
    });
  return {
    sequence:
      sequence.querySelector(":scope > name")?.textContent ||
      fileName.replace(/\.xml$/i, ""),
    media: mediaFromClips(clips),
    clips,
    markers: [...sequence.querySelectorAll(":scope > marker")].map(
      (marker) => xmlNumber(marker, ":scope > in") / timebase,
    ),
  };
}

function rationalSeconds(value = "0s") {
  const match = String(value).match(/^(-?\d+)(?:\/(\d+))?s$/);
  if (!match) return Number.parseFloat(value) || 0;
  return Number(match[1]) / Number(match[2] || 1);
}

function importFcpxml(text, fileName) {
  const document = parseXml(text);
  const project = document.querySelector("project");
  const assets = new Map(
    [...document.querySelectorAll("resources > asset")].map((asset) => [
      asset.getAttribute("id"),
      asset.getAttribute("name") || "Mídia",
    ]),
  );
  const clips = [...document.querySelectorAll("sequence spine asset-clip")].map(
    (item, index) => {
      const lane = Number(item.getAttribute("lane") || 0);
      return importedClip({
        id: `fcpxml-${index + 1}`,
        name:
          item.getAttribute("name") ||
          assets.get(item.getAttribute("ref")) ||
          "Clipe",
        track:
          lane < 0
            ? `A${Math.min(Math.abs(lane), 3)}`
            : `V${Math.min(lane + 1, 3)}`,
        start: rationalSeconds(item.getAttribute("offset")),
        duration: rationalSeconds(item.getAttribute("duration")),
      });
    },
  );
  if (!project) throw new Error("O FCPXML não contém um projeto editável");
  return {
    sequence:
      project.getAttribute("name") || fileName.replace(/\.fcpxml$/i, ""),
    media: mediaFromClips(clips),
    clips,
    markers: [],
  };
}
