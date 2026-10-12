import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  BarChart3,
  Captions,
  CircleGauge,
  Copy,
  Flag,
  Eye,
  Headphones,
  Lock,
  Magnet,
  Mic,
  Hand,
  MousePointer2,
  Move,
  MoveHorizontal,
  PenTool,
  Pause,
  Play,
  Redo2,
  SlidersHorizontal,
  Scissors,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  createEdl,
  createFcp7Xml,
  createFcpxml,
  createFilmCraftProject,
  createMMFilmProject,
  createOtio,
  importProjectDocument,
  relinkAssetById,
  relinkImportedMedia,
} from "../../lib/mmfilmInterchange";
import {
  clipMediaTime,
  clipsInsideMarquee,
  timelineTimeFromPointer,
} from "../../lib/mmfilmTimeline";

const WORKSPACES = [
  "Montagem",
  "Edição",
  "Cor",
  "Efeitos",
  "Áudio",
  "Gráficos",
  "Legendas",
  "Exportar",
];

const TRACKS = [
  ["V3", "bg-fuchsia-500/70", "video"],
  ["V2", "bg-indigo-500/70", "video"],
  ["V1", "bg-sky-500/70", "video"],
  ["A1", "bg-emerald-500/70", "audio"],
  ["A2", "bg-violet-500/70", "audio"],
  ["A3", "bg-amber-500/70", "audio"],
];
const EDIT_TOOLS = [
  ["V", "Seleção", MousePointer2, false],
  ["A", "Selecionar faixa", Move, true],
  ["B", "Edição ripple", MoveHorizontal, true],
  ["R", "Rate stretch", SlidersHorizontal, true],
  ["C", "Razor", Scissors, false],
  ["Y", "Slip e slide", Copy, true],
  ["P", "Caneta", PenTool, true],
  ["H", "Mão", Hand, true],
  ["T", "Texto", Type, false],
];
const emptyTrackState = () =>
  Object.fromEntries(
    TRACKS.map(([id]) => [
      id,
      {
        locked: false,
        muted: false,
        solo: false,
        visible: true,
        armed: false,
        sync: true,
      },
    ]),
  );
const clock = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const compatible = (asset, kind) =>
  kind === "audio"
    ? asset.type.startsWith("audio") || asset.type.startsWith("video")
    : !asset.type.startsWith("audio");

export default function FilmCraftWorkspace({ active = true }) {
  const [media, setMedia] = useGraphicDraftState("FilmCraftWorkspace.jsx:media", []);
  const [clips, setClips] = useGraphicDraftState("FilmCraftWorkspace.jsx:clips", []);
  const [source, setSource] = useGraphicDraftState("FilmCraftWorkspace.jsx:source", null);
  const [selected, setSelected] = useGraphicDraftState("FilmCraftWorkspace.jsx:selected", null);
  const [selectedIds, setSelectedIds] = useGraphicDraftState("FilmCraftWorkspace.jsx:selectedIds", []);
  const [marquee, setMarquee] = useState(null);
  const [playhead, setPlayhead] = useGraphicDraftState("FilmCraftWorkspace.jsx:playhead", 0);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useGraphicDraftState("FilmCraftWorkspace.jsx:playbackRate", 1);
  const [zoom, setZoom] = useGraphicDraftState("FilmCraftWorkspace.jsx:zoom", 12);
  const [snap, setSnap] = useGraphicDraftState("FilmCraftWorkspace.jsx:snap", true);
  const [trackState, setTrackState] = useGraphicDraftState("FilmCraftWorkspace.jsx:trackState", emptyTrackState);
  const [markers, setMarkers] = useGraphicDraftState("FilmCraftWorkspace.jsx:markers", []);
  const [history, setHistory] = useGraphicDraftState("FilmCraftWorkspace.jsx:history", []);
  const [future, setFuture] = useGraphicDraftState("FilmCraftWorkspace.jsx:future", []);
  const [workspace, setWorkspace] = useGraphicDraftState("FilmCraftWorkspace.jsx:workspace", "Edição");
  const [workspaceMenu, setWorkspaceMenu] = useGraphicDraftState("FilmCraftWorkspace.jsx:workspaceMenu", false);
  const [applicationMenu, setApplicationMenu] = useGraphicDraftState("FilmCraftWorkspace.jsx:applicationMenu", null);
  const [commandNotice, setCommandNotice] = useGraphicDraftState("FilmCraftWorkspace.jsx:commandNotice", "");
  const [sequenceName, setSequenceName] = useGraphicDraftState("FilmCraftWorkspace.jsx:sequenceName", "Sequência 01");
  const [projectFormat, setProjectFormat] = useGraphicDraftState("FilmCraftWorkspace.jsx:projectFormat", "mmfilm");
  const [editTool, setEditTool] = useGraphicDraftState("FilmCraftWorkspace.jsx:editTool", "Seleção");
  const [projectView, setProjectView] = useGraphicDraftState("FilmCraftWorkspace.jsx:projectView", "Projeto");
  const [sourceIn, setSourceIn] = useGraphicDraftState("FilmCraftWorkspace.jsx:sourceIn", 0);
  const [sourceOut, setSourceOut] = useGraphicDraftState("FilmCraftWorkspace.jsx:sourceOut", 8);
  const [targetTrack, setTargetTrack] = useGraphicDraftState("FilmCraftWorkspace.jsx:targetTrack", "V1");
  const [trackTargets, setTrackTargets] = useGraphicDraftState("FilmCraftWorkspace.jsx:trackTargets", { V1: true, A1: true });
  const [dualMonitor, setDualMonitor] = useGraphicDraftState("FilmCraftWorkspace.jsx:dualMonitor", false);
  const [leftPanelWidth, setLeftPanelWidth] = useGraphicDraftState("FilmCraftWorkspace.jsx:leftPanelWidth", 280);
  const [rightPanelWidth, setRightPanelWidth] = useGraphicDraftState("FilmCraftWorkspace.jsx:rightPanelWidth", 280);
  const [topPanelHeight, setTopPanelHeight] = useGraphicDraftState("FilmCraftWorkspace.jsx:topPanelHeight", 430);
  const [relinkTarget, setRelinkTarget] = useGraphicDraftState("FilmCraftWorkspace.jsx:relinkTarget", null);
  const [mediaLocatorOpen, setMediaLocatorOpen] = useGraphicDraftState("FilmCraftWorkspace.jsx:mediaLocatorOpen", false);
  const [contextMenu, setContextMenu] = useState(null);
  const urls = useRef(new Set());
  const projectInput = useRef(null);
  const mediaInput = useRef(null);
  const relinkInput = useRef(null);
  const individualRelinkInput = useRef(null);
  const timelineTracks = useRef(null);

  useEffect(
    () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  useEffect(() => {
    if (!playing || !active) return;
    const timer = setInterval(() => {
      setPlayhead((value) =>
        Math.max(0, Math.min(60, value + 0.1 * playbackRate)),
      );
    }, 100);
    return () => clearInterval(timer);
  }, [playing, playbackRate, active]);
  useEffect(() => {
    function shortcuts(event) {
      if (!active) return;
      if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      }
      if (key === "j") {
        setPlaybackRate((value) => (value > 0 ? -1 : Math.max(-4, value - 1)));
        setPlaying(true);
      }
      if (key === "k") setPlaying(false);
      if (key === "l") {
        setPlaybackRate((value) => (value < 0 ? 1 : Math.min(4, value + 1)));
        setPlaying(true);
      }
      if (key === "i") setSourceIn(Math.min(sourceOut - 0.5, playhead));
      if (key === "o") setSourceOut(Math.max(sourceIn + 0.5, playhead));
      if (key === "m") addMarker();
      if (key === "q") rippleTrim("in");
      if (key === "w") rippleTrim("out");
      if (key === "d") {
        const underCursor = [...clips]
          .reverse()
          .find(
            (clip) =>
              playhead >= clip.start && playhead < clip.start + clip.duration,
          );
        if (underCursor) setSelected(underCursor.id);
      }
      if ((event.ctrlKey || event.metaKey) && key === "k") split();
      if (key === "=" || key === "+")
        setZoom((value) => Math.min(28, value + 1));
      if (key === "-") setZoom((value) => Math.max(6, value - 1));
      if (key === "home") setPlayhead(0);
      if (key === "end") setPlayhead(60);
      const toolByKey = Object.fromEntries(
        EDIT_TOOLS.map(([shortcut, name]) => [shortcut.toLowerCase(), name]),
      );
      if (toolByKey[key]) setEditTool(toolByKey[key]);
      if (key === "delete" || key === "backspace")
        removeSelected(event.shiftKey);
      if (key === "arrowleft")
        setPlayhead((value) =>
          Math.max(0, value - (event.shiftKey ? 1 : 1 / 30)),
        );
      if (key === "arrowright")
        setPlayhead((value) =>
          Math.min(60, value + (event.shiftKey ? 1 : 1 / 30)),
        );
      if ((event.ctrlKey || event.metaKey) && key === "z")
        event.shiftKey ? redo() : undo();
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  });

  const chosen = clips.find((clip) => clip.id === selected);
  const program = [...clips]
    .reverse()
    .find(
      (clip) =>
        clip.track.startsWith("V") &&
        clip.enabled !== false &&
        trackState[clip.track]?.visible !== false &&
        playhead >= clip.start &&
        playhead < clip.start + clip.duration,
    );

  function commit(next) {
    setClips((current) => {
      const updated = typeof next === "function" ? next(current) : next;
      if (updated === current) return current;
      setHistory((items) => [...items.slice(-39), current]);
      setFuture([]);
      return updated;
    });
  }
  function openSource(asset) {
    setSource(asset);
    setDualMonitor(true);
  }
  function undo() {
    if (!history.length) return;
    setFuture((items) => [clips, ...items].slice(0, 40));
    setClips(history.at(-1));
    setHistory((items) => items.slice(0, -1));
    setSelected(null);
  }
  function redo() {
    if (!future.length) return;
    setHistory((items) => [...items, clips].slice(-40));
    setClips(future[0]);
    setFuture((items) => items.slice(1));
    setSelected(null);
  }
  function load(files) {
    const next = [...files]
      .filter((file) => /^(video|audio|image)\//.test(file.type))
      .map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          url,
          duration: file.type.startsWith("image") ? 5 : 8,
        };
      });
    let linkedMedia = media;
    let linkedClips = clips;
    next.forEach((linked) => {
      const relinked = relinkImportedMedia({
        media: linkedMedia,
        clips: linkedClips,
        linked,
      });
      linkedMedia = relinked.media;
      linkedClips = relinked.clips;
    });
    setMedia(linkedMedia);
    if (linkedClips !== clips) commit(linkedClips);
    if (next[0]) setSource(next[0]);
    if (next.length)
      setCommandNotice(`${next.length} mídia(s) importada(s) ou religada(s)`);
  }
  function relink(files) {
    const candidates = [...files]
      .filter((file) => /^(video|audio|image)\//.test(file.type))
      .map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          url,
          duration: file.type.startsWith("image") ? 5 : 8,
        };
      });
    let linkedMedia = media;
    let linkedClips = clips;
    let matched = 0;
    candidates.forEach((linked) => {
      const result = relinkImportedMedia({
        media: linkedMedia,
        clips: linkedClips,
        linked,
        onlyExisting: true,
      });
      linkedMedia = result.media;
      linkedClips = result.clips;
      if (result.matched) matched += 1;
      else {
        URL.revokeObjectURL(linked.url);
        urls.current.delete(linked.url);
      }
    });
    setMedia(linkedMedia);
    if (matched) commit(linkedClips);
    const remaining = linkedMedia.filter((asset) => asset.offline).length;
    setCommandNotice(
      `${matched} mídia(s) religada(s) · ${remaining} ainda offline${
        candidates.length > matched
          ? ` · ${candidates.length - matched} arquivo(s) sem correspondência ignorado(s)`
          : ""
      }`,
    );
  }

  function relinkOne(file) {
    if (!file || !relinkTarget) return;
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    const result = relinkAssetById({
      media,
      clips,
      assetId: relinkTarget.id,
      linked: {
        name: file.name,
        type: file.type,
        size: file.size,
        url,
        duration: relinkTarget.duration || 8,
      },
    });
    if (!result.matched) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
      return;
    }
    setMedia(result.media);
    commit(result.clips);
    setSource(result.media.find((asset) => asset.id === relinkTarget.id));
    setCommandNotice(`${relinkTarget.name} religada a ${file.name}`);
    setRelinkTarget(null);
  }

  function chooseRelink(asset) {
    setRelinkTarget(asset);
    individualRelinkInput.current?.click();
  }

  function showContext(event, type, item) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, type, item });
  }

  function renameAsset(asset) {
    const name = window.prompt("Novo nome da mídia", asset.name);
    if (!name?.trim()) return;
    setMedia((items) =>
      items.map((item) =>
        item.id === asset.id ? { ...item, name: name.trim() } : item,
      ),
    );
    commit((items) =>
      items.map((clip) =>
        clip.assetId === asset.id ? { ...clip, name: name.trim() } : clip,
      ),
    );
  }

  function makeAssetOffline(asset) {
    setMedia((items) =>
      items.map((item) =>
        item.id === asset.id
          ? { ...item, offline: true, url: undefined }
          : item,
      ),
    );
    commit((items) =>
      items.map((clip) =>
        clip.assetId === asset.id
          ? { ...clip, offline: true, url: undefined }
          : clip,
      ),
    );
  }
  function makeClip(asset, track, start) {
    return {
      ...asset,
      id: crypto.randomUUID(),
      track,
      start: snap ? Math.round(start) : start,
      duration: Math.max(0.5, Math.min(asset.duration, sourceOut - sourceIn)),
      sourceIn,
      opacity: 100,
      volume: 100,
      speed: 100,
      x: 0,
      y: 0,
      scale: 100,
      rotation: 0,
      exposure: 0,
      contrast: 100,
      saturation: 100,
      temperature: 0,
      tint: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      keyframes: [],
    };
  }
  function insert(asset, track = asset.type.startsWith("audio") ? "A1" : "V1") {
    const kind = TRACKS.find(([id]) => id === track)?.[2];
    if (!kind || !compatible(asset, kind) || trackState[track].locked) return;
    const end = Math.max(
      0,
      ...clips
        .filter((clip) => clip.track === track)
        .map((clip) => clip.start + clip.duration),
    );
    const item = makeClip(asset, track, end);
    commit((old) => [...old, item]);
    setSelected(item.id);
  }
  function insertAtPlayhead(mode) {
    if (!source) return;
    const preferred = source.type.startsWith("audio") ? "A1" : targetTrack;
    const track = compatible(
      source,
      TRACKS.find(([id]) => id === preferred)?.[2],
    )
      ? preferred
      : source.type.startsWith("audio")
        ? "A1"
        : "V1";
    if (trackState[track].locked) return;
    const item = makeClip(source, track, playhead);
    commit((old) => {
      const prepared =
        mode === "insert"
          ? old.map((clip) =>
              clip.track === track && clip.start >= playhead
                ? { ...clip, start: clip.start + item.duration }
                : clip,
            )
          : old.filter(
              (clip) =>
                clip.track !== track ||
                clip.start + clip.duration <= playhead ||
                clip.start >= playhead + item.duration,
            );
      return [...prepared, item];
    });
    setSelected(item.id);
  }
  function patch(key, value) {
    if (!chosen || trackState[chosen.track].locked) return;
    commit((old) =>
      old.map((clip) =>
        clip.id === selected ? { ...clip, [key]: value } : clip,
      ),
    );
  }
  function split() {
    if (
      !chosen ||
      trackState[chosen.track].locked ||
      playhead <= chosen.start ||
      playhead >= chosen.start + chosen.duration
    )
      return;
    const left = playhead - chosen.start;
    commit((old) =>
      old.flatMap((clip) =>
        clip.id === chosen.id
          ? [
              { ...clip, duration: left },
              {
                ...clip,
                id: crypto.randomUUID(),
                start: playhead,
                duration: clip.duration - left,
              },
            ]
          : clip,
      ),
    );
  }
  function trim(side) {
    if (!chosen || trackState[chosen.track].locked) return;
    const end = chosen.start + chosen.duration;
    if (playhead <= chosen.start || playhead >= end) return;
    commit((old) =>
      old.map((clip) => {
        if (clip.id !== chosen.id) return clip;
        return side === "in"
          ? { ...clip, start: playhead, duration: end - playhead }
          : { ...clip, duration: playhead - clip.start };
      }),
    );
  }
  function rippleTrim(side) {
    if (!chosen || trackState[chosen.track].locked) return;
    const oldStart = chosen.start;
    const oldEnd = chosen.start + chosen.duration;
    if (playhead <= oldStart || playhead >= oldEnd) return;
    const delta = side === "in" ? playhead - oldStart : oldEnd - playhead;
    commit((old) =>
      old.map((clip) => {
        if (clip.id === chosen.id)
          return side === "in"
            ? {
                ...clip,
                start: playhead,
                duration: oldEnd - playhead,
                sourceIn: (clip.sourceIn || 0) + delta,
              }
            : { ...clip, duration: playhead - oldStart };
        if (clip.track !== chosen.track) return clip;
        if (side === "out" && clip.start >= oldEnd)
          return { ...clip, start: Math.max(playhead, clip.start - delta) };
        return clip;
      }),
    );
  }
  function nudgeSelected(delta) {
    if (!chosen || trackState[chosen.track].locked) return;
    patch("start", Math.max(0, chosen.start + delta));
  }
  function slip(delta) {
    if (!chosen) return;
    patch("sourceIn", Math.max(0, (chosen.sourceIn || 0) + delta));
  }
  function rateStretch(duration) {
    if (!chosen || duration < 0.5) return;
    commit((old) =>
      old.map((clip) =>
        clip.id === chosen.id
          ? {
              ...clip,
              duration,
              speed: Math.round((clip.duration / duration) * clip.speed),
            }
          : clip,
      ),
    );
  }
  function addTransition(name) {
    if (!chosen) return;
    patch("transition", name);
  }
  function removeSelected(ripple = false) {
    const ids = selectedIds.length ? selectedIds : chosen ? [chosen.id] : [];
    const removable = clips.filter(
      (clip) => ids.includes(clip.id) && !trackState[clip.track].locked,
    );
    if (!removable.length) return;
    commit((old) =>
      old
        .filter((clip) => !removable.some((item) => item.id === clip.id))
        .map((clip) =>
          ripple &&
          chosen &&
          clip.track === chosen.track &&
          clip.start >= chosen.start + chosen.duration
            ? {
                ...clip,
                start: Math.max(chosen.start, clip.start - chosen.duration),
              }
            : clip,
        ),
    );
    setSelected(null);
    setSelectedIds([]);
  }
  function liftOrExtract(extract) {
    const span = sourceOut - sourceIn;
    if (span <= 0) return;
    commit((old) =>
      old
        .filter(
          (clip) =>
            clip.start + clip.duration <= sourceIn || clip.start >= sourceOut,
        )
        .map((clip) =>
          extract && clip.start >= sourceOut
            ? { ...clip, start: Math.max(sourceIn, clip.start - span) }
            : clip,
        ),
    );
    setSelected(null);
  }
  function downloadProject(contents, extension, type) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      sequenceName
        .trim()
        .replace(/[^a-z0-9-_]+/gi, "-")
        .toLowerCase() || "mmfilm-projeto"
    }${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function saveSequence() {
    const project = {
      sequence: sequenceName,
      media,
      clips,
      markers,
      trackState,
    };
    const formats = {
      mmfilm: [
        JSON.stringify(createMMFilmProject(project), null, 2),
        ".mmfilmproj",
        "application/json",
      ],
      filmcraft: [
        JSON.stringify(createFilmCraftProject(project), null, 2),
        ".fcproj",
        "application/json",
      ],
      premiere: [createFcp7Xml(project), ".xml", "application/xml"],
      resolve: [createEdl(project), ".edl", "text/plain"],
      otio: [
        JSON.stringify(createOtio(project), null, 2),
        ".otio",
        "application/json",
      ],
      finalcut: [createFcpxml(project), ".fcpxml", "application/xml"],
    };
    downloadProject(...formats[projectFormat]);
    setCommandNotice(`Projeto exportado: ${projectFormat}`);
  }
  function saveProjectLocally() {
    const nextName = window.prompt("Nome do projeto", sequenceName)?.trim();
    if (!nextName) return;
    setSequenceName(nextName);
    localStorage.setItem(
      "mmfilm:last-project",
      JSON.stringify({
        version: 1,
        sequence: nextName,
        fps: 29.97,
        clips,
        markers,
      }),
    );
  }
  function reloadProject() {
    const saved = localStorage.getItem("mmfilm:last-project");
    if (!saved) return;
    const project = JSON.parse(saved);
    setSequenceName(project.sequence || "Sequência 01");
    setClips(project.clips || []);
    setMarkers(project.markers || []);
    setSelected(null);
  }
  async function importProject(file) {
    if (!file) return;
    try {
      const project = importProjectDocument(await file.text(), file.name);
      setSequenceName(project.sequence || file.name.replace(/\.[^.]+$/i, ""));
      setMedia(project.media || []);
      setClips(project.clips || []);
      setMarkers(project.markers || []);
      if (project.trackState) setTrackState(project.trackState);
      setSelected(null);
      setCommandNotice(
        `Projeto importado · ${(project.clips || []).length} clipes${
          (project.media || []).some((item) => item.offline)
            ? " · religue as mídias offline"
            : ""
        }`,
      );
    } catch (error) {
      setCommandNotice(error.message || "Não foi possível importar o projeto");
    } finally {
      if (projectInput.current) projectInput.current.value = "";
    }
  }
  function dropOnTrack(event, track, kind) {
    event.preventDefault();
    if (trackState[track].locked) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const raw = Math.max(0, (event.clientX - rect.left) / zoom);
    const start = snap ? Math.round(raw) : raw;
    const clipId = event.dataTransfer.getData("application/x-filmcraft-clip");
    if (clipId) {
      const moving = clips.find((clip) => clip.id === clipId);
      if (!moving || !compatible(moving, kind)) return;
      commit((old) =>
        old.map((clip) =>
          clip.id === clipId ? { ...clip, track, start } : clip,
        ),
      );
      setSelected(clipId);
      return;
    }
    const assetId = event.dataTransfer.getData("application/x-filmcraft-asset");
    const asset = media.find((item) => item.id === assetId);
    if (!asset || !compatible(asset, kind)) return;
    const item = makeClip(asset, track, start);
    commit((old) => [...old, item]);
    setSelected(item.id);
  }
  function toggleTrack(track, key) {
    setTrackState((old) => ({
      ...old,
      [track]: { ...old[track], [key]: !old[track][key] },
    }));
  }
  function addMarker() {
    const at = Math.round(playhead * 10) / 10;
    setMarkers((old) =>
      old.some((marker) => Math.abs(marker - at) < 0.05)
        ? old
        : [...old, at].sort((a, b) => a - b),
    );
  }
  function addKeyframe() {
    if (!chosen) return;
    const localTime = Math.max(
      0,
      Math.min(chosen.duration, playhead - chosen.start),
    );
    patch(
      "keyframes",
      [
        ...(chosen.keyframes || []).filter(
          (time) => Math.abs(time - localTime) > 0.05,
        ),
        localTime,
      ].sort((a, b) => a - b),
    );
  }

  function beginResize(axis, setter, invert = false) {
    return (event) => {
      event.preventDefault();
      const start = axis === "x" ? event.clientX : event.clientY;
      const initial =
        setter === setLeftPanelWidth
          ? leftPanelWidth
          : setter === setRightPanelWidth
            ? rightPanelWidth
            : topPanelHeight;
      const move = (moveEvent) => {
        const current = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
        const delta = (current - start) * (invert ? -1 : 1);
        setter(
          Math.max(
            axis === "x" ? 220 : 300,
            Math.min(axis === "x" ? 460 : 650, initial + delta),
          ),
        );
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    };
  }

  function beginPlayheadDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    const ruler = event.currentTarget.closest("[data-timeline-ruler]");
    const trackArea = timelineTracks.current;
    const left =
      ruler?.getBoundingClientRect().left ??
      (trackArea ? trackArea.getBoundingClientRect().left + 144 : undefined) ??
      0;
    const update = (pointerEvent) =>
      setPlayhead(
        timelineTimeFromPointer(pointerEvent.clientX, left, zoom, 60),
      );
    update(event);
    const stop = () => {
      window.removeEventListener("pointermove", update);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", update);
    window.addEventListener("pointerup", stop);
  }

  function beginMarquee(event, startTrack) {
    if (event.button !== 0 || editTool !== "Seleção") return;
    event.preventDefault();
    const canvas = timelineTracks.current?.getBoundingClientRect();
    if (!canvas) return;
    const area = { left: canvas.left + 144, top: canvas.top + 74 };
    const startTime = timelineTimeFromPointer(
      event.clientX,
      area.left,
      zoom,
      60,
    );
    const startY = event.clientY;
    let moved = false;
    const update = (pointerEvent) => {
      if (
        Math.abs(pointerEvent.clientX - event.clientX) > 3 ||
        Math.abs(pointerEvent.clientY - startY) > 3
      )
        moved = true;
      const trackIndex = Math.max(
        0,
        Math.min(
          TRACKS.length - 1,
          Math.floor((pointerEvent.clientY - area.top) / 56),
        ),
      );
      const next = {
        startTime,
        endTime: timelineTimeFromPointer(
          pointerEvent.clientX,
          area.left,
          zoom,
          60,
        ),
        startTrack,
        endTrack: TRACKS[trackIndex][0],
      };
      setMarquee(next);
      setSelectedIds(clipsInsideMarquee(clips, next));
    };
    const stop = (pointerEvent) => {
      window.removeEventListener("pointermove", update);
      window.removeEventListener("pointerup", stop);
      if (!moved) {
        setPlayhead(
          timelineTimeFromPointer(pointerEvent.clientX, area.left, zoom, 60),
        );
        setSelected(null);
        setSelectedIds([]);
      }
      setMarquee(null);
    };
    window.addEventListener("pointermove", update);
    window.addEventListener("pointerup", stop);
  }

  return (
    <section className="bg-[#191919] text-slate-200">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-black bg-[#1d1d1d] px-3 py-2">
        <div>
          <nav className="flex items-center gap-5 text-sm">
            <button className="text-slate-400 hover:text-white">⌂</button>
            <button
              onClick={() => mediaInput.current?.click()}
              className="text-slate-400 hover:text-white"
            >
              Importar
            </button>
            <button
              onClick={() => setWorkspace("Edição")}
              className="border-b-2 border-slate-200 pb-1 text-white"
            >
              Editar
            </button>
            <button
              onClick={() => setWorkspace("Exportar")}
              className="text-slate-400 hover:text-white"
            >
              Exportar
            </button>
          </nav>
        </div>
        <div className="text-center">
          <h1 className="text-sm font-medium text-slate-200">
            {sequenceName} — Editada
          </h1>
          <p className="text-[9px] text-slate-500">MMFilm</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[10px]">
          <button
            onClick={saveProjectLocally}
            className="border border-slate-700 px-2 py-1.5 text-slate-200"
          >
            Salvar como
          </button>
          <button
            onClick={reloadProject}
            className="border border-slate-700 px-2 py-1.5 text-slate-200"
          >
            Recarregar
          </button>
          <button
            onClick={() => projectInput.current?.click()}
            className="border border-slate-700 px-2 py-1.5 text-slate-200"
          >
            Importar projeto
          </button>
          <input
            ref={projectInput}
            hidden
            type="file"
            accept=".mmfilmproj,.fcproj,.otio,.json,.mmfilm.json,.xml,.fcpxml,.edl,application/json,application/xml,text/xml,text/plain"
            onChange={(event) => importProject(event.target.files?.[0])}
          />
          <select
            aria-label="Formato do projeto"
            value={projectFormat}
            onChange={(event) => setProjectFormat(event.target.value)}
            className="max-w-40 border border-slate-700 bg-[#101010] px-2 py-1.5 text-slate-200"
          >
            <option value="mmfilm">MMFilm Project</option>
            <option value="premiere">Premiere / Resolve XML</option>
            <option value="resolve">DaVinci EDL</option>
            <option value="otio">DaVinci / OpenTimelineIO</option>
            <option value="finalcut">Final Cut FCPXML</option>
            <option value="filmcraft">FilmCraft Project</option>
          </select>
          <button
            onClick={saveSequence}
            className="border border-blue-500 px-2 py-1.5 font-bold text-blue-300"
          >
            Exportar projeto
          </button>
          <label className="cursor-pointer bg-cyan-400 px-2 py-1.5 font-bold text-slate-950">
            <Upload className="mr-2 inline" size={15} /> Importar mídia
            <input
              ref={mediaInput}
              hidden
              multiple
              type="file"
              accept="video/*,audio/*,image/*"
              onChange={(event) => load(event.target.files)}
            />
          </label>
          <button
            onClick={() => setMediaLocatorOpen(true)}
            disabled={!media.some((asset) => asset.offline)}
            className="border border-amber-500 px-2 py-1.5 font-bold text-amber-300 disabled:border-slate-700 disabled:text-slate-600"
          >
            Religar mídia
            {media.some((asset) => asset.offline)
              ? ` (${media.filter((asset) => asset.offline).length})`
              : ""}
          </button>
          <input
            ref={relinkInput}
            hidden
            multiple
            type="file"
            accept="video/*,audio/*,image/*"
            onChange={(event) => {
              relink(event.target.files || []);
              event.target.value = "";
            }}
          />
          <input
            ref={individualRelinkInput}
            hidden
            type="file"
            accept="video/*,audio/*,image/*"
            onChange={(event) => {
              relinkOne(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </header>
      {commandNotice && (
        <div className="fixed right-5 top-20 z-[200] border border-blue-500 bg-[#202020] px-4 py-2 text-xs text-blue-200 shadow-2xl">
          {commandNotice}
        </div>
      )}

      <div className="relative flex items-center gap-1 overflow-visible border-b border-blue-500 bg-[#1d1d1d] px-2 py-1 text-[11px] text-slate-300">
        {[
          "Mídia",
          "Arquivo",
          "Editar",
          "Clipe",
          "Sequência",
          "Marcadores",
          "Gráficos e Títulos",
          "Exibir",
          "Janela",
          "Ajuda",
        ].map((item) => (
          <button
            key={item}
            onClick={() =>
              setApplicationMenu(applicationMenu === item ? null : item)
            }
            className="rounded px-2 py-1 hover:bg-slate-800 hover:text-white"
          >
            {item}
          </button>
        ))}
        {applicationMenu && (
          <ApplicationMenu
            name={applicationMenu}
            onClose={() => setApplicationMenu(null)}
            actions={{
              importMedia: () => mediaInput.current?.click(),
              relinkMedia: () => relinkInput.current?.click(),
              exportView: () => setWorkspace("Exportar"),
              undo,
              redo,
              split,
              marker: addMarker,
              notify: (label) => {
                setCommandNotice(
                  `${label}: comando preparado para o projeto atual`,
                );
                window.setTimeout(() => setCommandNotice(""), 1800);
              },
            }}
          />
        )}
        <span className="ml-auto whitespace-nowrap text-slate-500">
          {sequenceName} · 1920×1080 · 29,97 fps
        </span>
        <button
          aria-haspopup="menu"
          aria-expanded={workspaceMenu}
          onClick={() => setWorkspaceMenu((value) => !value)}
          className="flex min-w-32 items-center justify-between gap-3 border border-[#454545] bg-[#252525] px-3 py-1.5 text-xs text-slate-200"
        >
          <span>{workspace}</span>
          <span>▾</span>
        </button>
        {workspaceMenu && (
          <div
            role="menu"
            className="absolute right-2 top-full z-[80] w-56 border border-[#454545] bg-[#202020] p-1 shadow-2xl"
          >
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500">
              Todos os painéis
            </div>
            {WORKSPACES.map((item) => (
              <button
                role="menuitem"
                key={item}
                onClick={() => {
                  setWorkspace(item);
                  setWorkspaceMenu(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm ${workspace === item ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-[#333]"}`}
              >
                {item}
              </button>
            ))}
            <div className="my-1 border-t border-[#3a3a3a]" />
            <button
              role="menuitem"
              onClick={() => {
                setLeftPanelWidth(280);
                setRightPanelWidth(280);
                setTopPanelHeight(430);
                setWorkspaceMenu(false);
              }}
              className="block w-full border border-[#454545] px-3 py-2 text-left text-sm text-slate-200 hover:bg-[#333]"
            >
              Restaurar layout salvo
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-black bg-[#202020] px-2 py-1 text-[9px] text-slate-400">
        <span>Layout</span>
        <button
          onClick={() => setDualMonitor((value) => !value)}
          className="border border-slate-700 px-2 py-1 hover:text-white"
        >
          {dualMonitor ? "Dois monitores" : "Monitor único"}
        </button>
        <button
          onClick={() => {
            setLeftPanelWidth(280);
            setRightPanelWidth(280);
            setTopPanelHeight(430);
          }}
          className="border border-slate-700 px-2 py-1 hover:text-white"
        >
          Restaurar workspace
        </button>
        <span className="ml-auto">
          Arraste as divisórias para redimensionar os painéis
        </span>
      </div>

      {workspace === "Exportar" && (
        <ExportWorkspace sequenceName={sequenceName} program={program} />
      )}

      <div
        className={`${workspace === "Exportar" ? "hidden" : "grid"} relative min-h-[760px] gap-px bg-black`}
        style={{
          gridTemplateColumns: `${leftPanelWidth}px minmax(520px, 1fr) ${rightPanelWidth}px`,
          gridTemplateRows: `${topPanelHeight}px minmax(360px, 1fr)`,
        }}
      >
        <aside className="overflow-auto border border-[#303030] bg-[#1e1e1e] xl:col-start-1 xl:row-start-1">
          {workspace === "Áudio" ? (
            <AudioTrackMixer
              trackState={trackState}
              toggleTrack={toggleTrack}
            />
          ) : (
            <ColorEffectControls clip={chosen} patch={patch} />
          )}
        </aside>

        <aside className="overflow-auto border border-[#303030] bg-[#1e1e1e] xl:col-start-1 xl:row-start-2">
          {
            <PremiereProjectPanel
              media={media}
              source={source}
              setSource={openSource}
              sequenceName={sequenceName}
              onRelink={chooseRelink}
              onContextMenu={(event, asset) =>
                showContext(event, "media", asset)
              }
            />
          }
          {false && (
            <>
              <div className="flex border-b border-slate-800">
                {["Projeto", "Navegador", "Info"].map((view) => (
                  <button
                    key={view}
                    onClick={() => setProjectView(view)}
                    className={`flex-1 px-2 py-3 text-[10px] font-bold ${projectView === view ? "border-b-2 border-cyan-400 text-cyan-300" : "text-slate-500"}`}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <div className="border-b border-slate-800 p-2 text-[10px] text-slate-400">
                {projectView === "Projeto" && (
                  <div className="space-y-1">
                    <button className="block w-full rounded bg-slate-800 px-2 py-1 text-left text-white">
                      ▾ Sequência 01
                    </button>
                    <button className="block w-full rounded px-4 py-1 text-left hover:bg-slate-800">
                      ▸ Mídia
                    </button>
                    <button className="block w-full rounded px-4 py-1 text-left hover:bg-slate-800">
                      ▸ Áudio
                    </button>
                    <button className="block w-full rounded px-4 py-1 text-left hover:bg-slate-800">
                      ▸ Gráficos
                    </button>
                  </div>
                )}
                {projectView === "Navegador" &&
                  "Discos locais · Favoritos · Armazenamento"}
                {projectView === "Info" &&
                  (source
                    ? `${source.name} · ${source.type}`
                    : "Selecione uma mídia para ver metadados")}
              </div>
              {workspace === "Cor" && (
                <div className="grid grid-cols-[18px_1fr_42px_58px] border-b border-[#303030] px-3 py-1 text-[8px] text-slate-500">
                  <span />
                  <span>Nome</span>
                  <span>Quadros</span>
                  <span className="text-right">Duração</span>
                </div>
              )}
              <div
                className={
                  workspace === "Cor" ? "p-2" : "grid grid-cols-2 gap-2 p-3"
                }
              >
                {media.map((asset) => (
                  <button
                    key={asset.id}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/x-filmcraft-asset",
                        asset.id,
                      )
                    }
                    onClick={() => setSource(asset)}
                    onDoubleClick={() => insert(asset)}
                    className={`${workspace === "Cor" ? "grid w-full grid-cols-[18px_1fr_42px_58px] items-center border-b border-[#303030] px-1 py-1 text-left" : "overflow-hidden rounded-lg border bg-slate-950 text-left"} ${source?.id === asset.id ? "border-cyan-400" : "border-slate-700"}`}
                  >
                    {workspace === "Cor" && (
                      <span className="h-2 w-2 bg-sky-700" />
                    )}
                    <div
                      className={
                        workspace === "Cor"
                          ? "hidden"
                          : "grid h-16 place-items-center bg-black/50"
                      }
                    >
                      {asset.type.startsWith("image") ? (
                        <img
                          src={asset.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : asset.type.startsWith("audio") ? (
                        <Volume2 size={18} className="text-emerald-300" />
                      ) : (
                        <Play size={18} className="text-cyan-300" />
                      )}
                    </div>
                    <p
                      className={`truncate text-[10px] text-slate-300 ${workspace === "Cor" ? "px-1" : "p-2"}`}
                    >
                      {asset.name}
                    </p>
                    {workspace === "Cor" && (
                      <span className="text-[9px] text-slate-500">30 fps</span>
                    )}
                    {workspace === "Cor" && (
                      <span className="text-right text-[9px] text-slate-500">
                        00:00:08:00
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {!media.length && (
                <p className="p-5 text-xs text-slate-500">
                  Importe mídias. Depois arraste para uma trilha, clique para
                  visualizar ou dê dois cliques para inserir.
                </p>
              )}
            </>
          )}
        </aside>

        <main className="contents">
          <section className="flex min-h-0 flex-col overflow-hidden bg-black xl:col-start-2 xl:row-start-1">
            <div
              className={`grid min-h-0 flex-1 gap-px ${workspace === "Cor" ? "grid-cols-1" : "md:grid-cols-2"}`}
            >
              {workspace !== "Cor" && dualMonitor && (
                <Monitor title="Origem" asset={source}>
                  <MonitorAction
                    disabled={!source}
                    onClick={() => insertAtPlayhead("insert")}
                  >
                    Inserir
                  </MonitorAction>
                  <MonitorAction
                    disabled={!source}
                    onClick={() => insertAtPlayhead("overwrite")}
                  >
                    Sobrescrever
                  </MonitorAction>
                </Monitor>
              )}
              <Monitor
                title="Programa"
                asset={program}
                playing={playing}
                playhead={playhead}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 border border-[#303030] bg-[#1e1e1e] p-2 text-[10px] text-slate-400">
              <b className="text-white">Origem</b>
              <label>
                IN
                <input
                  type="number"
                  min="0"
                  max={sourceOut - 0.5}
                  step="0.1"
                  value={sourceIn}
                  onChange={(event) => setSourceIn(+event.target.value)}
                  className="ml-1 w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1"
                />
              </label>
              <label>
                OUT
                <input
                  type="number"
                  min={sourceIn + 0.5}
                  max={source?.duration || 60}
                  step="0.1"
                  value={sourceOut}
                  onChange={(event) => setSourceOut(+event.target.value)}
                  className="ml-1 w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1"
                />
              </label>
              <span>Duração: {(sourceOut - sourceIn).toFixed(1)} s</span>
              <label className="ml-auto">
                Faixa de destino
                <select
                  value={targetTrack}
                  onChange={(event) => setTargetTrack(event.target.value)}
                  className="ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-1"
                >
                  {TRACKS.filter(([, , kind]) => kind === "video").map(
                    ([id]) => (
                      <option key={id}>{id}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
          </section>

          <button
            aria-label="Redimensionar painel esquerdo"
            onPointerDown={beginResize("x", setLeftPanelWidth)}
            className="absolute bottom-0 left-[var(--left-panel)] top-0 z-50 w-1 -translate-x-1/2 cursor-col-resize bg-transparent hover:bg-blue-500"
            style={{ "--left-panel": `${leftPanelWidth}px` }}
          />
          <button
            aria-label="Redimensionar painel direito"
            onPointerDown={beginResize("x", setRightPanelWidth, true)}
            className="absolute bottom-0 right-[var(--right-panel)] top-0 z-50 w-1 translate-x-1/2 cursor-col-resize bg-transparent hover:bg-blue-500"
            style={{ "--right-panel": `${rightPanelWidth}px` }}
          />
          <button
            aria-label="Redimensionar timeline"
            onPointerDown={beginResize("y", setTopPanelHeight)}
            className="absolute left-0 right-0 top-[var(--top-panel)] z-50 h-1 -translate-y-1/2 cursor-row-resize bg-transparent hover:bg-blue-500"
            style={{ "--top-panel": `${topPanelHeight}px` }}
          />

          <div className="relative min-w-0 border border-[#303030] bg-[#1b1b1b] pl-10 xl:col-start-2 xl:row-start-2">
            <aside
              aria-label="Ferramentas de edição"
              className="absolute bottom-0 left-0 top-0 z-40 flex w-10 flex-col items-center gap-1 border-r border-black bg-[#202020] py-2"
            >
              {EDIT_TOOLS.map(([shortcut, name, EditIcon, hasFlyout]) => (
                <button
                  key={name}
                  title={`${name} (${shortcut})`}
                  aria-label={`${name} (${shortcut})`}
                  onClick={() => setEditTool(name)}
                  className={`relative grid h-9 w-9 place-items-center border ${editTool === name ? "border-blue-400 bg-blue-600 text-white" : "border-transparent text-slate-400 hover:border-slate-600 hover:bg-[#303030] hover:text-white"}`}
                >
                  <EditIcon size={18} strokeWidth={1.8} />
                  {hasFlyout && (
                    <span className="absolute bottom-0.5 right-0.5 h-0 w-0 border-b-[4px] border-l-[4px] border-b-slate-400 border-l-transparent" />
                  )}
                </button>
              ))}
            </aside>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2">
              <Tool label="Reproduzir" onClick={() => setPlaying(!playing)}>
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </Tool>
              <Tool label="Desfazer" disabled={!history.length} onClick={undo}>
                <Undo2 size={15} />
              </Tool>
              <Tool label="Refazer" disabled={!future.length} onClick={redo}>
                <Redo2 size={15} />
              </Tool>
              <Tool label="Dividir" onClick={split} disabled={!chosen}>
                <Scissors size={15} />
              </Tool>
              <Tool
                label="Aparar entrada no cursor"
                onClick={() => trim("in")}
                disabled={!chosen}
              >
                <span className="text-[10px] font-bold">IN</span>
              </Tool>
              <Tool
                label="Aparar saída no cursor"
                onClick={() => trim("out")}
                disabled={!chosen}
              >
                <span className="text-[10px] font-bold">OUT</span>
              </Tool>
              <Tool
                label="Duplicar"
                disabled={!chosen || trackState[chosen.track].locked}
                onClick={() =>
                  commit((old) => [
                    ...old,
                    {
                      ...chosen,
                      id: crypto.randomUUID(),
                      start: chosen.start + chosen.duration,
                    },
                  ])
                }
              >
                <Copy size={15} />
              </Tool>
              <Tool
                label="Excluir"
                disabled={!chosen || trackState[chosen.track].locked}
                onClick={() => removeSelected(false)}
              >
                <Trash2 size={15} />
              </Tool>
              <button
                disabled={!chosen}
                onClick={() => removeSelected(true)}
                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-30"
              >
                Excluir com ripple
              </button>
              <button
                onClick={() => liftOrExtract(false)}
                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300"
              >
                Lift
              </button>
              <button
                onClick={() => liftOrExtract(true)}
                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300"
              >
                Extract
              </button>
              <Tool label="Adicionar marcador" onClick={addMarker}>
                <Flag size={15} />
              </Tool>
              <button
                disabled={!chosen}
                onClick={addKeyframe}
                className="rounded border border-slate-700 px-2 py-1 text-[10px] text-amber-300 disabled:opacity-30"
              >
                ◇ Keyframe
              </button>
              <Tool
                label="Snapping"
                onClick={() => setSnap(!snap)}
                active={snap}
              >
                <Magnet size={15} />
              </Tool>
              <span className="ml-auto font-mono text-xs text-cyan-300">
                00:{clock(playhead)}:00
              </span>
              <input
                aria-label="Zoom da timeline"
                type="range"
                min="6"
                max="28"
                value={zoom}
                onChange={(event) => setZoom(+event.target.value)}
              />
            </div>

            <div className="overflow-x-auto">
              <div
                ref={timelineTracks}
                className="relative"
                style={{ width: Math.max(900, 62 * zoom) }}
              >
                <div className="flex h-[74px] border-b border-black bg-[#202020]">
                  <div className="sticky left-0 z-30 w-36 shrink-0 border-r border-black px-2 py-1">
                    <div className="flex items-center gap-1 text-[10px] text-slate-200">
                      <span className="text-slate-500">×</span>
                      <span className="border-b border-slate-300">
                        Main Edit
                      </span>
                      <span>☰</span>
                    </div>
                    <div className="mt-1 font-mono text-lg leading-none text-[#58a6ff]">
                      00:{clock(playhead)}:23
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-slate-300">
                      <TrackButton label="Seleção vinculada" active>
                        ▣
                      </TrackButton>
                      <TrackButton
                        label="Snapping"
                        active={snap}
                        onClick={() => setSnap(!snap)}
                      >
                        ∪
                      </TrackButton>
                      <TrackButton label="Inserção e sobrescrita">
                        ▤
                      </TrackButton>
                      <TrackButton label="Exibição da timeline">▥</TrackButton>
                      <Flag size={10} />
                      <span className="ml-auto">⌕</span>
                    </div>
                  </div>
                  <div
                    data-timeline-ruler
                    onPointerDown={beginPlayheadDrag}
                    className="flex flex-1 cursor-ew-resize items-end"
                  >
                    {Array.from({ length: 13 }, (_, index) => (
                      <button
                        key={index}
                        onClick={() => setPlayhead(index * 5)}
                        style={{ width: 5 * zoom }}
                        className="h-8 border-l border-slate-700 pl-1 text-left text-[9px] text-slate-500"
                      >
                        {clock(index * 5)}
                      </button>
                    ))}
                  </div>
                </div>
                {TRACKS.map(([id, color, kind]) => {
                  const state = trackState[id];
                  return (
                    <div
                      key={id}
                      className="flex h-14 border-b border-slate-800"
                    >
                      <div className="sticky left-0 z-30 grid w-36 shrink-0 grid-cols-[28px_18px_28px_1fr] border-r border-black bg-[#202020] text-[10px]">
                        <button
                          aria-label={`Patch de origem ${id}`}
                          onClick={() =>
                            setTrackTargets((old) => ({
                              ...old,
                              [id]: !old[id],
                            }))
                          }
                          className={`m-0.5 grid place-items-center font-bold ${trackTargets[id] ? "bg-[#2f63c7] text-white" : "text-transparent"}`}
                        >
                          {id}
                        </button>
                        <span className="grid place-items-center">
                          <TrackButton
                            label={`${state.locked ? "Desbloquear" : "Bloquear"} ${id}`}
                            active={state.locked}
                            onClick={() => toggleTrack(id, "locked")}
                          >
                            {state.locked ? (
                              <Lock size={11} />
                            ) : (
                              <Unlock size={11} />
                            )}
                          </TrackButton>
                        </span>
                        <button
                          aria-label={`Direcionar ${id}`}
                          onClick={() => setTargetTrack(id)}
                          className={`m-0.5 grid place-items-center font-bold ${targetTrack === id ? "bg-[#2f63c7] text-white" : "bg-[#292929] text-[#6ca8ff]"}`}
                        >
                          {id}
                        </button>
                        <div className="min-w-0 px-1 py-1">
                          <div className="flex h-5 items-center gap-0.5">
                            <TrackButton
                              label={`Sincronização ${id}`}
                              active={state.sync}
                              onClick={() => toggleTrack(id, "sync")}
                            >
                              ⌘
                            </TrackButton>
                            {kind === "video" ? (
                              <TrackButton
                                label={`${state.visible ? "Ocultar" : "Mostrar"} ${id}`}
                                active={state.visible}
                                onClick={() => toggleTrack(id, "visible")}
                              >
                                <Eye size={11} />
                              </TrackButton>
                            ) : (
                              <>
                                <TrackButton
                                  label={`${state.muted ? "Ativar" : "Silenciar"} ${id}`}
                                  active={state.muted}
                                  onClick={() => toggleTrack(id, "muted")}
                                >
                                  M
                                </TrackButton>
                                <TrackButton
                                  label={`Solo ${id}`}
                                  active={state.solo}
                                  onClick={() => toggleTrack(id, "solo")}
                                >
                                  S
                                </TrackButton>
                                <TrackButton
                                  label={`Gravar ${id}`}
                                  active={state.armed}
                                  onClick={() => toggleTrack(id, "armed")}
                                >
                                  <Mic size={11} />
                                </TrackButton>
                                <span className="text-slate-500">◆</span>
                              </>
                            )}
                          </div>
                          <span className="block truncate text-slate-400">
                            {kind === "audio" ? "Áudio" : "Vídeo"} {id.slice(1)}
                          </span>
                        </div>
                      </div>
                      <div
                        data-track-id={id}
                        className={`relative flex-1 ${state.locked ? "bg-slate-950/60" : ""}`}
                        onPointerDown={(event) => beginMarquee(event, id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => dropOnTrack(event, id, kind)}
                        onDoubleClick={() => source && insert(source, id)}
                      >
                        {clips
                          .filter((clip) => clip.track === id)
                          .map((clip) => (
                            <button
                              key={clip.id}
                              draggable={!state.locked}
                              onPointerDown={(event) => event.stopPropagation()}
                              onDragStart={(event) => {
                                event.stopPropagation();
                                event.dataTransfer.setData(
                                  "application/x-filmcraft-clip",
                                  clip.id,
                                );
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelected(clip.id);
                                setSelectedIds(
                                  event.shiftKey
                                    ? [...new Set([...selectedIds, clip.id])]
                                    : [clip.id],
                                );
                              }}
                              onContextMenu={(event) => {
                                setSelected(clip.id);
                                setSelectedIds([clip.id]);
                                showContext(event, "clip", clip);
                              }}
                              className={`absolute top-1 z-20 h-12 overflow-hidden rounded border border-white/10 px-2 text-left text-[10px] text-white ${color} ${state.muted || clip.enabled === false ? "opacity-40" : ""} ${selectedIds.includes(clip.id) || selected === clip.id ? "ring-2 ring-white" : ""}`}
                              style={{
                                left: clip.start * zoom,
                                width: Math.max(36, clip.duration * zoom),
                              }}
                            >
                              <b className="block truncate">{clip.name}</b>
                              <span>
                                {clock(clip.start)} · {clip.duration.toFixed(1)}
                                s
                              </span>
                              {clip.transition && (
                                <span className="absolute right-1 top-1 rounded bg-black/50 px-1 text-[8px]">
                                  {clip.transition}
                                </span>
                              )}
                              {(clip.keyframes || []).map((time) => (
                                <i
                                  key={time}
                                  title={`Keyframe ${time.toFixed(1)} s`}
                                  className="absolute bottom-1 h-2 w-2 rotate-45 bg-amber-300"
                                  style={{
                                    left: `${(time / clip.duration) * 100}%`,
                                  }}
                                />
                              ))}
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })}
                <div className="pointer-events-none absolute bottom-0 left-36 right-0 top-[74px] z-10">
                  {markers.map((marker) => (
                    <span
                      key={marker}
                      title={`Marcador em ${clock(marker)}`}
                      className="absolute bottom-0 top-0 w-px bg-amber-400/50"
                      style={{ left: marker * zoom }}
                    >
                      <i className="absolute -left-1 top-0 h-2 w-2 rotate-45 bg-amber-400" />
                    </span>
                  ))}
                </div>
                {marquee && (
                  <span
                    aria-label="Área de seleção"
                    className="pointer-events-none absolute z-40 border border-blue-300 bg-blue-400/20"
                    style={{
                      left:
                        144 +
                        Math.min(marquee.startTime, marquee.endTime) * zoom,
                      top:
                        74 +
                        Math.min(
                          TRACKS.findIndex(([id]) => id === marquee.startTrack),
                          TRACKS.findIndex(([id]) => id === marquee.endTrack),
                        ) *
                          56,
                      width: Math.max(
                        1,
                        Math.abs(marquee.endTime - marquee.startTime) * zoom,
                      ),
                      height:
                        (Math.abs(
                          TRACKS.findIndex(([id]) => id === marquee.endTrack) -
                            TRACKS.findIndex(
                              ([id]) => id === marquee.startTrack,
                            ),
                        ) +
                          1) *
                        56,
                    }}
                  />
                )}
                <button
                  aria-label="Arrastar playhead"
                  onPointerDown={beginPlayheadDrag}
                  className="absolute bottom-0 top-[70px] z-50 w-3 -translate-x-1/2 cursor-ew-resize"
                  style={{ left: 144 + playhead * zoom }}
                >
                  <span className="absolute bottom-0 left-1/2 top-1 w-px bg-cyan-300" />
                  <i className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rotate-45 bg-cyan-300" />
                </button>
              </div>
            </div>
          </div>
        </main>

        <aside className="space-y-3 overflow-auto border border-[#303030] bg-[#1e1e1e] p-3 xl:col-start-3 xl:row-span-2 xl:row-start-1">
          <WorkspacePanel workspace={workspace} clip={chosen} patch={patch} />
          {workspace === "Edição" && (
            <>
              <div className="border-b border-slate-700 pb-3">
                <div className="mb-2 text-xs font-bold text-white">
                  Edição de precisão
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <button
                    disabled={!chosen}
                    onClick={() => nudgeSelected(-1 / 30)}
                    className="rounded border border-slate-700 p-2 disabled:opacity-30"
                  >
                    −1 quadro
                  </button>
                  <button
                    disabled={!chosen}
                    onClick={() => nudgeSelected(1 / 30)}
                    className="rounded border border-slate-700 p-2 disabled:opacity-30"
                  >
                    +1 quadro
                  </button>
                  <button
                    disabled={!chosen}
                    onClick={() => rippleTrim("in")}
                    className="rounded border border-slate-700 p-2 disabled:opacity-30"
                  >
                    Ripple IN
                  </button>
                  <button
                    disabled={!chosen}
                    onClick={() => rippleTrim("out")}
                    className="rounded border border-slate-700 p-2 disabled:opacity-30"
                  >
                    Ripple OUT
                  </button>
                  <button
                    disabled={!chosen}
                    onClick={() => slip(-1 / 30)}
                    className="rounded border border-slate-700 p-2 disabled:opacity-30"
                  >
                    Slip −1
                  </button>
                  <button
                    disabled={!chosen}
                    onClick={() => slip(1 / 30)}
                    className="rounded border border-slate-700 p-2 disabled:opacity-30"
                  >
                    Slip +1
                  </button>
                </div>
                <label className="mt-2 block text-[10px] text-slate-400">
                  Rate stretch · duração
                  <input
                    type="number"
                    min="0.5"
                    step="0.1"
                    value={chosen?.duration ?? 0}
                    disabled={!chosen}
                    onChange={(event) => rateStretch(+event.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 disabled:opacity-30"
                  />
                </label>
                <label className="mt-2 flex items-center gap-2 text-[10px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={chosen?.enabled ?? true}
                    disabled={!chosen}
                    onChange={(event) => patch("enabled", event.target.checked)}
                  />
                  Clipe habilitado
                </label>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {[
                    "Dissolver",
                    "Dip to Black",
                    "Dip to White",
                    "Film Dissolve",
                  ].map((name) => (
                    <button
                      key={name}
                      disabled={!chosen}
                      onClick={() => addTransition(name)}
                      className={`rounded border p-2 text-[9px] disabled:opacity-30 ${chosen?.transition === name ? "border-cyan-400 text-cyan-300" : "border-slate-700"}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-b border-slate-700 pb-2 text-xs font-bold text-cyan-300">
                Controles de efeitos
              </div>
              {chosen ? (
                [
                  ["Posição", "start", 0, 60, 0.1],
                  ["Duração", "duration", 0.5, 60, 0.1],
                  ["Velocidade", "speed", 25, 400, 1],
                  ["Opacidade", "opacity", 0, 100, 1],
                  ["Volume", "volume", 0, 200, 1],
                ].map(([label, key, min, max, step]) => (
                  <label key={key} className="block text-xs text-slate-400">
                    {label}
                    <div className="mt-1 flex gap-2">
                      <input
                        className="min-w-0 flex-1 accent-cyan-400"
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={chosen[key]}
                        disabled={trackState[chosen.track].locked}
                        onChange={(event) => patch(key, +event.target.value)}
                      />
                      <input
                        className="w-16 rounded border border-slate-700 bg-slate-950 px-2"
                        type="number"
                        step={step}
                        value={chosen[key]}
                        disabled={trackState[chosen.track].locked}
                        onChange={(event) => patch(key, +event.target.value)}
                      />
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-xs text-slate-500">
                  Selecione um clipe na timeline para ajustar posição, duração,
                  velocidade, opacidade e áudio.
                </p>
              )}
              <div className="rounded-lg border border-slate-800 p-3 text-[10px] text-slate-500">
                <b className="text-xs text-white">Sequência 01</b>
                <br />
                1920 × 1080 · 29,97 fps
                <br />
                48 kHz · Estéreo
                <br />
                {clips.length} clipes · {markers.length} marcadores
              </div>
            </>
          )}
          <AudioMeter
            active={playing && clips.some((clip) => clip.track.startsWith("A"))}
          />
        </aside>
      </div>
      {mediaLocatorOpen && (
        <MediaLocator
          media={media}
          onClose={() => setMediaLocatorOpen(false)}
          onRelink={chooseRelink}
          onBatch={() => relinkInput.current?.click()}
        />
      )}
      {contextMenu && (
        <PremiereContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          actions={{
            open: (asset) => openSource(asset),
            relink: chooseRelink,
            locate: () => setMediaLocatorOpen(true),
            rename: renameAsset,
            offline: makeAssetOffline,
            reveal: (clip) => {
              const asset = media.find((item) => item.id === clip.assetId);
              if (asset) openSource(asset);
            },
            duplicate: (clip) =>
              commit((items) => [
                ...items,
                {
                  ...clip,
                  id: crypto.randomUUID(),
                  start: clip.start + clip.duration,
                },
              ]),
            toggle: (clip) =>
              commit((items) =>
                items.map((item) =>
                  item.id === clip.id
                    ? { ...item, enabled: item.enabled === false }
                    : item,
                ),
              ),
            speed: (clip) => {
              const value = Number(
                window.prompt("Velocidade do clipe (%)", clip.speed || 100),
              );
              if (Number.isFinite(value) && value > 0) patch("speed", value);
            },
            split,
            remove: () => removeSelected(false),
            rippleRemove: () => removeSelected(true),
          }}
        />
      )}
    </section>
  );
}

function PremiereProjectPanel({
  media,
  source,
  setSource,
  sequenceName,
  onRelink,
  onContextMenu,
}) {
  const [tab, setTab] = useState("Projeto");
  const [query, setQuery] = useState("");
  const [folders, setFolders] = useState([
    "01 Mídias",
    "02 Áudio",
    "03 Gráficos",
    "04 Sequências",
  ]);
  const [sequences, setSequences] = useState([sequenceName]);
  const [view, setView] = useState("lista");
  const visible = media.filter((asset) =>
    asset.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="flex h-full flex-col text-[10px] text-slate-400">
      <div className="flex gap-5 border-b border-black px-3 py-2">
        {["Projeto", "Info", "Marcadores", "Histórico"].map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={
              tab === name
                ? "border-b border-slate-200 text-slate-200"
                : "text-slate-500"
            }
          >
            {name}
            {tab === name && name === "Projeto" ? " ☰" : ""}
          </button>
        ))}
      </div>
      {tab === "Projeto" ? (
        <>
          <div className="flex items-center justify-between px-2 py-2">
            <span>{sequenceName}.mmfilm</span>
            <span>{media.length + 1} itens</span>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="⌕ Pesquisar"
            className="mx-2 mb-2 rounded-full border border-[#333] bg-black px-3 py-1.5 outline-none focus:border-blue-500"
          />
          <div className="grid grid-cols-[1fr_46px_70px_76px_52px] border-b border-[#333] px-3 py-1 text-slate-500">
            <span>Nome</span>
            <span>FPS</span>
            <span>Início</span>
            <span>Duração</span>
            <span>Ação</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="bg-[#242424] px-2 py-1 text-slate-300">
              ⌄ 📁 {folders[0]}
            </div>
            {visible.map((asset) => (
              <div
                key={asset.id}
                role="button"
                tabIndex={0}
                aria-label={asset.name}
                onClick={() => setSource(asset)}
                onDoubleClick={() => setSource(asset)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSource(asset);
                }}
                onContextMenu={(event) => onContextMenu(event, asset)}
                className={`grid w-full cursor-default grid-cols-[1fr_46px_70px_76px_52px] items-center border-b border-[#292929] px-3 py-1.5 text-left ${source?.id === asset.id ? "bg-blue-900/40" : "hover:bg-[#292929]"}`}
              >
                <span className="truncate">
                  <i
                    className={`mr-2 inline-block h-2 w-2 ${asset.type.startsWith("audio") ? "bg-lime-700" : "bg-sky-700"}`}
                  />
                  {asset.name}
                  {asset.offline && (
                    <em className="ml-2 not-italic text-amber-400">Offline</em>
                  )}
                </span>
                <span>30</span>
                <span>00:00:00:00</span>
                <span>00:00:08:00</span>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onRelink(asset);
                  }}
                  className="border border-amber-600 px-1 py-0.5 text-[9px] text-amber-300 hover:bg-amber-950"
                >
                  Religar
                </button>
              </div>
            ))}
            {folders.slice(1).map((folder) => (
              <div
                key={folder}
                className="bg-[#242424] px-2 py-1 text-slate-300"
              >
                ⌄ 📁 {folder}
              </div>
            ))}
            {sequences.map((name) => (
              <div
                key={name}
                className="grid grid-cols-[1fr_46px_70px_76px] px-3 py-1.5"
              >
                <span>▰ {name}</span>
                <span>30</span>
                <span>00:00:00:00</span>
                <span>00:01:00:00</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t border-[#333] px-3 py-2 text-base">
            <button
              onClick={() => setView("lista")}
              className={view === "lista" ? "bg-[#555] px-1" : ""}
              title="Lista"
            >
              ☷
            </button>
            <button
              onClick={() => setView("ícones")}
              className={view === "ícones" ? "bg-[#555] px-1" : ""}
              title="Ícones"
            >
              ▦
            </button>
            <button
              onClick={() => setView("livre")}
              className={view === "livre" ? "bg-[#555] px-1" : ""}
              title="Visualização livre"
            >
              ⌘
            </button>
            <input
              aria-label="Tamanho dos itens"
              type="range"
              className="w-20"
            />
            <span className="ml-auto flex gap-4">
              <button title="Pesquisar">⌕</button>
              <button
                title="Nova pasta"
                onClick={() => {
                  const name = window.prompt(
                    "Nome da nova pasta",
                    "Nova pasta",
                  );
                  if (name) setFolders((old) => [...old, name]);
                }}
              >
                □
              </button>
              <button
                title="Nova sequência"
                onClick={() => {
                  const name = window.prompt(
                    "Nome da nova sequência",
                    `Sequência ${sequences.length + 1}`,
                  );
                  if (name) setSequences((old) => [...old, name]);
                }}
              >
                ▣
              </button>
              <button
                title="Excluir último item"
                onClick={() =>
                  sequences.length > 1
                    ? setSequences((old) => old.slice(0, -1))
                    : setFolders((old) =>
                        old.length > 4 ? old.slice(0, -1) : old,
                      )
                }
              >
                ♲
              </button>
            </span>
          </div>
        </>
      ) : (
        <div className="p-4 text-slate-500">Painel {tab}</div>
      )}
    </div>
  );
}

function MediaLocator({ media, onClose, onRelink, onBatch }) {
  const missing = media.filter((asset) => asset.offline);
  return (
    <div className="fixed inset-0 z-[250] grid place-items-center bg-black/70 p-6">
      <section className="max-h-[80vh] w-full max-w-2xl overflow-auto border border-[#555] bg-[#202020] shadow-2xl">
        <header className="flex items-center border-b border-[#444] px-4 py-3">
          <div>
            <b className="text-sm text-slate-100">Vincular mídia</b>
            <p className="text-[10px] text-slate-400">
              Escolha o arquivo correspondente sem remontar a timeline.
            </p>
          </div>
          <button onClick={onClose} className="ml-auto px-2 text-xl text-slate-400">
            ×
          </button>
        </header>
        <div className="divide-y divide-[#333]">
          {media.map((asset) => (
            <div key={asset.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
              <div className="min-w-0">
                <b className="block truncate text-xs text-slate-200">{asset.name}</b>
                <span className={asset.offline ? "text-amber-400" : "text-emerald-400"}>
                  {asset.offline
                    ? asset.originalPath
                      ? `Offline · original: ${asset.originalPath}`
                      : asset.sourceKind === "FilmCraft Generator"
                        ? "Offline · gerador interno do FilmCraft, sem arquivo salvo"
                        : "Offline · caminho original não armazenado no projeto"
                    : `Online · ${asset.linkedFileName || asset.name}`}
                </span>
              </div>
              <button
                onClick={() => onRelink(asset)}
                className="border border-amber-500 px-3 py-1.5 text-xs text-amber-200"
              >
                Religar individual…
              </button>
            </div>
          ))}
        </div>
        <footer className="flex items-center gap-3 border-t border-[#444] px-4 py-3">
          <span className="text-xs text-slate-400">{missing.length} arquivo(s) offline</span>
          <button onClick={onBatch} className="ml-auto border border-slate-500 px-3 py-1.5 text-xs">
            Procurar vários arquivos…
          </button>
          <button onClick={onClose} className="bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">
            Concluir
          </button>
        </footer>
      </section>
    </div>
  );
}

function PremiereContextMenu({ menu, actions, onClose }) {
  const isMedia = menu.type === "media";
  const asset = menu.item;
  const invoke = (action) => {
    action?.(asset);
    onClose();
  };
  const items = isMedia
    ? [
        ["Abrir no Monitor de Origem", actions.open],
        ["Religar mídia…", actions.relink],
        ["Localizar mídias offline…", actions.locate],
        ["Renomear…", actions.rename],
        ["Tornar offline", actions.offline],
        ["Propriedades", () => actions.open(asset)],
      ]
    : [
        ["Abrir no Monitor de Origem", actions.reveal],
        ["Revelar no Projeto", actions.reveal],
        ["Religar mídia…", () => actions.relink({ id: asset.assetId, name: asset.name })],
        ["Duplicar", actions.duplicate],
        [asset.enabled === false ? "Habilitar" : "Desabilitar", actions.toggle],
        ["Velocidade/Duração…", actions.speed],
        ["Adicionar corte no indicador", actions.split],
        ["Excluir", actions.remove],
        ["Excluir com ripple", actions.rippleRemove],
      ];
  return (
    <div className="fixed inset-0 z-[300]" onPointerDown={onClose}>
      <div
        role="menu"
        className="fixed min-w-56 border border-[#555] bg-[#242424] py-1 text-xs text-slate-200 shadow-2xl"
        style={{ left: Math.min(menu.x, window.innerWidth - 250), top: Math.min(menu.y, window.innerHeight - 330) }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {items.map(([label, action]) => (
          <button key={label} role="menuitem" onClick={() => invoke(action)} className="block w-full px-4 py-2 text-left hover:bg-blue-600">
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorEffectControls({ clip, patch }) {
  const rows = [
    ["Posição X", "x", clip?.x ?? 0, -960, 960],
    ["Posição Y", "y", clip?.y ?? 0, -540, 540],
    ["Escala", "scale", clip?.scale ?? 100, 0, 400],
    ["Rotação", "rotation", clip?.rotation ?? 0, -180, 180],
  ];
  const colorRows = [
    ["Temperatura", "temperature", clip?.temperature ?? 0, -100, 100],
    ["Matiz", "tint", clip?.tint ?? 0, -100, 100],
    ["Exposição", "exposure", clip?.exposure ?? 0, -80, 80],
    ["Contraste", "contrast", clip?.contrast ?? 100, 0, 200],
    ["Realces", "highlights", clip?.highlights ?? 0, -100, 100],
    ["Sombras", "shadows", clip?.shadows ?? 0, -100, 100],
    ["Brancos", "whites", clip?.whites ?? 0, -100, 100],
    ["Pretos", "blacks", clip?.blacks ?? 0, -100, 100],
    ["Saturação", "saturation", clip?.saturation ?? 100, 0, 200],
    ["Opacidade", "opacity", clip?.opacity ?? 100, 0, 100],
  ];
  return (
    <div className="h-full text-[10px] text-slate-400">
      <PanelHeader
        labels={["Lumetri Scopes", "Origem", "Controles de efeitos"]}
        active={2}
      />
      <div className="grid grid-cols-[1fr_42%] border-b border-black bg-[#202020]">
        <div className="truncate border-r border-black px-2 py-1">
          Origem · {clip?.name || "Nenhum clipe"}
        </div>
        <div className="truncate bg-slate-700/50 px-2 py-1">Sequência 01</div>
      </div>
      <div className="space-y-1 p-2">
        <b className="block text-slate-300">Vídeo</b>
        <ControlGroup title="Movimento">
          {rows.map(([label, key, value, min, max], index) => (
            <EditableControlRow
              key={label}
              label={label}
              value={value}
              min={min}
              max={max}
              disabled={!clip}
              onChange={(next) => patch(key, next)}
              keyframe={index === 1}
            />
          ))}
        </ControlGroup>
        <ControlGroup title="Opacidade">
          <EditableControlRow
            label="Opacidade"
            value={clip?.opacity ?? 100}
            min={0}
            max={100}
            disabled={!clip}
            onChange={(next) => patch("opacity", next)}
          />
          <label className="grid grid-cols-[1fr_110px] items-center gap-2 pl-4">
            <span>Modo de mesclagem</span>
            <select
              disabled={!clip}
              className="border border-[#333] bg-black px-2 py-1"
            >
              <option>Normal</option>
              <option>Multiplicação</option>
              <option>Tela</option>
              <option>Sobrepor</option>
            </select>
          </label>
        </ControlGroup>
        <ControlGroup title="Remapeamento de tempo">
          <EditableControlRow
            label="Velocidade"
            value={clip?.speed ?? 100}
            min={25}
            max={400}
            disabled={!clip}
            onChange={(next) => patch("speed", next)}
          />
        </ControlGroup>
        <ControlGroup title="Cor Lumetri">
          <ControlRow label="Correção básica" value="✓" />
          <ControlRow label="LUT de entrada" value="Nenhum" />
          {colorRows.map(([label, key, value, min, max]) => (
            <EditableControlRow
              key={label}
              label={label}
              value={value}
              min={min}
              max={max}
              disabled={!clip}
              onChange={(next) => patch(key, next)}
              keyframe={label === "Exposição"}
            />
          ))}
        </ControlGroup>
      </div>
    </div>
  );
}

function PanelHeader({ labels, active = 0 }) {
  return (
    <div className="flex gap-5 border-b border-black bg-[#1e1e1e] px-3 py-2">
      {labels.map((label, index) => (
        <button
          key={label}
          className={
            index === active
              ? "border-b border-slate-200 text-slate-200"
              : "text-slate-500"
          }
        >
          {label}
          {index === active ? " ☰" : ""}
        </button>
      ))}
    </div>
  );
}

function ControlGroup({ title, children }) {
  return (
    <div className="border-b border-[#303030] py-1">
      <div className="flex items-center gap-2 py-1 font-semibold text-slate-300">
        <span>⌄</span>
        <span className="text-[9px]">fx</span>
        <span>{title}</span>
        <span className="ml-auto">↻</span>
      </div>
      <div className="space-y-1 pl-4">{children}</div>
    </div>
  );
}

function ControlRow({ label, value, keyframe }) {
  return (
    <div className="grid grid-cols-[14px_1fr_auto] items-center gap-1 py-0.5">
      <span className="text-slate-500">◉</span>
      <span>{label}</span>
      <span className="font-mono text-blue-400">
        {value} {keyframe ? "◆" : ""}
      </span>
    </div>
  );
}

function EditableControlRow({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
  keyframe,
}) {
  return (
    <label className="grid grid-cols-[14px_70px_1fr_42px] items-center gap-1 py-0.5">
      <span className="text-slate-500">◉</span>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(+event.target.value)}
        className="min-w-0 accent-blue-500 disabled:opacity-30"
      />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(+event.target.value)}
        className="w-full border-0 bg-transparent text-right font-mono text-blue-400 outline-none disabled:opacity-30"
      />
      {keyframe && (
        <span className="col-start-4 text-right text-blue-400">◆</span>
      )}
    </label>
  );
}

function AudioMeter({ active }) {
  return (
    <div className="border-t border-black pt-3">
      <div className="mb-2 flex justify-between text-[9px] text-slate-500">
        <span>Medidores de áudio</span>
        <span>dB</span>
      </div>
      <div className="grid h-36 grid-cols-[1fr_1fr_24px] items-end gap-2 bg-black p-2">
        {[0, 1].map((channel) => (
          <div key={channel} className="relative h-full bg-[#111]">
            <span
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-500 via-lime-400 to-amber-400 transition-all duration-100 ${active ? (channel ? "h-[72%]" : "h-[82%]") : "h-[4%]"}`}
            />
          </div>
        ))}
        <div className="flex h-full flex-col justify-between text-[8px] text-slate-600">
          {[0, -6, -12, -24, -36, -48, -60].map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 text-center text-[9px] text-slate-500">
        <span>L</span>
        <span>R</span>
      </div>
    </div>
  );
}

function Tool({ label, children, active, onClick, disabled }) {
  return (
    <button
      aria-label={label}
      className={`rounded border border-slate-700 p-2 text-slate-300 disabled:opacity-30 ${active ? "border-cyan-500 text-cyan-300" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function TrackButton({ label, children, active, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded p-0.5 ${active ? "bg-cyan-400 text-slate-950" : "text-slate-500 hover:text-cyan-300"}`}
    >
      {children}
    </button>
  );
}
function MonitorAction({ children, ...props }) {
  return (
    <button
      {...props}
      className="rounded border border-slate-700 px-2 py-1 text-[10px] text-cyan-300 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
const APPLICATION_MENUS = {
  Mídia: [
    ["Importar mídia…", "importMedia"],
    ["Vincular mídia…", "relinkMedia"],
    ["Gerenciar proxies"],
  ],
  Arquivo: [
    ["Novo projeto"],
    ["Abrir projeto…"],
    ["Salvar"],
    ["Salvar como…"],
    ["Exportar", "exportView"],
  ],
  Editar: [
    ["Desfazer", "undo"],
    ["Refazer", "redo"],
    ["Recortar"],
    ["Copiar"],
    ["Colar"],
    ["Preferências"],
  ],
  Clipe: [
    ["Renomear"],
    ["Velocidade/Duração…"],
    ["Opções de vídeo"],
    ["Áudio"],
    ["Dividir", "split"],
  ],
  Sequência: [
    ["Nova sequência…"],
    ["Configurações da sequência…"],
    ["Renderizar entrada/saída"],
    ["Adicionar edição", "split"],
  ],
  Marcadores: [
    ["Adicionar marcador", "marker"],
    ["Próximo marcador"],
    ["Marcador anterior"],
    ["Limpar marcadores"],
  ],
  "Gráficos e Títulos": [
    ["Novo texto"],
    ["Nova camada"],
    ["Instalar modelo…"],
    ["Atualizar texto"],
  ],
  Exibir: [
    ["Monitor de origem"],
    ["Monitor do programa"],
    ["Réguas"],
    ["Guias"],
    ["Tela cheia"],
  ],
  Janela: [
    ["Projetos"],
    ["Controles de efeitos"],
    ["Efeitos"],
    ["Mixer de faixa de áudio"],
    ["Som essencial"],
    ["Texto"],
  ],
  Ajuda: [["Ajuda do MMFilm"], ["Atalhos de teclado"], ["Sobre o MMFilm"]],
};
function ApplicationMenu({ name, actions, onClose }) {
  return (
    <div className="absolute left-2 top-full z-[100] mt-px min-w-56 border border-[#454545] bg-[#202020] py-1 shadow-2xl">
      {APPLICATION_MENUS[name].map(([label, action]) => (
        <button
          key={label}
          onClick={() => {
            if (action && actions[action]) actions[action]();
            else actions.notify(label);
            onClose();
          }}
          className="block w-full px-4 py-1.5 text-left hover:bg-blue-600 hover:text-white"
        >
          {label}
          <span className="float-right text-slate-500">
            {action === "undo"
              ? "Ctrl+Z"
              : action === "redo"
                ? "Ctrl+Shift+Z"
                : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
function AudioTrackMixer({ trackState, toggleTrack }) {
  return (
    <div className="h-full text-[10px] text-slate-300">
      <div className="flex gap-4 border-b border-black px-2 py-2">
        <button className="border-b border-slate-200">Mixer de faixa ☰</button>
        <button>Origem</button>
        <button>Mixer de clipe</button>
        <button>Efeitos</button>
      </div>
      <div className="grid h-[calc(100%-34px)] grid-cols-4 gap-px bg-black">
        {["A1", "A2", "A3", "Mix"].map((id) => {
          const state = trackState[id] || {};
          return (
            <div
              key={id}
              className="flex flex-col items-center bg-[#202020] px-1 py-2"
            >
              <select className="w-full bg-[#111]">
                <option>Estéreo</option>
                <option>Mono</option>
              </select>
              <select className="mt-1 w-full bg-[#111]">
                <option>Mix</option>
                <option>Submix 1</option>
              </select>
              <input
                aria-label={`Pan ${id}`}
                type="range"
                min="-100"
                max="100"
                defaultValue="0"
                className="my-3 w-full"
              />
              <select className="w-full bg-[#111]">
                <option>Leitura</option>
                <option>Touch</option>
                <option>Latch</option>
              </select>
              <div className="my-2 flex gap-1">
                <button
                  onClick={() => id !== "Mix" && toggleTrack(id, "muted")}
                  className={
                    state.muted
                      ? "bg-amber-500 px-1 text-black"
                      : "bg-[#333] px-1"
                  }
                >
                  M
                </button>
                <button
                  onClick={() => id !== "Mix" && toggleTrack(id, "solo")}
                  className={
                    state.solo
                      ? "bg-amber-500 px-1 text-black"
                      : "bg-[#333] px-1"
                  }
                >
                  S
                </button>
                <button
                  onClick={() => id !== "Mix" && toggleTrack(id, "armed")}
                  className={state.armed ? "bg-red-600 px-1" : "bg-[#333] px-1"}
                >
                  R
                </button>
              </div>
              <div className="relative flex min-h-64 w-full flex-1 justify-center bg-black">
                <div className="absolute bottom-2 top-2 w-2 bg-gradient-to-t from-emerald-500 via-lime-400 to-red-500 opacity-60" />
                <input
                  aria-label={`Volume ${id}`}
                  type="range"
                  min="-60"
                  max="12"
                  defaultValue="0"
                  className="relative z-10 h-full [writing-mode:vertical-lr]"
                />
              </div>
              <b className="mt-2">{id}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Monitor({ title, asset, children, playing = false, playhead = 0 }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || title !== "Programa" || !asset?.url) return;
    const target = clipMediaTime(asset, playhead);
    if (Number.isFinite(video.duration))
      video.currentTime = Math.min(target, Math.max(0, video.duration - 0.01));
    else video.currentTime = target;
    video.playbackRate = Math.max(
      0.25,
      Math.min(4, (asset.speed || 100) / 100),
    );
    if (playing) video.play().catch(() => {});
    else video.pause();
  }, [asset, playhead, playing, title]);
  const visualStyle = asset
    ? {
        opacity: (asset.opacity ?? 100) / 100,
        transform: `translate(${asset.x ?? 0}px, ${asset.y ?? 0}px) rotate(${asset.rotation ?? 0}deg) scale(${(asset.scale ?? 100) / 100})`,
        filter: `brightness(${100 + (asset.exposure ?? 0)}%) contrast(${asset.contrast ?? 100}%) saturate(${asset.saturation ?? 100}%)`,
      }
    : undefined;
  return (
    <div className="overflow-hidden border border-[#303030] bg-black">
      <div className="flex items-center gap-2 border-b border-black bg-[#1e1e1e] px-3 py-2 text-[11px] font-medium text-slate-300">
        <span className="mr-auto border-b border-slate-300 pb-0.5">
          {title} ☰
        </span>
        {children}
      </div>
      <div className="grid aspect-video min-h-[230px] place-items-center">
        {asset?.offline || (asset && !asset.url) ? (
          <div className="max-w-sm border border-amber-500/50 bg-amber-950/20 p-5 text-center text-xs text-amber-200">
            <b className="block text-sm">Mídia offline</b>
            <span className="mt-2 block text-slate-400">{asset.name}</span>
            <span className="mt-2 block">
              Use “Importar mídia” e escolha o arquivo original para religar e
              reproduzir este clipe.
            </span>
          </div>
        ) : asset ? (
          asset.type?.startsWith("video") ? (
            <video
              ref={videoRef}
              controls
              src={asset.url}
              style={visualStyle}
              className="h-full w-full object-contain"
            />
          ) : asset.type?.startsWith("image") ? (
            <img
              src={asset.url}
              alt=""
              style={visualStyle}
              className="h-full w-full object-contain"
            />
          ) : (
            <Volume2 size={36} className="text-emerald-300" />
          )
        ) : (
          <span className="text-xs text-slate-600">
            {title === "Programa" ? "00:00:00:00" : "Nenhuma mídia"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-[#303030] bg-[#1e1e1e] px-3 py-2 text-[10px] text-slate-500">
        <span className="font-mono text-blue-400">00:00:00:00</span>
        <button>Fit ▾</button>
        <button>1/2 ▾</button>
        <span className="ml-auto">◀ │ ▶</span>
      </div>
    </div>
  );
}

function ExportWorkspace({ sequenceName, program }) {
  const [fileName, setFileName] = useState(sequenceName || "Main Edit");
  const [location, setLocation] = useState("C:\\Users\\Alex\\Videos");
  const [preset, setPreset] = useState(
    "Corresponder à origem – Alta taxa de bits",
  );
  const [format, setFormat] = useState("H.264");
  const [queue, setQueue] = useState([]);
  const [running, setRunning] = useState(false);
  const [videoOpen, setVideoOpen] = useState(true);
  const [audioOpen, setAudioOpen] = useState(true);
  const [quality, setQuality] = useState(true);
  const [hardware, setHardware] = useState(true);

  function addToQueue() {
    setQueue((old) => [
      ...old,
      { id: Date.now(), name: fileName, format, preset, status: "Pronto" },
    ]);
  }
  function startQueue() {
    setRunning(true);
    setQueue((old) => old.map((item) => ({ ...item, status: "Codificando" })));
    window.setTimeout(() => {
      setQueue((old) => old.map((item) => ({ ...item, status: "Concluído" })));
      setRunning(false);
    }, 900);
  }
  function exportSettings() {
    const blob = new Blob(
      [
        JSON.stringify(
          { fileName, location, preset, format, quality, hardware },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName}.mmexport.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid min-h-[760px] grid-cols-[270px_minmax(470px,1fr)_minmax(420px,0.9fr)] gap-px bg-black text-[10px] text-slate-300">
      <aside className="flex flex-col bg-[#1e1e1e]">
        <h3 className="border-b border-[#333] px-3 py-3 text-xs font-bold">
          Destinos
        </h3>
        {[
          "Arquivo de mídia",
          "YouTube",
          "Vimeo",
          "TikTok",
          "Instagram",
          "FTP",
        ].map((name, index) => (
          <button
            key={name}
            className={`mx-2 mt-1 px-3 py-2 text-left ${index === 0 ? "bg-[#3a3a3a] text-white" : "hover:bg-[#292929]"}`}
          >
            {name}
          </button>
        ))}
        <div className="mt-3 border-t border-[#333] px-3 py-2">
          <div className="mb-2 flex justify-between">
            <b>Fila ({queue.length})</b>
            <button onClick={addToQueue} className="text-blue-400">
              + Adicionar
            </button>
          </div>
          <p className="mb-2 text-slate-500">
            Fila editável no estilo Media Encoder.
          </p>
          <div className="space-y-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="border border-[#3b3b3b] bg-[#252525] p-2"
              >
                <div className="flex gap-1">
                  <input
                    value={item.name}
                    onChange={(event) =>
                      setQueue((old) =>
                        old.map((job) =>
                          job.id === item.id
                            ? { ...job, name: event.target.value }
                            : job,
                        ),
                      )
                    }
                    className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
                  />
                  <button
                    onClick={() =>
                      setQueue((old) => old.filter((job) => job.id !== item.id))
                    }
                  >
                    ×
                  </button>
                </div>
                <div className="mt-1 flex justify-between">
                  <select
                    value={item.format}
                    onChange={(event) =>
                      setQueue((old) =>
                        old.map((job) =>
                          job.id === item.id
                            ? { ...job, format: event.target.value }
                            : job,
                        ),
                      )
                    }
                    className="bg-[#111]"
                  >
                    <option>H.264</option>
                    <option>HEVC</option>
                    <option>QuickTime</option>
                  </select>
                  <span
                    className={
                      item.status === "Concluído"
                        ? "text-emerald-400"
                        : "text-amber-300"
                    }
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto flex gap-1 border-t border-[#333] p-2">
          <button
            disabled={!queue.length || running}
            onClick={startQueue}
            className="border border-[#444] px-2 py-1 disabled:opacity-40"
          >
            Iniciar fila
          </button>
          <button
            disabled={!running}
            onClick={() => setRunning(false)}
            className="border border-[#444] px-2 py-1 disabled:opacity-40"
          >
            Parar
          </button>
          <button
            onClick={() =>
              setQueue((old) =>
                old.filter((item) => item.status !== "Concluído"),
              )
            }
            className="border border-[#444] px-2 py-1"
          >
            Limpar
          </button>
        </div>
      </aside>
      <main className="overflow-auto bg-[#202020] p-4">
        <h3 className="mb-4 text-sm font-bold">Arquivo de mídia</h3>
        <ExportField label="Nome">
          <input
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
          />
        </ExportField>
        <ExportField label="Local">
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </ExportField>
        <ExportField label="Predefinição">
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value)}
          >
            <option>Corresponder à origem – Alta taxa de bits</option>
            <option>YouTube 1080p Full HD</option>
            <option>Instagram 1080×1350</option>
            <option>TikTok 1080×1920</option>
          </select>
        </ExportField>
        <ExportField label="Formato">
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option>H.264</option>
            <option>HEVC (H.265)</option>
            <option>QuickTime</option>
            <option>WAV</option>
          </select>
        </ExportField>
        <ExportSection title="Vídeo" open={videoOpen} setOpen={setVideoOpen}>
          <ExportCheck
            label="Tamanho do quadro"
            checked
            value="Corresponder à origem · 1920×1080"
          />
          <ExportCheck label="Taxa de quadros" checked value="29,97 fps" />
          <ExportField label="Ordem dos campos">
            <select>
              <option>Progressivo</option>
              <option>Superior primeiro</option>
            </select>
          </ExportField>
          <ExportField label="Aspecto">
            <select>
              <option>Pixels quadrados (1,0)</option>
              <option>Anamórfico</option>
            </select>
          </ExportField>
          <ExportField label="Perfil">
            <select>
              <option>High</option>
              <option>Main</option>
              <option>Baseline</option>
            </select>
          </ExportField>
          <ExportField label="Codificação">
            <select>
              <option>VBR, 1 passagem</option>
              <option>VBR, 2 passagens</option>
              <option>CBR</option>
            </select>
          </ExportField>
          <ExportField label="Taxa alvo">
            <input type="number" defaultValue="9.94" step="0.1" />
          </ExportField>
          <ExportCheck
            label="Hardware"
            checked={hardware}
            onChange={setHardware}
            value="Usar codificador disponível"
          />
          <ExportCheck
            label="Qualidade máxima"
            checked={quality}
            onChange={setQuality}
          />
        </ExportSection>
        <ExportSection title="Áudio" open={audioOpen} setOpen={setAudioOpen}>
          <ExportCheck label="Exportar áudio" checked />
          <ExportField label="Formato">
            <select>
              <option>AAC</option>
              <option>PCM</option>
              <option>MP3</option>
            </select>
          </ExportField>
          <ExportField label="Amostragem">
            <select>
              <option>48000 Hz</option>
              <option>44100 Hz</option>
            </select>
          </ExportField>
          <ExportField label="Canais">
            <select>
              <option>Estéreo</option>
              <option>Mono</option>
            </select>
          </ExportField>
          <ExportField label="Taxa de áudio">
            <select>
              <option>320 kbps</option>
              <option>256 kbps</option>
              <option>192 kbps</option>
            </select>
          </ExportField>
        </ExportSection>
        {["Multiplexador", "Legendas", "Efeitos", "Metadados"].map((title) => (
          <div key={title} className="border-t border-[#333] py-2 text-xs">
            › {title}
          </div>
        ))}
      </main>
      <aside className="flex flex-col bg-[#202020] p-4">
        <div className="grid min-h-72 place-items-center bg-black">
          {program?.url ? (
            <video
              src={program.url}
              className="max-h-72 w-full object-contain"
            />
          ) : (
            <div className="h-44 w-4/5 bg-[radial-gradient(ellipse_at_center,_#214169_0%,_#111a2b_50%,_#02050b_100%)]" />
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ExportField label="Intervalo">
            <select>
              <option>Sequência inteira</option>
              <option>Entrada/Saída</option>
            </select>
          </ExportField>
          <ExportField label="Escala">
            <select>
              <option>Ajustar ao quadro</option>
              <option>Preencher</option>
            </select>
          </ExportField>
        </div>
        <div className="mt-3 bg-[#111] p-4 leading-5">
          <b className="text-white">Resumo</b>
          <p>
            Saída: {location}\\{fileName}.mp4
          </p>
          <p>{format} · 1920×1080 · 29,97 fps · Progressivo</p>
          <p>VBR · Alvo 9,94 Mbps · AAC 320 kbps</p>
          <p className="mt-3 text-slate-500">Tamanho estimado: 34 MB</p>
        </div>
        <div className="mt-auto flex justify-end gap-2">
          <button
            onClick={addToQueue}
            className="rounded-full border border-slate-500 px-6 py-2 font-bold"
          >
            Enviar à fila
          </button>
          <button
            onClick={exportSettings}
            className="rounded-full bg-blue-600 px-8 py-2 font-bold text-white"
          >
            Exportar
          </button>
        </div>
      </aside>
    </div>
  );
}

function ExportField({ label, children }) {
  return (
    <label className="mb-2 grid grid-cols-[120px_1fr] items-center gap-3">
      <span className="text-right text-slate-400">{label}</span>
      <span className="[&_input]:w-full [&_input]:border [&_input]:border-[#333] [&_input]:bg-[#111] [&_input]:px-2 [&_input]:py-1 [&_select]:w-full [&_select]:border [&_select]:border-[#333] [&_select]:bg-[#111] [&_select]:px-2 [&_select]:py-1">
        {children}
      </span>
    </label>
  );
}
function ExportSection({ title, open, setOpen, children }) {
  return (
    <section className="border-t border-[#333] py-2">
      <button onClick={() => setOpen(!open)} className="mb-2 text-xs font-bold">
        {open ? "⌄" : "›"} {title}
      </button>
      {open && children}
    </section>
  );
}
function ExportCheck({ label, checked, onChange = () => {}, value }) {
  return (
    <label className="mb-2 grid grid-cols-[120px_1fr] items-center gap-3">
      <span className="text-right text-slate-400">{label}</span>
      <span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mr-2"
        />
        {value}
      </span>
    </label>
  );
}

function WorkspacePanel({ workspace, clip, patch }) {
  const [openEffects, setOpenEffects] = useState({});
  const Icon =
    workspace === "Cor"
      ? BarChart3
      : workspace === "Áudio"
        ? AudioLines
        : workspace === "Legendas"
          ? Captions
          : workspace === "Exportar"
            ? CircleGauge
            : SlidersHorizontal;
  return (
    <div
      className={
        workspace === "Cor" ||
        workspace === "Edição" ||
        workspace === "Efeitos" ||
        workspace === "Legendas" ||
        workspace === "Gráficos" ||
        workspace === "Áudio" ||
        workspace === "Montagem"
          ? "bg-[#1e1e1e]"
          : "rounded-lg border border-cyan-950 bg-slate-950/50 p-3"
      }
    >
      {workspace !== "Edição" &&
        workspace !== "Efeitos" &&
        workspace !== "Legendas" &&
        workspace !== "Gráficos" &&
        workspace !== "Áudio" &&
        workspace !== "Montagem" && (
          <h3
            className={`flex items-center gap-2 text-xs font-bold text-white ${workspace === "Cor" ? "border-b border-black px-1 pb-2" : "mb-2"}`}
          >
            <Icon size={14} className="text-cyan-300" />
            {workspace === "Cor" ? "Cor Lumetri ☰" : `Workspace ${workspace}`}
          </h3>
        )}
      {workspace === "Montagem" && (
        <div className="min-h-full bg-[#1e1e1e] text-[11px]">
          <div className="flex border-b border-[#333] px-2">
            <button className="border-b-2 border-slate-200 px-3 py-2 text-white">
              Informações
            </button>
            <button className="px-3 py-2 text-slate-400">Metadados</button>
            <button className="px-3 py-2 text-slate-400">Histórico</button>
          </div>
          <div className="p-3">
            <p className="mb-4 text-slate-500">
              Selecione uma mídia ou sequência no painel Projeto.
            </p>
            <PanelStack
              rows={[
                ["Área de trabalho", "Montagem"],
                ["Exibição", "Ícones livres"],
                ["Ordenação", "Nome"],
                ["Metadados", "Básicos"],
              ]}
            />
          </div>
        </div>
      )}
      {workspace === "Edição" && (
        <EditingWorkspacePanel clip={clip} patch={patch} />
      )}
      {workspace === "Cor" && (
        <div className="text-[10px]">
          <div className="border-b border-[#333] py-2 text-slate-400">
            Master · {clip?.name || "Nenhum clipe"}
            <span className="float-right italic">fx</span>
          </div>
          <LumetriSection title="Correção básica" open>
            <select className="mb-2 w-full border border-[#333] bg-black px-2 py-1 text-slate-300">
              <option>LUT de entrada · Nenhum</option>
              <option>Rec.709</option>
              <option>Log para Rec.709</option>
            </select>
            {[
              ["Temperatura", "temperature", -100, 100],
              ["Matiz", "tint", -100, 100],
              ["Saturação", "saturation", 0, 200],
              ["Exposição", "exposure", -80, 80],
              ["Contraste", "contrast", 0, 200],
              ["Realces", "highlights", -100, 100],
              ["Sombras", "shadows", -100, 100],
              ["Brancos", "whites", -100, 100],
              ["Pretos", "blacks", -100, 100],
            ].map(([label, key, min, max]) => (
              <Range
                key={key}
                label={label}
                value={
                  clip?.[key] ??
                  (key === "saturation" || key === "contrast" ? 100 : 0)
                }
                min={min}
                max={max}
                onChange={(value) => patch(key, value)}
                disabled={!clip}
              />
            ))}
          </LumetriSection>
          {[
            "Criativo",
            "Curvas",
            "Rodas de cor e correspondência",
            "HSL Secundário",
            "Vinheta",
          ].map((title, index) => (
            <LumetriSection key={title} title={title} enabled={index !== 3} />
          ))}
        </div>
      )}
      {workspace === "Efeitos" && (
        <div className="min-h-full bg-[#1e1e1e] p-2 text-[11px]">
          <div className="mb-3 border-b border-[#333] pb-2 text-xs text-slate-200">
            <span className="border-b border-slate-300 pb-1">Efeitos</span> ☰
          </div>
          <input
            placeholder="Pesquisar efeitos"
            className="mb-2 w-full rounded-full border border-[#444] bg-[#111] px-3 py-2 text-slate-300"
          />
          {Object.entries({
            Predefinições: ["Cinema", "Documentário", "Redes sociais"],
            "Predefinições Lumetri": ["Cinematic", "Monochrome", "Film Stock"],
            "Efeitos de áudio": [
              "Compressor",
              "Equalizador paramétrico",
              "Redução de ruído",
            ],
            "Transições de áudio": [
              "Ganho constante",
              "Potência constante",
              "Fade exponencial",
            ],
            "Efeitos de vídeo": [
              "Desfoque gaussiano",
              "Estabilizador",
              "Nitidez",
              "Transformar",
            ],
            "Transições de vídeo": [
              "Dissolver",
              "Dip to Black",
              "Slide",
              "Wipe",
            ],
            Legado: ["Film Dissolve", "Mosaico", "Posterizar tempo"],
          }).map(([name, effects]) => (
            <div key={name}>
              <button
                onClick={() =>
                  setOpenEffects((old) => ({ ...old, [name]: !old[name] }))
                }
                className="flex w-full items-center gap-2 py-2 text-left text-slate-300 hover:bg-[#292929]"
              >
                <span className="text-slate-500">
                  {openEffects[name] ? "⌄" : "›"}
                </span>
                <span className="inline-block h-2.5 w-3.5 border border-slate-400" />
                {name}
              </button>
              {openEffects[name] && (
                <div className="ml-7 border-l border-[#3b3b3b] pl-2">
                  {effects.map((effect) => (
                    <button
                      key={effect}
                      disabled={!clip}
                      onDoubleClick={() =>
                        patch("effects", [...(clip?.effects || []), effect])
                      }
                      onClick={() => clip && patch("selectedEffect", effect)}
                      className={`block w-full py-1.5 text-left disabled:opacity-40 ${clip?.selectedEffect === effect ? "bg-blue-600/30 text-blue-300" : "text-slate-400 hover:bg-[#292929]"}`}
                    >
                      fx　{effect}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {workspace === "Áudio" && (
        <div className="text-[11px]">
          <div className="mb-2 border-b border-[#333] pb-2 text-xs text-slate-200">
            Som essencial ☰
          </div>
          <PanelTabs labels={["Procurar", "Editar"]} />
          <div className="py-3 font-bold text-slate-200">
            {clip?.name || "Selecione um clipe de áudio"}
          </div>
          <p className="mb-3 text-slate-500">
            Atribua um tipo de áudio à seleção:
          </p>
          {["Diálogo", "Música", "Efeitos sonoros", "Ambiente"].map((name) => (
            <button
              key={name}
              disabled={!clip}
              onClick={() => patch("audioType", name)}
              className={`mb-2 block w-full border p-3 text-left font-semibold disabled:opacity-40 ${clip?.audioType === name ? "border-blue-500 bg-blue-500/10" : "border-[#444] bg-[#111]"}`}
            >
              ◯　{name}
            </button>
          ))}
        </div>
      )}
      {workspace === "Gráficos" && (
        <EditingWorkspacePanel
          clip={clip}
          patch={patch}
          initialTab="Gráficos essenciais"
        />
      )}
      {workspace === "Legendas" && (
        <EditingWorkspacePanel clip={clip} patch={patch} initialTab="Texto" />
      )}
      {workspace === "Exportar" && (
        <div className="space-y-2 text-[10px]">
          <PanelStack
            rows={[
              ["Arquivo", "Sequência 01.mp4"],
              ["Formato", "H.264"],
              ["Preset", "Match Source"],
              ["Vídeo", "1920×1080 · 29,97"],
              ["Áudio", "AAC · 48 kHz"],
            ]}
          />
          <label className="flex items-center gap-2 text-slate-300">
            <input type="checkbox" defaultChecked /> Renderizar na qualidade
            máxima
          </label>
          <button className="w-full rounded border border-cyan-500 p-2 font-bold text-cyan-300">
            Adicionar à fila
          </button>
          <button className="w-full rounded bg-cyan-400 p-2 font-bold text-slate-950">
            Exportar
          </button>
        </div>
      )}
    </div>
  );
}

const GRAPHIC_TEMPLATES = [
  ["Lower Third – Slab", "Lower Thirds", "ALEX MORGAN", "left"],
  ["Lower Third – Rule", "Lower Thirds", "SAM RIVERA", "left"],
  ["Title – Centered", "Titles", "THE LONG WAY HOME", "center"],
  ["Title – Boxed", "Titles", "Chapter One", "box"],
  ["End Credits – Roll", "End Credits", "CREDITS", "credits"],
  ["Callout – Pointer", "Callouts", "Label here", "pointer"],
  ["Callout – Tag", "Callouts", "● LIVE", "tag"],
  ["Ticker – Crawl", "Lower Thirds", "Breaking news · MediaMind", "ticker"],
];

function EditingWorkspacePanel({ clip, patch, initialTab = "Propriedades" }) {
  const [tab, setTab] = useState(initialTab);
  const [graphicsMode, setGraphicsMode] = useState("Procurar");
  const [textMode, setTextMode] = useState("Transcrição");
  const [templateSearch, setTemplateSearch] = useState("");
  const [captionTrack, setCaptionTrack] = useState(false);
  const shownTemplates = GRAPHIC_TEMPLATES.filter(([name]) =>
    name.toLowerCase().includes(templateSearch.toLowerCase()),
  );

  return (
    <div className="min-h-full text-[10px] text-slate-300">
      <div className="flex border-b border-[#333] text-[11px]">
        {["Propriedades", "Gráficos essenciais", "Texto"].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-3 py-2 ${tab === item ? "border-b-2 border-slate-200 text-white" : "text-slate-400"}`}
          >
            {item}
            {item === "Texto" ? " ☰" : ""}
          </button>
        ))}
      </div>

      {tab === "Propriedades" && (
        <div className="p-2">
          <div className="mb-2 border-b border-[#333] pb-3 text-xs font-semibold text-slate-200">
            <span className="mr-2 inline-block h-2 w-2 bg-sky-700" />
            {clip?.name || "Nenhum clipe selecionado"}
          </div>
          <PropertyGroup
            title="Transformar"
            reset={() => {
              patch("x", 0);
              patch("y", 0);
              patch("scale", 100);
              patch("rotation", 0);
              patch("opacity", 100);
            }}
          >
            <PropertyNumber
              label="Posição"
              value={`${clip?.x ?? 960} X     ${clip?.y ?? 540} Y`}
              diamond
            />
            <PropertyNumber
              label="Ponto de ancoragem"
              value={`${clip?.anchorX ?? 960} X     ${clip?.anchorY ?? 540} Y`}
              diamond
            />
            <PropertyNumber
              label="Escala"
              value={`${clip?.scale ?? 100} %`}
              diamond
            />
            <PropertyNumber
              label="Rotação"
              value={`${clip?.rotation ?? 0}.0°`}
              diamond
            />
            <PropertyNumber
              label="Opacidade"
              value={`${clip?.opacity ?? 100} %`}
              diamond
            />
          </PropertyGroup>
          <PropertyGroup title="Cortar">
            {[
              ["Esquerda", "cropLeft"],
              ["Superior", "cropTop"],
              ["Direita", "cropRight"],
              ["Inferior", "cropBottom"],
            ].map(([label, key]) => (
              <label
                key={key}
                className="grid grid-cols-[1fr_66px_18px] items-center gap-2 px-3 py-2 text-[11px]"
              >
                <span className="text-slate-400">{label}</span>
                <input
                  disabled={!clip}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={clip?.[key] ?? 0}
                  onChange={(event) => patch(key, +event.target.value)}
                  className="border-0 bg-transparent text-right text-blue-400 outline-none"
                />
                <span className="text-slate-400">◇</span>
              </label>
            ))}
          </PropertyGroup>
          <button
            disabled={!clip}
            onClick={() => patch("speed", 100)}
            className="mt-2 rounded border border-[#3a3a3a] px-5 py-2 text-[11px] disabled:opacity-40"
          >
            Velocidade {clip?.speed ?? 100}%
          </button>
        </div>
      )}

      {tab === "Gráficos essenciais" && (
        <div>
          <div className="flex border-b border-[#333] px-1">
            {["Procurar", "Editar"].map((item) => (
              <button
                key={item}
                onClick={() => setGraphicsMode(item)}
                className={`px-3 py-2 text-[11px] font-semibold ${graphicsMode === item ? "border-b-2 border-blue-500 text-white" : "text-slate-400"}`}
              >
                {item}
              </button>
            ))}
          </div>
          {graphicsMode === "Procurar" ? (
            <div className="p-1">
              <div className="mb-2 grid grid-cols-[1fr_100px_58px] gap-1">
                <input
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  placeholder="Pesquisar modelos"
                  className="rounded border border-[#3a3a3a] bg-[#111] px-2 py-1"
                />
                <select className="rounded border border-[#3a3a3a] bg-[#111] px-1">
                  <option>Todas</option>
                  <option>Títulos</option>
                  <option>Lower Thirds</option>
                </select>
                <button className="rounded border border-[#3a3a3a]">
                  Instalar…
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {shownTemplates.map(([name, category, sample, kind]) => (
                  <button
                    key={name}
                    onClick={() => clip && patch("graphicTemplate", name)}
                    className="overflow-hidden rounded bg-[#111] text-left hover:ring-1 hover:ring-blue-500"
                  >
                    <span className="grid h-24 place-items-center bg-[#2d3440] px-3 text-center text-[9px] font-bold text-white">
                      <span
                        className={
                          kind === "box"
                            ? "bg-amber-100 px-2 py-1 text-slate-800"
                            : kind === "tag"
                              ? "justify-self-start rounded bg-slate-900 px-2 py-1"
                              : ""
                        }
                      >
                        {sample}
                      </span>
                    </span>
                    <span className="block px-1 pt-1 text-[11px] text-slate-200">
                      {name}
                    </span>
                    <span className="block px-1 pb-1 text-slate-500">
                      {category}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-3">
              <b className="text-xs text-white">Editar gráfico selecionado</b>
              <input
                defaultValue="Título do gráfico"
                className="w-full border border-[#444] bg-[#111] p-2"
              />
              <PanelStack
                rows={[
                  ["Fonte", "Inter Semibold"],
                  ["Tamanho", "64 px"],
                  ["Alinhamento", "Centro"],
                  ["Preenchimento", "#FFFFFF"],
                ]}
              />
            </div>
          )}
        </div>
      )}

      {tab === "Texto" && (
        <div>
          <div className="flex border-b border-[#333]">
            {["Transcrição", "Legendas", "Gráficos"].map((item) => (
              <button
                key={item}
                onClick={() => setTextMode(item)}
                className={`flex-1 px-1 py-3 text-[11px] ${textMode === item ? "border-b-2 border-slate-200 font-bold text-white" : "text-slate-400"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="grid min-h-[430px] place-items-center p-5 text-center">
            {textMode === "Transcrição" && (
              <div>
                <Captions size={32} className="mx-auto mb-4 text-slate-400" />
                <h4 className="mb-2 text-base font-bold">
                  Transcrever sequência
                </h4>
                <p className="mb-4 text-[11px] text-slate-400">
                  Gere uma transcrição editável para pesquisar e montar a
                  sequência por texto.
                </p>
                <button className="w-full rounded-full bg-blue-600 px-8 py-2 text-xs font-bold text-white">
                  Transcrever
                </button>
              </div>
            )}
            {textMode === "Legendas" && (
              <div>
                <Captions size={32} className="mx-auto mb-4 text-slate-400" />
                <h4 className="mb-2 text-base font-bold">
                  {captionTrack
                    ? "Faixa de legendas criada"
                    : "Adicionar legendas"}
                </h4>
                <p className="mb-4 text-[11px] text-slate-400">
                  Crie uma faixa de legendas ou importe um arquivo SRT/VTT.
                </p>
                <button
                  onClick={() => setCaptionTrack(true)}
                  className="mb-2 w-full rounded-full bg-blue-600 px-8 py-2 text-xs font-bold text-white"
                >
                  Criar nova faixa de legendas
                </button>
                <label className="block w-full cursor-pointer rounded-full bg-black px-8 py-2 text-xs font-bold text-white">
                  Importar arquivo…
                  <input type="file" accept=".srt,.vtt" className="hidden" />
                </label>
              </div>
            )}
            {textMode === "Gráficos" && (
              <div className="text-[11px] text-slate-500">
                A pesquisa de texto dos gráficos aparecerá aqui quando a
                sequência contiver títulos.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyGroup({ title, reset, children }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-[#333] py-1">
      <div className="flex items-center py-1 text-[11px] font-bold">
        <button onClick={() => setOpen(!open)} className="mr-2">
          {open ? "⌄" : "›"}
        </button>
        {title}
        {reset && (
          <button onClick={reset} className="ml-auto text-slate-400">
            ↻
          </button>
        )}
      </div>
      {open && children}
    </section>
  );
}

function PropertyNumber({ label, value, diamond }) {
  return (
    <div className="grid grid-cols-[1fr_120px_18px] items-center gap-2 px-3 py-2 text-[11px]">
      <span className="text-slate-400">{label}</span>
      <span className="whitespace-pre text-blue-400">{value}</span>
      <span className="text-slate-400">{diamond ? "◇" : ""}</span>
    </div>
  );
}

function LumetriSection({ title, open = false, enabled = true, children }) {
  const [expanded, setExpanded] = useState(open);
  const [active, setActive] = useState(enabled);
  return (
    <section className="border-b border-[#333] py-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((value) => !value)}
          className="text-slate-400"
        >
          {expanded ? "⌄" : "›"}
        </button>
        <button
          onClick={() => setExpanded((value) => !value)}
          className="font-semibold text-slate-300"
        >
          {title}
        </button>
        <button
          onClick={() => setActive((value) => !value)}
          className={`ml-auto h-4 w-8 rounded-full p-0.5 ${active ? "bg-blue-600" : "bg-slate-600"}`}
        >
          <span
            className={`block h-3 w-3 rounded-full bg-white transition-transform ${active ? "translate-x-4" : ""}`}
          />
        </button>
      </div>
      {expanded && (
        <div className={`space-y-2 px-2 pt-3 ${active ? "" : "opacity-40"}`}>
          {children || (
            <div className="h-16 bg-gradient-to-r from-blue-950 via-slate-900 to-amber-950" />
          )}
        </div>
      )}
    </section>
  );
}

function PanelTabs({ labels }) {
  const [active, setActive] = useState(labels[0]);
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1">
      {labels.map((label) => (
        <button
          key={label}
          onClick={() => setActive(label)}
          className={`rounded border px-1 py-1.5 ${active === label ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-slate-800 text-slate-500"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Range({ label, value, min = 0, max = 100, onChange, disabled }) {
  return (
    <label className="block text-slate-400">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="text-slate-200">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(+event.target.value)}
        className="mt-1 w-full accent-cyan-400 disabled:opacity-30"
      />
    </label>
  );
}

function PanelStack({ rows }) {
  const [active, setActive] = useState(null);
  return (
    <div className="space-y-1">
      {rows.map(([label, value]) => (
        <button
          key={label}
          onClick={() => setActive(label)}
          className={`flex w-full justify-between rounded border px-2 py-2 text-left hover:border-cyan-800 ${active === label ? "border-cyan-700 bg-cyan-500/10 text-cyan-300" : "border-slate-800 text-slate-500"}`}
        >
          <span>{label}</span>
          <span className="text-slate-200">{value} ▾</span>
        </button>
      ))}
    </div>
  );
}
