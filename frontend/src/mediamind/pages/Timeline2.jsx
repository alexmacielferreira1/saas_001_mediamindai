import { useWorkDraftState, useWorkStorageKey } from "../lib/workProtection";
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, BookmarkPlus, Captions, ChevronLeft, ChevronRight, Copy, Crop, Download, Eye, EyeOff,
  Diamond, FolderOpen, Lock, Magnet, MousePointer2, Music, Pause, Play, Plus, Redo2, Save,
  Scissors, SlidersHorizontal, Sparkles, Trash2, Type, Undo2, Unlock, Upload, Volume2,
  VolumeX, Wand2, ZoomIn, Keyboard, Maximize2, ClipboardPaste, Info, ChevronUp, ChevronDown, StepBack, StepForward,
  Layers, PictureInPicture2, Blend,
} from 'lucide-react';
import { exportMediaClip, exportTimeline, listMediaAssets, mediaStreamUrl, uploadMediaAsset } from '../../api/media';
import { useTimeline2Project } from '../hooks/useTimeline2Project';
import {
  addMarker, addMediaClip, addPropertyKeyframe, addTextClip, addTrack, createTimeline2Document, deleteClips, duplicateClip, moveClip, removePropertyKeyframe, removeTrack, rippleDelete,
  clearTimelineRange, separateClipAudio, setPlayhead, setTimelineIn, setTimelineOut, setZoom, splitClip, toggleSnapping, toggleTrackState, trimClip,
  getActiveClips, getClipPropertiesAtTime, getTimelineDisplayTracks, getTimelineGeometry, pointerToTimelineTime, updateClipProperties, updateKeyframeCurve,
  addClipOnFreeTrack, copyClips, duplicateClips, extractRange, formatTimecode, getClipFilterCss, getClipsInRegion, getPlacementError, getPreviousAdjacentClip, getTimelineSpan,
  getZoomToFit, moveClipsBy, moveTrack, pasteClips, pastedClipId, renameTrack, setClipSpeed, setClipTransition, setFrameRate, splitClipsAtTime, stepFrames,
  toggleRippleEditing, TIMELINE2_FRAME_RATES, TIMELINE2_TRANSITIONS,
} from '../lib/timeline2Model';
import { CAPTION_PRESETS, captionPresetToProperties, getCaptionPreset } from '../lib/captionPresets';
import { TIMELINE2_FILTER_PRESETS, TIMELINE2_STICKERS, TIMELINE2_TEXT_PRESETS, getPipPlacement } from '../lib/timeline2Presets';
import { describeTimelineExport } from '../lib/timeline2Export';
import UploadReceiptPanel from '../components/UploadReceiptPanel';
import Timeline2ShortcutsPanel from '../components/timeline2/Timeline2ShortcutsPanel';
import Timeline2ExportInfo from '../components/timeline2/Timeline2ExportInfo';
import Timeline2Waveform from '../components/timeline2/Timeline2Waveform';

const INITIAL_DOCUMENT = createTimeline2Document({ id: 'timeline2-local', name: 'Novo projeto MediaMind' });
const TRACK_HEADER_WIDTH = 160;
let clipSequence = 0;
const newClipId = (prefix) => `${prefix}-${Date.now()}-${(clipSequence += 1)}`;
const isModifierClick = (event) => Boolean(event?.shiftKey || event?.ctrlKey || event?.metaKey);
const dbToGain = (volume, fade = 1) => Math.max(0, Math.min(1, (10 ** ((Number(volume) || 0) / 20)) * (Number.isFinite(fade) ? fade : 1)));

const trackColor = { video: 'bg-sky-600/80', audio: 'bg-emerald-600/80', text: 'bg-violet-600/80' };

const assetToMedia = (asset) => ({
  id: asset.id,
  assetId: asset.id,
  name: asset.title || asset.filename,
  filename: asset.filename,
  kind: asset.asset_type,
  duration: Number(asset.duration) || 30,
  src: mediaStreamUrl(asset),
  mimeType: asset.mime_type,
  size: asset.file_size,
  origin: 'acervo',
});

export default function Timeline2({ embedded = false, projectAssets = [], editingProjectId = null }) {
  const storagePrefix = useWorkStorageKey("");
  const initial = useMemo(() => {
    if (editingProjectId) return { ...INITIAL_DOCUMENT, id: `editing-${editingProjectId}`, tracks: INITIAL_DOCUMENT.tracks.map(track => ({ ...track, clips: [] })) };
    try {
      const workspaceDraft = JSON.parse(localStorage.getItem(storagePrefix + 'mm_workspace2_timeline2_draft'));
      return workspaceDraft?.tracks ? workspaceDraft : INITIAL_DOCUMENT;
    } catch { return INITIAL_DOCUMENT; }
  }, [storagePrefix, editingProjectId]);
  const { document, commit, updateTransient, beginGesture, finishGesture, undo, redo, canUndo, canRedo } = useTimeline2Project(initial, `mm_timeline2_project:${initial.id}`);
  const formatTime = (seconds) => formatTimecode(seconds, document.fps);
  const [selection, setSelection] = useState([]);
  const selectedClipId = selection.at(-1) ?? null;
  const setSelectedClipId = (clipId) => setSelection(clipId ? [clipId] : []);
  const [clipboard, setClipboard] = useState([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExportInfo, setShowExportInfo] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [renamingTrackId, setRenamingTrackId] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const marqueeRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const previewRef = useRef(null);
  const rootRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [libraryTab, setLibraryTab] = useState('project');
  const [activePanel, setActivePanel] = useState('media');
  const [activeTool, setActiveTool] = useState('select');
  const [textValue, setTextValue] = useWorkDraftState("pages/Timeline2.jsx:textValue", '');
  const [captionPresetId, setCaptionPresetId] = useState(CAPTION_PRESETS[0].id);
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [autoKeyframe, setAutoKeyframe] = useState(false);
  const [notice, setNotice] = useState('Importe um arquivo ou adicione uma mídia do acervo.');
  const [uploadReceipts, setUploadReceipts] = useState([]);
  const fileInputRef = useRef(null);
  const mediaRefs = useRef(new Map());
  const pointerGestureRef = useRef(null);
  const timelineRulerRef = useRef(null);
  const playheadGestureRef = useRef(null);
  const playbackClockRef = useRef(null);
  const allClips = document.tracks.flatMap((track) => track.clips || []);
  const selected = allClips.find((clip) => clip.id === selectedClipId);
  const selectedIds = selection.filter((clipId) => allClips.some((clip) => clip.id === clipId));
  const selectedTrack = selected ? document.tracks.find((track) => track.clips.some((clip) => clip.id === selected.id)) : null;
  const previousAdjacent = selected ? getPreviousAdjacentClip(document, selected.id) : null;
  const selectedProperties = { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, speed: 1, ...(selected ? getClipPropertiesAtTime(selected, document.playhead) : {}) };
  const activeClips = useMemo(() => getActiveClips(document, document.playhead), [document]);
  const activeVisuals = activeClips.filter((clip) => clip.kind === 'text' || (clip.kind === 'video' && clip.src));
  const activeAudio = activeClips.filter((clip) => clip.kind === 'audio' && clip.src);
  const scaleDuration = getTimelineSpan(Math.max(document.duration, 30), document.zoom);
  const timelineGeometry = useMemo(() => getTimelineGeometry(scaleDuration, document.zoom), [scaleDuration, document.zoom]);
  const exportSummary = useMemo(() => describeTimelineExport(document), [document]);
  const displayTracks = useMemo(() => getTimelineDisplayTracks(document), [document]);
  const projectMedia = useMemo(() => {
    const clips = document.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind !== 'text');
    const selectedProjectMedia = projectAssets.filter((asset) => ['video', 'audio'].includes(asset.asset_type)).map(assetToMedia);
    return [...selectedProjectMedia, ...clips.map((clip) => ({ id: clip.assetId || clip.id, name: clip.name, kind: clip.kind, duration: clip.sourceOut || clip.duration, src: clip.src, origin: clip.origin }))]
      .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id && candidate.src === item.src) === index);
  }, [document.tracks, projectAssets]);
  const acervoMedia = useMemo(
    () => assets.filter((asset) => ['video', 'audio'].includes(asset.asset_type)).map(assetToMedia),
    [assets],
  );
  const hasTimedSequence = useMemo(
    () => document.tracks.some((track) => track.clips.some((clip) => ['video', 'audio'].includes(clip.kind) && Number(clip.duration) > 0)),
    [document.tracks],
  );

  const applySplit = () => {
    if (selectedIds.length > 1) { commit((current) => splitClipsAtTime(current, selectedIds, current.playhead)); setNotice(`${selectedIds.length} clipes divididos no playhead.`); return; }
    if (selected) commit((current) => splitClip(current, selected.id, current.playhead));
  };
  const splitUnderPlayhead = () => {
    commit((current) => splitClipsAtTime(current, [], current.playhead));
    setNotice('Clipes sob a agulha divididos nas trilhas destravadas.');
  };
  const removeSelected = () => {
    if (!selectedIds.length) return;
    const ids = selectedIds;
    commit((current) => (current.rippleEnabled ? rippleDelete(current, ids, { includeLinked: true }) : deleteClips(current, ids)));
    setSelection([]);
    setNotice(document.rippleEnabled ? `${ids.length} clipe(s) excluído(s) com ripple; trilhas travadas não foram alteradas.` : `${ids.length} clipe(s) excluído(s).`);
  };
  const rippleRemoveSelected = () => {
    if (!selectedIds.length) return;
    const ids = selectedIds;
    commit((current) => rippleDelete(current, ids, { includeLinked: true }));
    setSelection([]);
    setNotice('Excluído com ripple: a lacuna foi fechada (áudio separado acompanha o vídeo; trilhas travadas ficam intactas).');
  };
  const copySelection = () => {
    if (!selectedIds.length) return;
    setClipboard(copyClips(document, selectedIds));
    setNotice(`${selectedIds.length} clipe(s) copiado(s). Use Colar para inserir no playhead.`);
  };
  const pasteClipboard = () => {
    if (!clipboard.length) return;
    const token = Date.now();
    const next = pasteClips(document, clipboard, document.playhead, { token });
    if (next === document) { setNotice('Nenhuma trilha compatível e destravada para colar.'); return; }
    commit(next);
    setSelection(clipboard.map((item) => pastedClipId(item.clip.id, token)).filter((clipId) => next.tracks.some((track) => track.clips.some((clip) => clip.id === clipId))));
    setNotice(`${clipboard.length} clipe(s) colado(s) em ${formatTime(document.playhead)}.`);
  };
  const duplicateSelection = () => {
    if (selectedIds.length <= 1) { if (selected) commit((current) => duplicateClip(current, selected.id)); return; }
    const token = Date.now();
    const next = duplicateClips(document, selectedIds, { token });
    if (next === document) return;
    commit(next);
    setSelection(selectedIds.map((clipId) => pastedClipId(clipId, token)).filter((clipId) => next.tracks.some((track) => track.clips.some((clip) => clip.id === clipId))));
    setNotice(`${selectedIds.length} clipes duplicados após a seleção.`);
  };
  const extractInOut = () => {
    if (document.inPoint == null || document.outPoint == null || document.outPoint <= document.inPoint) return;
    const label = `${formatTime(document.inPoint)} → ${formatTime(document.outPoint)}`;
    commit((current) => extractRange(current, current.inPoint, current.outPoint));
    setSelection([]);
    setNotice(`Intervalo ${label} extraído das trilhas destravadas; o restante foi aproximado.`);
  };
  const zoomToFit = () => {
    const viewport = (timelineScrollRef.current?.clientWidth || 1200) - TRACK_HEADER_WIDTH - 24;
    commit((current) => setZoom(current, getZoomToFit(Math.max(current.duration, 1), viewport)));
  };
  const toggleSelection = (clipId) => setSelection((current) => (current.includes(clipId) ? current.filter((item) => item !== clipId) : [...current, clipId]));
  const changeTrim = (edge, value) => selected && commit((current) => trimClip(current, selected.id, { edge, time: Number(value) }));
  const addToTimeline = (media, trackId, start = document.playhead) => {
    const kind = media.kind === 'audio' ? 'audio' : media.kind === 'text' ? 'text' : 'video';
    const targetTrack = trackId || (kind === 'audio' ? 'a1' : kind === 'text' ? 't1' : 'v1');
    const placementError = getPlacementError(document, kind, targetTrack);
    if (placementError) { setNotice(placementError); return; }
    const clipId = newClipId(`clip-${media.id}`);
    commit((current) => addMediaClip(current, { ...media, clipId }, { trackId, start }));
    setSelectedClipId(clipId);
    setNotice(`${media.name} adicionado à timeline em ${formatTime(start)}.`);
  };
  const importFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    const accepted = files.filter((file) => file.type.startsWith('video/') || file.type.startsWith('audio/'));
    if (!accepted.length) {
      setNotice('Selecione arquivos de vídeo ou áudio.');
      event.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const uploaded = await Promise.all(accepted.map((file) => uploadMediaAsset(file)));
      setUploadReceipts(uploaded);
      setAssets((current) => [...uploaded, ...current.filter((item) => !uploaded.some((next) => next.id === item.id))]);
      const imported = uploaded.map(assetToMedia);
      if (imported[0]) addToTimeline(imported[0]);
      setLibraryTab('project');
      setNotice(`${imported.length} arquivo(s) enviado(s) ao Acervo; o primeiro foi colocado na timeline.`);
    } catch (error) {
      setNotice(error?.message || 'Não foi possível enviar a mídia ao Acervo.');
    } finally {
      setUploading(false);
    }
    event.target.value = '';
  };
  const togglePlayback = async () => {
    const players = activeClips
      .map((clip) => ({ clip, player: mediaRefs.current.get(clip.id) }))
      .filter((item) => item.player);
    if (!hasTimedSequence) {
      setNotice('Importe um vídeo ou áudio para criar uma sequência com duração.');
      return;
    }
    if (playing) {
      mediaRefs.current.forEach((player) => player.pause());
      playbackClockRef.current = null;
      setPlaying(false);
      return;
    }
    const rangeStart = document.inPoint ?? 0;
    const rangeEnd = document.outPoint ?? document.duration;
    const startTime = document.playhead < rangeStart || document.playhead >= rangeEnd ? rangeStart : document.playhead;
    if (startTime !== document.playhead) updateTransient((current) => setPlayhead(current, startTime));
    playbackClockRef.current = { timelineTime: startTime, wallTime: Date.now() };
    setPlaying(true);
    await Promise.allSettled(players.map(async ({ clip, player }) => {
      player.currentTime = Math.max(0, clip.sourceTime);
      player.playbackRate = Math.max(0.25, Math.min(4, Number(clip.properties?.speed) || 1));
      player.volume = dbToGain(clip.properties?.volume, clip.fade);
      await player.play();
    }));
  };
  const setProperty = (field, value) => selected && commit((current) => {
    if (field === 'speed') return setClipSpeed(current, selected.id, Number(value));
    if (['fadeIn', 'fadeOut'].includes(field) || !autoKeyframe) return updateClipProperties(current, selected.id, { [field]: Number(value) });
    return addPropertyKeyframe(current, selected.id, field, { value: Number(value) });
  });
  const applyPresetToSelected = (properties, label) => {
    if (!selected) return;
    commit((current) => ('speed' in properties ? setClipSpeed(updateClipProperties(current, selected.id, Object.fromEntries(Object.entries(properties).filter(([key]) => key !== 'speed'))), selected.id, properties.speed) : updateClipProperties(current, selected.id, properties)));
    setNotice(`${label} aplicado a ${selected.name}.`);
  };
  const changeTransition = (type, duration) => {
    if (!selected) return;
    commit((current) => setClipTransition(current, selected.id, type ? { type, duration } : null));
    setNotice(type ? `Transição ${TIMELINE2_TRANSITIONS.find((item) => item.id === type)?.label} aplicada na entrada de ${selected.name}.` : 'Transição removida.');
  };
  const placeAsPip = (corner) => {
    if (!selected || selected.kind !== 'video') return;
    const node = mediaRefs.current.get(selected.id);
    const width = node?.offsetWidth || previewRef.current?.clientWidth || 640;
    const height = node?.offsetHeight || previewRef.current?.clientHeight || 360;
    commit((current) => updateClipProperties(current, selected.id, getPipPlacement(corner, width, height)));
    setNotice(`${selected.name} posicionado como picture-in-picture. Coloque-o numa trilha de vídeo acima da principal.`);
  };
  const addTextPreset = (text, properties, label, duration = 5) => {
    const value = String(text || '').trim();
    if (!value) return;
    const clipId = newClipId('text');
    const next = addClipOnFreeTrack(document, { id: clipId, clipId, name: value, kind: 'text', duration, origin: 'editor', properties: { text: value, fontSize: 54, ...properties } }, document.playhead);
    const placed = next.tracks.find((track) => track.clips.some((clip) => clip.id === clipId));
    if (!placed) { setNotice('Não foi possível adicionar: as trilhas de texto estão travadas.'); return; }
    commit(next);
    setSelectedClipId(clipId);
    setNotice(`${label} adicionado no playhead em ${placed.name}.`);
  };
  const keyframeAtPlayhead = (field) => {
    if (!selected) return null;
    const localTime = document.playhead - selected.start;
    return (selected.keyframes?.[field] || []).find((item) => Math.abs(item.time - localTime) <= (0.5 / document.fps));
  };
  const toggleKeyframe = (field) => selected && commit((current) => (keyframeAtPlayhead(field)
    ? removePropertyKeyframe(current, selected.id, field)
    : addPropertyKeyframe(current, selected.id, field, { value: selectedProperties[field] })));
  const setKeyframeCurve = (field, easing) => selected && commit((current) => {
    const withKeyframe = keyframeAtPlayhead(field) ? current : addPropertyKeyframe(current, selected.id, field, { value: selectedProperties[field] });
    return updateKeyframeCurve(withKeyframe, selected.id, field, current.playhead, { easing });
  });
  const downloadExport = ({ blob, filename }) => {
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
    setNotice(`Exportação concluída: ${filename}`);
  };
  const exportSelected = async () => {
    if (!selected?.assetId || selected.kind !== 'video') return;
    setExporting(true);
    setNotice('Renderizando o clipe selecionado…');
    try {
      downloadExport(await exportMediaClip({ asset_id: selected.assetId, source_in: selected.sourceIn, duration: selected.duration, properties: selectedProperties }));
    } catch (error) { setNotice(error?.message || 'Não foi possível exportar o clipe.'); }
    finally { setExporting(false); }
  };
  const exportSequence = async () => {
    setExporting(true); setNotice('Renderizando a sequência da trilha principal…');
    try { downloadExport(await exportTimeline({ name: document.name, tracks: document.tracks, in_point: document.inPoint, out_point: document.outPoint })); }
    catch (error) { setNotice(error?.message || 'Não foi possível exportar a sequência.'); }
    finally { setExporting(false); }
  };
  const addText = (caption = false) => {
    if (!textValue.trim()) return;
    const clipId = newClipId('text');
    const properties = caption
      ? captionPresetToProperties(getCaptionPreset(captionPresetId), textValue)
      : { text: textValue, caption: false, fontSize: 54, y: 0 };
    commit((current) => addTextClip(current, textValue, { clipId, properties }));
    setTextValue(''); setActivePanel(caption ? 'captions' : 'text'); setNotice(`${caption ? 'Legenda' : 'Texto'} adicionado no playhead.`);
  };
  const applyCaptionPresetToSelected = () => {
    if (!selected || selected.kind !== 'text') return;
    const properties = captionPresetToProperties(getCaptionPreset(captionPresetId), selected.properties?.text || selected.name);
    commit((current) => updateClipProperties(current, selected.id, properties));
    setNotice(`Estilo ${getCaptionPreset(captionPresetId).name} aplicado à legenda selecionada.`);
  };
  useEffect(() => {
    let active = true;
    listMediaAssets()
      .then((items) => { if (active) setAssets(items); })
      .catch((error) => { if (active) setNotice(error?.message || 'Não foi possível carregar o Acervo.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (playing) return;
    activeClips.forEach((clip) => {
      const player = mediaRefs.current.get(clip.id);
      if (player && Number.isFinite(clip.sourceTime) && Math.abs(player.currentTime - clip.sourceTime) > 0.08) player.currentTime = clip.sourceTime;
    });
  }, [activeClips, playing]);
  useEffect(() => {
    if (!playing || !playbackClockRef.current) return undefined;
    const timer = window.setInterval(() => {
      const clock = playbackClockRef.current;
      if (!clock) return;
      const playbackEnd = document.outPoint ?? document.duration;
      const next = Math.min(playbackEnd, clock.timelineTime + ((Date.now() - clock.wallTime) / 1000));
      updateTransient((current) => setPlayhead(current, next));
      if (next >= playbackEnd) {
        mediaRefs.current.forEach((player) => player.pause());
        playbackClockRef.current = null;
        setPlaying(false);
      }
    }, 33);
    return () => window.clearInterval(timer);
  }, [document.duration, document.outPoint, playing, updateTransient]);
  useEffect(() => {
    if (!playing) return;
    activeClips.forEach((clip) => {
      const player = mediaRefs.current.get(clip.id);
      if (!player || !clip.src) return;
      if (Number.isFinite(clip.sourceTime) && Math.abs(player.currentTime - clip.sourceTime) > 0.12) player.currentTime = clip.sourceTime;
      player.playbackRate = Math.max(0.25, Math.min(4, Number(clip.properties?.speed) || 1));
      player.volume = dbToGain(clip.properties?.volume, clip.fade);
      player.play().catch(() => {});
    });
  }, [activeClips, playing]);
  useEffect(() => {
    const onKeyDown = (event) => {
      const editingField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) && event.target?.type !== 'range';
      if (editingField || rootRef.current?.closest?.('[hidden]')) return;
      const key = String(event.key || '').toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (command && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (command && key === 'y') { event.preventDefault(); redo(); }
      else if (command && key === 'c') { if (selectedIds.length) { event.preventDefault(); copySelection(); } }
      else if (command && key === 'v') { if (clipboard.length) { event.preventDefault(); pasteClipboard(); } }
      else if (command && key === 'd') { if (selectedIds.length) { event.preventDefault(); duplicateSelection(); } }
      else if (command && key === 'a') { if (allClips.length) { event.preventDefault(); setSelection(allClips.map((clip) => clip.id)); } }
      else if (command) return;
      else if (event.key === 'Escape') { setSelection([]); setShowShortcuts(false); }
      else if (event.key === '?') { event.preventDefault(); setShowShortcuts((current) => !current); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
      else if (key === 's') { event.preventDefault(); if (selectedIds.length) applySplit(); else splitUnderPlayhead(); }
      else if (key === 'q') { event.preventDefault(); if (selected) commit((current) => trimClip(current, selected.id, { edge: 'start', time: current.playhead })); }
      else if (key === 'w') { event.preventDefault(); if (selected) commit((current) => trimClip(current, selected.id, { edge: 'end', time: current.playhead })); }
      else if (key === 'n') { event.preventDefault(); commit(toggleSnapping); }
      else if (key === 'm') { event.preventDefault(); commit((current) => addMarker(current, { label: `Marcador ${current.markers.length + 1}` })); }
      else if (key === 'z' && event.shiftKey) { event.preventDefault(); zoomToFit(); }
      else if (event.key.toLowerCase() === 'i') { event.preventDefault(); commit((current) => setTimelineIn(current)); }
      else if (event.key.toLowerCase() === 'o') { event.preventDefault(); commit((current) => setTimelineOut(current)); }
      else if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
      else if (event.key.toLowerCase() === 'k') { event.preventDefault(); mediaRefs.current.forEach((player) => player.pause()); playbackClockRef.current = null; setPlaying(false); }
      else if (event.key.toLowerCase() === 'l') { event.preventDefault(); if (!playing) togglePlayback(); }
      else if (event.key.toLowerCase() === 'j') { event.preventDefault(); mediaRefs.current.forEach((player) => player.pause()); playbackClockRef.current = null; setPlaying(false); updateTransient((current) => stepFrames(current, -1)); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const direction = event.key === 'ArrowLeft' ? -1 : 1; updateTransient((current) => (event.shiftKey ? setPlayhead(current, current.playhead + direction) : stepFrames(current, direction))); }
      else if (event.key === 'Home') { event.preventDefault(); updateTransient((current) => setPlayhead(current, 0)); }
      else if (event.key === 'End') { event.preventDefault(); updateTransient((current) => setPlayhead(current, current.duration)); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const dropOnTrack = (event, track) => {
    event.preventDefault();
    const clipId = event.dataTransfer.getData('application/x-timeline2-clip');
    if (clipId) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const time = pointerToTimelineTime(event.clientX, bounds, scaleDuration);
      commit((current) => moveClip(current, clipId, { start: time, trackId: track.id }));
      setSelectedClipId(clipId); setNotice(`Clipe movido para ${track.name} em ${formatTime(time)}.`); return;
    }
    try {
      const media = JSON.parse(event.dataTransfer.getData('application/x-timeline2-media'));
      const bounds = event.currentTarget.getBoundingClientRect();
      const time = pointerToTimelineTime(event.clientX, bounds, scaleDuration);
      addToTimeline(media, track.id, time);
    } catch { setNotice('Não foi possível adicionar essa mídia.'); }
  };
  const movePlayheadFromPointer = (event) => {
    const element = event.currentTarget;
    if (!element?.getBoundingClientRect) return;
    const bounds = element.getBoundingClientRect();
    const pointerTime = pointerToTimelineTime(event.clientX, bounds, scaleDuration);
    updateTransient((current) => setPlayhead(current, pointerTime));
  };
  const updatePlayheadGesture = (event) => {
    const gesture = playheadGestureRef.current;
    if (!gesture) return;
    event.preventDefault(); event.stopPropagation();
    const pointerTime = pointerToTimelineTime(event.clientX, gesture.bounds, gesture.duration);
    updateTransient((current) => setPlayhead(current, pointerTime));
  };
  const startPlayheadGesture = (event) => {
    const ruler = timelineRulerRef.current;
    if (!ruler?.getBoundingClientRect) return;
    event.preventDefault(); event.stopPropagation();
    const bounds = ruler.getBoundingClientRect();
    playheadGestureRef.current = { bounds: { left: bounds.left, width: bounds.width }, duration: scaleDuration };
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* gesture remains usable without capture */ }
    updatePlayheadGesture(event);
  };
  const endPlayheadGesture = (event) => {
    if (!playheadGestureRef.current) return;
    updatePlayheadGesture(event);
    playheadGestureRef.current = null;
  };
  const startClipGesture = (event, clip, mode = 'move') => {
    if (activeTool !== 'select') return;
    if (isModifierClick(event)) { event.stopPropagation(); return; }
    const canvas = event.currentTarget.closest('[data-track-canvas]');
    if (!canvas) return;
    event.preventDefault(); event.stopPropagation();
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* gesture remains usable without capture */ }
    const canvasBounds = canvas.getBoundingClientRect();
    const pointerTime = pointerToTimelineTime(event.clientX, canvasBounds, scaleDuration);
    const group = mode === 'move' && selectedIds.length > 1 && selectedIds.includes(clip.id) ? selectedIds : null;
    pointerGestureRef.current = {
      clipId: clip.id,
      bounds: { left: canvasBounds.left, width: canvasBounds.width },
      duration: scaleDuration,
      mode,
      offset: pointerTime - clip.start,
      group,
      origin: group ? document : null,
      originStart: clip.start,
    };
    if (!group) setSelectedClipId(clip.id);
    beginGesture();
  };
  const updateClipGesture = (event) => {
    const gesture = pointerGestureRef.current;
    if (!gesture) return;
    const pointerTime = pointerToTimelineTime(event.clientX, gesture.bounds, gesture.duration);
    if (gesture.group) {
      const delta = (pointerTime - gesture.offset) - gesture.originStart;
      if (Math.abs(delta) > 1e-6) gesture.moved = true;
      updateTransient(() => moveClipsBy(gesture.origin, gesture.group, delta));
    } else if (gesture.mode === 'move') {
      const hoveredTrack = globalThis.document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.('[data-track-id]');
      updateTransient((current) => moveClip(current, gesture.clipId, { start: pointerTime - gesture.offset, trackId: hoveredTrack?.dataset.trackId }));
    } else updateTransient((current) => trimClip(current, gesture.clipId, { edge: gesture.mode, time: pointerTime }));
  };
  const endClipGesture = () => {
    if (!pointerGestureRef.current) return;
    suppressClickRef.current = Boolean(pointerGestureRef.current.group && pointerGestureRef.current.moved);
    pointerGestureRef.current = null;
    finishGesture();
    setNotice('Edição aplicada. Desfazer restaura o gesto inteiro.');
  };
  const trackIdAtPoint = (event) => globalThis.document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.('[data-track-id]')?.dataset.trackId;
  const startMarquee = (event, track) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const time = pointerToTimelineTime(event.clientX, bounds, scaleDuration);
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* marquee works without capture */ }
    marqueeRef.current = { bounds: { left: bounds.left, width: bounds.width }, startTime: time, startTrackId: track.id, additive: event.ctrlKey || event.metaKey };
    setMarquee({ startTime: time, endTime: time, trackIds: [track.id] });
  };
  const marqueeTrackIds = (fromId, toId) => {
    const display = getTimelineDisplayTracks(document).map((track) => track.id);
    const first = display.indexOf(fromId);
    const last = display.indexOf(toId ?? fromId);
    if (first < 0) return [];
    if (last < 0) return [fromId];
    return display.slice(Math.min(first, last), Math.max(first, last) + 1);
  };
  const updateMarquee = (event) => {
    const gesture = marqueeRef.current;
    if (!gesture) return false;
    const time = pointerToTimelineTime(event.clientX, gesture.bounds, scaleDuration);
    const next = { startTime: gesture.startTime, endTime: time, trackIds: marqueeTrackIds(gesture.startTrackId, trackIdAtPoint(event)) };
    setMarquee(next);
    return next;
  };
  const endMarquee = (event) => {
    const gesture = marqueeRef.current;
    if (!gesture) return;
    const region = updateMarquee(event) || marquee;
    marqueeRef.current = null;
    setMarquee(null);
    const ids = getClipsInRegion(document, { start: region.startTime, end: region.endTime, trackIds: region.trackIds });
    setSelection((current) => (gesture.additive ? [...new Set([...current, ...ids])] : ids));
    setNotice(ids.length ? `${ids.length} clipe(s) selecionado(s) por área.` : 'Nenhum clipe na área selecionada.');
  };
  const commitTrackName = (track, value) => {
    setRenamingTrackId(null);
    commit((current) => renameTrack(current, track.id, value));
  };
  const moduleItems = [
    ['media', FolderOpen, 'Arquivos'], ['audio', Music, 'Áudio'], ['text', Type, 'Texto'],
    ['elements', Sparkles, 'Elementos'], ['effects', Wand2, 'Efeitos'], ['captions', Captions, 'Legendas'],
    ['adjust', SlidersHorizontal, 'Ajustes'],
  ];

  return (
    <div ref={rootRef} className={`${embedded ? 'min-h-[760px]' : '-m-4 min-h-[calc(100vh-4rem)]'} flex flex-col bg-mm-page p-4 text-slate-100`}>
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">Editor não destrutivo · mídia local e acervo</p>
          <h1 className="text-2xl font-bold">Timeline 2</h1>
          <p className="text-xs text-slate-400">{document.name} · {formatTime(document.duration)} · {document.fps} fps</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label="Desfazer" className="w2-button disabled:opacity-40"><Undo2 size={14} /> Desfazer</button>
          <button type="button" onClick={redo} disabled={!canRedo} aria-label="Refazer" className="w2-button disabled:opacity-40"><Redo2 size={14} /> Refazer</button>
          <button type="button" onClick={() => localStorage.setItem(storagePrefix + 'mm_timeline2_project', JSON.stringify(document))} className="w2-button"><Save size={14} /> Salvar projeto</button>
          <button type="button" onClick={exportSelected} disabled={exporting || selected?.kind !== 'video' || !selected?.assetId} title="Renderiza os cortes do clipe selecionado em MP4" className="w2-button border-emerald-600 text-emerald-300 disabled:opacity-40"><Download size={14} /> {exporting ? 'Renderizando…' : 'Exportar clipe'}</button>
          <button type="button" onClick={exportSequence} disabled={exporting || !document.tracks.find((track) => track.id === 'v1')?.clips.some((clip) => clip.assetId)} title={`Renderiza os cortes da trilha principal (${exportSummary.mainTrack?.id || 'v1'}) em um MP4. Outras trilhas, textos e efeitos ficam só no preview.`} className="w2-button border-violet-600 text-violet-300 disabled:opacity-40"><Download size={14} /> Exportar sequência</button>
          <button type="button" onClick={() => setShowExportInfo((current) => !current)} aria-pressed={showExportInfo} aria-label="O que entra no MP4" title="Mostra o que a exportação da sequência inclui hoje" className="w2-button"><Info size={14} /> O que entra no MP4</button>
          <label className="w2-button cursor-pointer" title="Taxa de quadros usada no timecode, nos cortes e na navegação quadro a quadro"><span className="text-slate-500">FPS</span><select aria-label="Taxa de quadros do projeto" value={document.fps} onChange={(event) => commit((current) => setFrameRate(current, event.target.value))} className="bg-transparent text-slate-200 outline-none">{(TIMELINE2_FRAME_RATES.includes(Number(document.fps)) ? TIMELINE2_FRAME_RATES : [Number(document.fps), ...TIMELINE2_FRAME_RATES]).map((rate) => <option key={rate} value={rate} className="bg-slate-900">{String(rate).replace('.', ',')}</option>)}</select></label>
          <button type="button" onClick={() => setShowShortcuts((current) => !current)} aria-pressed={showShortcuts} aria-label="Atalhos de teclado" title="Atalhos de teclado (?)" className="w2-button"><Keyboard size={14} /></button>
        </div>
      </header>
      {showShortcuts && <div className="relative"><Timeline2ShortcutsPanel onClose={() => setShowShortcuts(false)} /></div>}
      {showExportInfo && <Timeline2ExportInfo document={document} onClose={() => setShowExportInfo(false)} />}

      <UploadReceiptPanel assets={uploadReceipts} />

      <div className={`grid flex-1 ${editingProjectId ? 'grid-cols-[150px_minmax(0,1fr)_180px] grid-rows-[minmax(260px,34vh)_1fr]' : 'grid-cols-[260px_minmax(500px,1fr)_280px] grid-rows-[minmax(300px,42vh)_1fr]'} gap-2 overflow-hidden`}>
        <aside className="w2-panel grid min-h-0 grid-cols-[48px_1fr] overflow-hidden">
          <nav aria-label="Módulos do editor" className="flex flex-col items-center gap-1 border-r border-slate-800 bg-slate-950/80 py-2">
            {moduleItems.map(([id, Icon, label]) => <button key={id} type="button" onClick={() => setActivePanel(id)} aria-label={label} title={label} className={`grid size-10 place-items-center rounded-lg ${activePanel === id ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon size={18} /></button>)}
          </nav>
          <div className="flex min-w-0 flex-col p-3">
            {(activePanel === 'media' || activePanel === 'audio') && <>
              <div className="flex items-center justify-between"><h2 className="text-xs font-bold uppercase text-slate-400">{activePanel === 'audio' ? 'Áudio' : 'Arquivos'}</h2><button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="w2-button disabled:opacity-50"><Upload size={13} /> {uploading ? 'Enviando…' : 'Importar'}</button></div>
              <input ref={fileInputRef} aria-label="Importar vídeos e áudios" type="file" multiple accept="video/*,audio/*" onChange={importFiles} className="hidden" />
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-950 p-1"><button type="button" onClick={() => setLibraryTab('project')} className={`rounded px-2 py-2 text-xs ${libraryTab === 'project' ? 'bg-sky-600 font-bold' : 'text-slate-400'}`}>Projeto</button><button type="button" onClick={() => setLibraryTab('acervo')} className={`rounded px-2 py-2 text-xs ${libraryTab === 'acervo' ? 'bg-sky-600 font-bold' : 'text-slate-400'}`}><Archive size={12} className="mr-1 inline" /> Acervo</button></div>
              <input aria-label="Pesquisar na biblioteca" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Pesquisar mídias..." className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
              <div className="mt-3 min-h-0 space-y-2 overflow-y-auto">
                {(libraryTab === 'acervo' ? acervoMedia : projectMedia).filter((media) => activePanel !== 'audio' || media.kind === 'audio').filter((media) => !librarySearch.trim() || `${media.name || ''} ${media.filename || ''}`.toLocaleLowerCase('pt-BR').includes(librarySearch.trim().toLocaleLowerCase('pt-BR'))).map((media) => (
                  <div key={`${libraryTab}-${media.id}-${media.src || ''}`} draggable onDragStart={(event) => event.dataTransfer.setData('application/x-timeline2-media', JSON.stringify(media))} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2 hover:border-sky-700">
                    <span className={`grid h-10 w-12 shrink-0 place-items-center rounded text-lg ${trackColor[media.kind]}`}>{media.icon || (media.kind === 'audio' ? '🎵' : '🎬')}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{media.name}</span><span className="text-[10px] text-slate-500">{media.origin === 'acervo' ? 'Acervo' : 'Arquivo local'} · {formatTime(media.duration)}</span></span>
                    <button type="button" onClick={() => addToTimeline(media)} aria-label={`Adicionar ${media.name}`} className="grid size-7 shrink-0 place-items-center rounded bg-sky-500 text-slate-950"><Plus size={14} /></button>
                  </div>
                ))}
                {libraryTab === 'project' && !projectMedia.length && <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl border border-dashed border-slate-700 p-6 text-xs text-slate-400"><Upload className="mx-auto mb-2" />Arraste ou selecione vídeos e áudios</button>}
              </div>
            </>}
            {(activePanel === 'text' || activePanel === 'captions') && <div>
              <h2 className="text-xs font-bold uppercase text-slate-400">{activePanel === 'captions' ? 'Legendas' : 'Texto'}</h2>
              <textarea value={textValue} onChange={(event) => setTextValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); addText(activePanel === 'captions'); } }} aria-label={activePanel === 'captions' ? 'Texto da legenda' : 'Texto do elemento'} placeholder={activePanel === 'captions' ? 'Digite a legenda e pressione Enter...' : 'Digite o texto e pressione Enter...'} className="mt-3 h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm" />
              {activePanel === 'captions' && <div className="mt-3">
                <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase text-slate-500">36 estilos editáveis</p><span className="text-[9px] text-sky-300">AI Edita + MediaMind</span></div>
                <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                  {[...new Set(CAPTION_PRESETS.map((preset) => preset.category))].map((category) => <section key={category}>
                    <p className="mb-1 text-[9px] font-bold uppercase text-slate-600">{category}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CAPTION_PRESETS.filter((preset) => preset.category === category).map((preset) => <button key={preset.id} type="button" aria-label={`Selecionar estilo ${preset.name}`} aria-pressed={captionPresetId === preset.id} onClick={() => setCaptionPresetId(preset.id)} className={`min-h-14 rounded-lg border p-2 text-left transition ${captionPresetId === preset.id ? 'border-sky-400 bg-sky-500/10' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}>
                        <span className="block truncate text-[10px] font-bold" style={{ color: preset.color, fontFamily: preset.fontFamily, textShadow: `0 0 ${preset.shadowBlur}px ${preset.shadowColor}`, WebkitTextStroke: `${preset.outlineWidth}px ${preset.outlineColor}`, backgroundColor: preset.backgroundColor, borderRadius: `${preset.backgroundRadius}px`, padding: preset.backgroundColor === 'transparent' ? 0 : '2px 4px' }}>{preset.preview}</span>
                        <span className="mt-1 block truncate text-[9px] text-slate-500">{preset.name}</span>
                      </button>)}
                    </div>
                  </section>)}
                </div>
                <button type="button" onClick={applyCaptionPresetToSelected} disabled={selected?.kind !== 'text'} className="mt-2 w2-button w-full justify-center disabled:opacity-40"><Wand2 size={13} /> Aplicar à legenda selecionada</button>
              </div>}
              <button type="button" onClick={() => addText(activePanel === 'captions')} className="mt-3 w2-button w-full justify-center"><Plus size={14} /> Adicionar no playhead</button>
            </div>}
            {activePanel === 'elements' && <div className="min-h-0 overflow-y-auto"><h2 className="text-xs font-bold uppercase text-slate-400">Elementos</h2><div className="mt-3 grid grid-cols-2 gap-2">{['◼ Forma', '● Círculo', '→ Seta', '★ Destaque'].map((item) => <button key={item} type="button" onClick={() => { setTextValue(item); commit((current) => addTextClip(current, item, { properties: { text: item, fontSize: 64 } })); setNotice(`${item} adicionado.`); }} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs hover:border-sky-500">{item}</button>)}</div>
              <p className="mb-1 mt-4 text-[9px] font-bold uppercase text-slate-600">Estilos de texto</p>
              <div className="grid grid-cols-2 gap-1.5">{TIMELINE2_TEXT_PRESETS.map((preset) => <button key={preset.id} type="button" draggable onDragStart={(event) => event.dataTransfer.setData('application/x-timeline2-media', JSON.stringify({ id: `preset-${preset.id}`, name: preset.text, kind: 'text', duration: 5, origin: 'editor', properties: { text: preset.text, ...preset.properties } }))} onClick={() => addTextPreset(textValue.trim() || preset.text, preset.properties, preset.label)} aria-label={`Adicionar texto ${preset.label}`} title="Clique para adicionar no playhead ou arraste para uma trilha de texto" className="min-h-12 rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-left hover:border-slate-600"><span className="block truncate text-[11px] font-bold" style={{ color: preset.properties.color, backgroundColor: preset.properties.backgroundColor, WebkitTextStroke: preset.properties.outlineWidth ? `1px ${preset.properties.outlineColor}` : undefined, padding: preset.properties.backgroundColor ? '1px 4px' : 0, borderRadius: 4 }}>{preset.text}</span><span className="mt-1 block truncate text-[9px] text-slate-500">{preset.label}</span></button>)}</div>
              <p className="mb-1 mt-4 text-[9px] font-bold uppercase text-slate-600">Stickers</p>
              <div className="grid grid-cols-4 gap-1.5">{TIMELINE2_STICKERS.map((sticker) => <button key={sticker} type="button" draggable onDragStart={(event) => event.dataTransfer.setData('application/x-timeline2-media', JSON.stringify({ id: `sticker-${sticker}`, name: sticker, kind: 'text', duration: 3, origin: 'editor', properties: { text: sticker, fontSize: 96 } }))} onClick={() => addTextPreset(sticker, { fontSize: 96 }, `Sticker ${sticker}`, 3)} aria-label={`Adicionar sticker ${sticker}`} className="grid h-10 place-items-center rounded-lg border border-slate-800 bg-slate-950/50 text-xl hover:border-sky-500">{sticker}</button>)}</div>
              <p className="mt-3 text-[10px] leading-4 text-slate-500">Textos e stickers entram na trilha de texto e aparecem no preview. A exportação MP4 ainda não os renderiza.</p>
            </div>}
            {activePanel === 'effects' && <div className="min-h-0 overflow-y-auto"><h2 className="text-xs font-bold uppercase text-slate-400">Efeitos rápidos</h2><div className="mt-3 space-y-2">{[['Fade 50%', { opacity: 50 }], ['Zoom 120%', { scale: 120 }], ['Girar 15°', { rotation: 15 }], ['Velocidade 2x', { speed: 2 }]].map(([label, values]) => <button key={label} type="button" disabled={!selected} onClick={() => applyPresetToSelected(values, label)} className="w2-button w-full justify-center disabled:opacity-40">{label}</button>)}</div>
              <p className="mb-1 mt-4 text-[9px] font-bold uppercase text-slate-600">Filtros de cor</p>
              <div className="grid grid-cols-2 gap-1.5">{TIMELINE2_FILTER_PRESETS.map((preset) => <button key={preset.id} type="button" disabled={!selected} onClick={() => applyPresetToSelected(preset.properties, `Filtro ${preset.label}`)} aria-label={`Aplicar filtro ${preset.label}`} className="w2-button justify-center px-2 disabled:opacity-40">{preset.label}</button>)}</div>
              <p className="mb-1 mt-4 text-[9px] font-bold uppercase text-slate-600">Transição de entrada</p>
              <div className="grid grid-cols-2 gap-1.5">{TIMELINE2_TRANSITIONS.map((transition) => <button key={transition.id} type="button" disabled={!selected || !previousAdjacent} onClick={() => changeTransition(transition.id, selected.transitionIn?.duration || 1)} aria-label={`Aplicar transição ${transition.label}`} title={previousAdjacent ? 'Entre o clipe anterior e o selecionado' : 'O clipe selecionado precisa encostar em outro na mesma trilha'} className="w2-button justify-center px-2 disabled:opacity-40"><Blend size={12} /> {transition.label}</button>)}</div>
              <p className="mb-1 mt-4 text-[9px] font-bold uppercase text-slate-600">Picture-in-picture</p>
              <div className="grid grid-cols-2 gap-1.5">{[['top-left', 'Superior esquerdo'], ['top-right', 'Superior direito'], ['bottom-left', 'Inferior esquerdo'], ['bottom-right', 'Inferior direito']].map(([corner, label]) => <button key={corner} type="button" disabled={selected?.kind !== 'video'} onClick={() => placeAsPip(corner)} aria-label={`PiP ${label}`} className="w2-button justify-center px-2 disabled:opacity-40"><PictureInPicture2 size={12} /> {label}</button>)}</div>
            </div>}
            {activePanel === 'adjust' && <div><h2 className="text-xs font-bold uppercase text-slate-400">Ajustes</h2><p className="mt-3 text-xs leading-5 text-slate-400">Use o Inspetor à direita para posição, trim, transformação, velocidade e áudio do clipe selecionado.</p><button type="button" onClick={() => commit(toggleSnapping)} className="mt-4 w2-button w-full justify-center"><Magnet size={14} /> Snapping {document.snapEnabled ? 'ligado' : 'desligado'}</button></div>}
          </div>
        </aside>

        <main className="w2-panel flex flex-col p-3">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Preview do programa</h2><span className="text-xs text-sky-300">{formatTime(document.playhead)}</span></div>
          <div ref={previewRef} className="relative grid flex-1 place-items-center overflow-hidden rounded-xl bg-black">
            {activeVisuals.map((clip) => {
              const properties = { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, speed: 1, ...(clip.properties || {}) };
              const visibleOpacity = (properties.opacity / 100) * (Number.isFinite(clip.fade) ? clip.fade : 1);
              const filter = getClipFilterCss(properties);
              if (clip.kind === 'text') return <div key={clip.id} data-testid={`preview-layer-${clip.id}`} data-layer={clip.layerIndex} onClick={() => setSelectedClipId(clip.id)} className={`absolute max-w-[90%] cursor-pointer text-center mm-caption-${properties.animation || 'none'}`} style={{ zIndex: clip.layerIndex, opacity: visibleOpacity, filter, fontSize: `${properties.fontSize || 54}px`, fontFamily: properties.fontFamily, fontWeight: properties.fontWeight || 700, color: properties.color || '#ffffff', WebkitTextStroke: `${properties.outlineWidth || 0}px ${properties.outlineColor || 'transparent'}`, textShadow: `0 0 ${properties.shadowBlur || 0}px ${properties.shadowColor || 'transparent'}`, backgroundColor: properties.backgroundColor || 'transparent', borderRadius: `${properties.backgroundRadius || 0}px`, padding: properties.backgroundColor && properties.backgroundColor !== 'transparent' ? '0.12em 0.28em' : 0, transform: `translate(${properties.x}px, ${properties.y}px) scale(${properties.scale / 100}) rotate(${properties.rotation}deg)` }}>{properties.text || clip.name}</div>;
              return <video key={clip.id} data-testid={`preview-layer-${clip.id}`} ref={(node) => { if (node) mediaRefs.current.set(clip.id, node); else mediaRefs.current.delete(clip.id); }} src={clip.src} muted={Boolean(properties.audioDisabled || clip.muted)} preload="metadata" data-layer={clip.layerIndex} data-transition-role={clip.transitionRole || undefined} onClick={() => setSelectedClipId(clip.transitionRole ? null : clip.id)} className="absolute max-h-full max-w-full cursor-pointer transition-transform" style={{ zIndex: clip.layerIndex, opacity: visibleOpacity, filter, transform: `translate(${properties.x}px, ${properties.y}px) scale(${properties.scale / 100}) rotate(${properties.rotation}deg)` }} />;
            })}
            {activeAudio.map((clip) => <audio key={clip.id} data-testid={`preview-audio-${clip.id}`} ref={(node) => { if (node) mediaRefs.current.set(clip.id, node); else mediaRefs.current.delete(clip.id); }} src={clip.src} preload="metadata" />)}
            {!activeVisuals.length && <div className="text-center"><div className="text-6xl">{activeAudio.length ? '🎵' : '🎬'}</div><p className="mt-3 text-sm font-semibold">{activeAudio[0]?.name || (hasTimedSequence ? 'Quadro preto · sequência em andamento' : 'Timeline vazia')}</p><p className="mt-1 text-xs text-slate-500">{hasTimedSequence ? 'A reprodução continua pelo espaço vazio até a próxima camada, sem interromper a sequência.' : 'Importe um arquivo ou escolha no Acervo'}</p></div>}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={() => updateTransient((current) => stepFrames(current, -1))} aria-label="Quadro anterior" title="Quadro anterior (←)" className="w2-button px-2"><StepBack size={14} /></button>
            <button type="button" onClick={togglePlayback} disabled={!hasTimedSequence} aria-label={playing ? 'Pausar' : 'Reproduzir'} className="grid size-11 place-items-center rounded-full bg-sky-500 text-slate-950 disabled:opacity-40">{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button>
            <button type="button" onClick={() => updateTransient((current) => stepFrames(current, 1))} aria-label="Próximo quadro" title="Próximo quadro (→)" className="w2-button px-2"><StepForward size={14} /></button>
            <div className="relative h-9 flex-1" aria-label="Linha do tempo do player">
              {document.inPoint != null && document.outPoint != null && <span data-testid="player-in-out-range" aria-hidden="true" className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded bg-emerald-400/35" style={{ left: `${(document.inPoint / document.duration) * 100}%`, width: `${((document.outPoint - document.inPoint) / document.duration) * 100}%` }} />}
              {document.inPoint != null && <span data-testid="player-in-marker" title={`IN ${formatTime(document.inPoint)}`} className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-emerald-400" style={{ left: `${(document.inPoint / document.duration) * 100}%` }}><span className="absolute -top-1 -translate-x-1/2 rounded bg-emerald-500 px-1 text-[8px] font-black text-slate-950">I</span></span>}
              {document.outPoint != null && <span data-testid="player-out-marker" title={`OUT ${formatTime(document.outPoint)}`} className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-amber-400" style={{ left: `${(document.outPoint / document.duration) * 100}%` }}><span className="absolute -top-1 -translate-x-1/2 rounded bg-amber-400 px-1 text-[8px] font-black text-slate-950">O</span></span>}
              <input aria-label="Playhead" type="range" min="0" max={document.duration} step={1 / document.fps} value={document.playhead} onChange={(event) => updateTransient((current) => setPlayhead(current, event.target.value))} className="absolute inset-x-0 top-1/2 z-10 w-full -translate-y-1/2" />
            </div>
          </div>
        </main>

        <aside className="w2-panel min-h-0 overflow-y-auto p-3">
          <h2 className="text-xs font-bold uppercase text-slate-400">Inspetor</h2>
          {selectedIds.length > 1 && <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200"><span><Layers size={12} className="mr-1 inline" />{selectedIds.length} clipes selecionados · o inspetor mostra o último</span><button type="button" onClick={() => setSelection([])} className="text-amber-300 hover:text-white">Limpar</button></div>}
          {selected ? <div className="mt-3 space-y-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-sm font-bold">{selected.name}</p><p className="text-[10px] text-slate-500">{selected.id} · {selected.trackId}</p></div>
            <label className="block text-xs text-slate-400">Posição na timeline<input aria-label="Posição do clipe" type="number" step="0.001" value={Number(selected.start.toFixed(3))} onChange={(event) => commit((current) => moveClip(current, selected.id, { start: Number(event.target.value) }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" /></label>
            <label className="block text-xs text-slate-400">Início do conteúdo (trim)<input aria-label="Início do clipe" type="number" step="0.001" value={Number(selected.start.toFixed(3))} onChange={(event) => changeTrim('start', event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" /></label>
            <label className="block text-xs text-slate-400">Fim na timeline<input aria-label="Fim do clipe" type="number" step="0.001" value={Number((selected.start + selected.duration).toFixed(3))} onChange={(event) => changeTrim('end', event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" /></label>
            <dl className="grid grid-cols-2 gap-2 text-xs"><dt className="text-slate-500">Source IN</dt><dd>{formatTime(selected.sourceIn)}</dd><dt className="text-slate-500">Source OUT</dt><dd>{formatTime(selected.sourceOut)}</dd></dl>
            <div className="border-t border-slate-800 pt-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase text-sky-300">Transformação</h3><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={autoKeyframe} onChange={(event) => setAutoKeyframe(event.target.checked)} /> Auto keyframe</label></div>{[
              ['Posição X', 'x', -500, 500, 1], ['Posição Y', 'y', -500, 500, 1], ['Escala', 'scale', 10, 300, 1], ['Rotação', 'rotation', -180, 180, 1], ['Opacidade', 'opacity', 0, 100, 1],
            ].map(([label, field, min, max, step]) => { const currentKeyframe = keyframeAtPlayhead(field); return <div key={field} className="mb-3 rounded-lg border border-slate-800 bg-slate-950/40 p-2"><span className="mb-1 flex items-center justify-between text-xs text-slate-400"><span>{label}</span><span className="flex items-center gap-2"><strong className="text-slate-200">{Number(Number(selectedProperties[field]).toFixed(3))}{['scale', 'opacity'].includes(field) ? '%' : ''}</strong><button type="button" onClick={() => toggleKeyframe(field)} aria-label={`${currentKeyframe ? 'Remover' : 'Adicionar'} keyframe ${label}`} title="Ativar/desativar keyframe neste quadro" className={currentKeyframe ? 'text-sky-400' : 'text-slate-600 hover:text-slate-200'}><Diamond size={13} fill={currentKeyframe ? 'currentColor' : 'none'} /></button></span></span><input aria-label={label} type="range" min={min} max={max} step={step} value={selectedProperties[field]} onChange={(event) => setProperty(field, event.target.value)} className="w-full" />{currentKeyframe && <div className="mt-2 flex items-center justify-between gap-2"><label className="text-[10px] text-slate-500">Curva<select aria-label={`Curva do keyframe ${label}`} value={currentKeyframe.easing || 'smooth'} onChange={(event) => setKeyframeCurve(field, event.target.value)} className="ml-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"><option value="hold">Degrau</option><option value="linear">Linear</option><option value="smooth">Suave</option><option value="bezier">Bézier</option></select></label><span className="h-7 w-16 rounded border border-slate-700 bg-slate-900 p-1"><svg viewBox="0 0 56 20" className="h-full w-full" aria-label={`Gráfico da curva ${label}`}><path d={currentKeyframe.easing === 'hold' ? 'M1 19 H54 V1' : currentKeyframe.easing === 'linear' ? 'M1 19 L55 1' : 'M1 19 C18 19 38 1 55 1'} fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-400" /></svg></span></div>}</div>; })}</div>
            {selected.kind !== 'audio' && <div className="border-t border-slate-800 pt-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase text-sky-300">Cor e efeitos</h3><button type="button" onClick={() => applyPresetToSelected(TIMELINE2_FILTER_PRESETS[0].properties, 'Sem filtro')} className="text-[10px] text-slate-500 hover:text-white">Redefinir</button></div>{[
              ['Brilho', 'brightness', 0, 200, 1, '%'], ['Contraste', 'contrast', 0, 200, 1, '%'], ['Saturação', 'saturation', 0, 200, 1, '%'], ['Desfoque', 'blur', 0, 20, 0.5, ' px'],
            ].map(([label, field, min, max, step, unit]) => { const value = Number(selectedProperties[field] ?? (field === 'blur' ? 0 : 100)); return <label key={field} className="mb-2 block text-xs text-slate-400"><span className="mb-1 flex justify-between"><span>{label}</span><strong className="text-slate-200">{Number(value.toFixed(2))}{unit}</strong></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => setProperty(field, event.target.value)} className="w-full" /></label>; })}</div>}
            <div className="border-t border-slate-800 pt-3"><h3 className="mb-3 text-xs font-bold uppercase text-amber-300">Entrada e saída</h3>{[['Fade de entrada', 'fadeIn'], ['Fade de saída', 'fadeOut']].map(([label, field]) => { const value = Number(selectedProperties[field] || 0); const max = Math.max(0.1, Math.min(5, selected.duration / 2)); return <label key={field} className="mb-2 block text-xs text-slate-400"><span className="mb-1 flex justify-between"><span>{label}</span><strong className="text-slate-200">{value.toFixed(1)} s</strong></span><input aria-label={label} type="range" min="0" max={Number(max.toFixed(2))} step="0.1" value={Math.min(value, max)} onChange={(event) => setProperty(field, event.target.value)} className="w-full" /></label>; })}
              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2"><p className="mb-1 flex items-center gap-1 text-xs text-slate-400"><Blend size={12} /> Transição de entrada</p>{previousAdjacent ? <div className="flex items-center gap-2"><select aria-label="Tipo de transição de entrada" value={selected.transitionIn?.type || ''} disabled={selectedTrack?.locked} onChange={(event) => changeTransition(event.target.value, selected.transitionIn?.duration || 1)} className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"><option value="">Nenhuma (corte seco)</option>{TIMELINE2_TRANSITIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{selected.transitionIn && <input aria-label="Duração da transição" type="number" min={Number((1 / document.fps).toFixed(3))} max={Number(Math.min(selected.duration, previousAdjacent.duration).toFixed(3))} step="0.1" value={Number(selected.transitionIn.duration.toFixed(2))} onChange={(event) => changeTransition(selected.transitionIn.type, Number(event.target.value))} className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200" />}</div> : <p className="text-[10px] text-slate-500">Encoste este clipe ao anterior na mesma trilha para criar uma transição.</p>}{selected.transitionIn?.type === 'crossfade' && <p className="mt-1 text-[10px] text-slate-500">O clipe anterior continua além do OUT (sobra de mídia) por baixo do novo.</p>}</div>
            </div>
            {selected.kind !== 'text' && <div className="border-t border-slate-800 pt-3"><h3 className="mb-3 text-xs font-bold uppercase text-emerald-300">Tempo e áudio</h3><label className="mb-3 block text-xs text-slate-400"><span className="mb-1 flex justify-between"><span>Velocidade</span><strong>{selectedProperties.speed}x</strong></span><input aria-label="Velocidade" type="range" min="0.25" max="4" step="0.25" value={selectedProperties.speed} onChange={(event) => setProperty('speed', event.target.value)} className="w-full" /></label><label className="block text-xs text-slate-400"><span className="mb-1 flex justify-between"><span>Volume</span><strong>{selectedProperties.volume} dB</strong></span><input aria-label="Volume" type="range" min="-60" max="6" step="1" value={selectedProperties.volume} onChange={(event) => setProperty('volume', event.target.value)} className="w-full" /></label>{selected.kind === 'video' && <button type="button" disabled={Boolean(selected.properties?.audioDisabled) || !selected.src} onClick={() => commit((current) => separateClipAudio(current, selected.id))} className="mt-3 w2-button w-full justify-center disabled:opacity-40"><Music size={13} /> {selected.properties?.audioDisabled ? 'Áudio já separado' : 'Separar áudio original'}</button>}</div>}
          </div> : <div className="grid h-full min-h-64 place-items-center text-center"><div><SlidersHorizontal className="mx-auto text-slate-600" size={38} /><h3 className="mt-4 font-bold">Nenhum elemento selecionado</h3><p className="mt-2 text-xs text-slate-500">Clique em um clipe para editar suas propriedades.</p></div></div>}
        </aside>

        <section className="w2-panel col-span-3 flex min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2">
            <button type="button" onClick={() => setActiveTool('select')} aria-label="Ferramenta de seleção" title="Seleção (V)" className={`w2-button ${activeTool === 'select' ? 'border-sky-500 bg-sky-500/15 text-sky-300' : ''}`}><MousePointer2 size={14} /></button>
            <button type="button" onClick={() => setActiveTool('blade')} aria-label="Ferramenta lâmina" title="Lâmina: clique num clipe para cortar no playhead" className={`w2-button ${activeTool === 'blade' ? 'border-rose-500 bg-rose-500/15 text-rose-300' : ''}`}><Scissors size={14} /></button>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <button type="button" onClick={applySplit} disabled={!selected} aria-label="Dividir clipe" title="Dividir no playhead (S)" className="w2-button disabled:opacity-40"><Scissors size={14} /> Dividir</button>
            <button type="button" onClick={() => selected && commit((current) => trimClip(current, selected.id, { edge: 'start', time: current.playhead }))} disabled={!selected} aria-label="Aparar início no playhead" title="Trim esquerdo" className="w2-button disabled:opacity-40"><ChevronLeft size={14} /></button>
            <button type="button" onClick={() => selected && commit((current) => trimClip(current, selected.id, { edge: 'end', time: current.playhead }))} disabled={!selected} aria-label="Aparar fim no playhead" title="Trim direito" className="w2-button disabled:opacity-40"><ChevronRight size={14} /></button>
            <button type="button" onClick={duplicateSelection} disabled={!selected} aria-label="Duplicar clipe" title="Duplicar (Ctrl+D)" className="w2-button disabled:opacity-40"><Copy size={14} /></button>
            <button type="button" onClick={copySelection} disabled={!selectedIds.length} aria-label="Copiar seleção" title="Copiar (Ctrl+C)" className="w2-button disabled:opacity-40">Copiar</button>
            <button type="button" onClick={pasteClipboard} disabled={!clipboard.length} aria-label="Colar no playhead" title="Colar no playhead (Ctrl+V)" className="w2-button disabled:opacity-40"><ClipboardPaste size={14} /></button>
            <button type="button" onClick={removeSelected} disabled={!selected} aria-label="Excluir clipe" title="Excluir (Delete)" className="w2-button disabled:opacity-40"><Trash2 size={14} /></button>
            <button type="button" onClick={rippleRemoveSelected} disabled={!selected} aria-label="Excluir com ripple" title="Ripple delete" className="w2-button disabled:opacity-40"><Crop size={14} /></button>
            <button type="button" onClick={() => commit(toggleSnapping)} aria-label={document.snapEnabled ? 'Desativar snapping' : 'Ativar snapping'} className={`w2-button ${document.snapEnabled ? 'border-sky-500 text-sky-300' : ''}`}><Magnet size={14} /> Snapping</button>
            <button type="button" onClick={() => commit(toggleRippleEditing)} aria-pressed={Boolean(document.rippleEnabled)} aria-label={document.rippleEnabled ? 'Desativar ripple ao excluir' : 'Ativar ripple ao excluir'} title="Com ripple ligado, Delete fecha a lacuna na trilha (trilhas travadas não mudam)" className={`w2-button ${document.rippleEnabled ? 'border-sky-500 text-sky-300' : ''}`}>Ripple</button>
            <button type="button" onClick={() => commit((current) => addMarker(current, { label: `Marcador ${current.markers.length + 1}` }))} aria-label="Adicionar marcador" title="Marcador no playhead" className="w2-button"><BookmarkPlus size={14} /></button>
            <button type="button" onClick={() => commit((current) => setTimelineIn(current))} aria-label="Marcar IN" title="Marcar entrada da sequência (I)" className="w2-button">IN</button>
            <button type="button" onClick={() => commit((current) => setTimelineOut(current))} aria-label="Marcar OUT" title="Marcar saída da sequência (O)" className="w2-button">OUT</button>
            <button type="button" onClick={() => commit(clearTimelineRange)} aria-label="Limpar IN e OUT" title="Usar toda a sequência" className="w2-button text-slate-400">Limpar</button>
            <button type="button" onClick={extractInOut} disabled={document.inPoint == null || document.outPoint == null || document.outPoint <= document.inPoint} aria-label="Extrair intervalo IN/OUT" title="Remove o intervalo IN/OUT de todas as trilhas destravadas e fecha a lacuna" className="w2-button disabled:opacity-40">Extrair</button>
            <span className="flex items-center gap-1 rounded border border-slate-800 bg-slate-950/60 px-2 py-1 font-mono text-[9px] text-slate-400"><span>IN</span><strong data-testid="timeline-in-point" className="text-emerald-300">{document.inPoint == null ? '—' : formatTime(document.inPoint)}</strong><span className="ml-1">OUT</span><strong data-testid="timeline-out-point" className="text-amber-300">{document.outPoint == null ? '—' : formatTime(document.outPoint)}</strong></span>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <button type="button" onClick={() => commit((current) => addTrack(current, 'video'))} aria-label="Adicionar trilha de vídeo" className="w2-button"><Plus size={13} /> Vídeo</button>
            <button type="button" onClick={() => commit((current) => addTrack(current, 'audio'))} aria-label="Adicionar trilha de áudio" className="w2-button"><Plus size={13} /> Áudio</button>
            <button type="button" onClick={() => commit((current) => addTrack(current, 'text'))} aria-label="Adicionar trilha de texto" className="w2-button"><Plus size={13} /> Texto</button>
            <div className="ml-auto flex items-center gap-2 text-xs"><button type="button" onClick={zoomToFit} aria-label="Ajustar zoom à sequência" title="Ajustar zoom à sequência (Shift+Z)" className="w2-button px-2"><Maximize2 size={13} /></button><ZoomIn size={14} /><input aria-label="Zoom da Timeline 2" type="range" min="0.25" max="8" step="0.01" value={document.zoom} onChange={(event) => commit((current) => setZoom(current, event.target.value))} /><span className="w-10 text-right">{Math.round(document.zoom * 100)}%</span></div>
          </div>
          <div className="border-b border-slate-800 px-3 py-1 text-[10px] text-sky-300" role="status">{notice}</div>
          <div ref={timelineScrollRef} className="relative flex-1 overflow-auto bg-[#031022] p-3">
            <div ref={timelineRulerRef} role="slider" aria-label="Régua e agulha da timeline" aria-valuemin="0" aria-valuemax={scaleDuration} aria-valuenow={document.playhead} onPointerDown={(event) => { try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* pointer may already be inactive */ } movePlayheadFromPointer(event); }} onPointerMove={(event) => { if (event.buttons === 1) movePlayheadFromPointer(event); }} className="relative ml-40 h-7 shrink-0 cursor-ew-resize border-b border-slate-700" style={{ width: `${timelineGeometry.width}px` }}><div className="pointer-events-none flex justify-between text-[10px] text-slate-500"><span>00:00</span><span>{formatTime(scaleDuration / 2)}</span><span>{formatTime(scaleDuration)}</span></div>{document.inPoint != null && document.outPoint != null && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 border-x border-emerald-400/70 bg-emerald-400/10" style={{ left: `${document.inPoint * timelineGeometry.pixelsPerSecond}px`, width: `${Math.max(1, (document.outPoint - document.inPoint) * timelineGeometry.pixelsPerSecond)}px` }} />}{document.inPoint != null && <span aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-emerald-400" style={{ left: `${document.inPoint * timelineGeometry.pixelsPerSecond}px` }} />}{document.outPoint != null && <span aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-amber-400" style={{ left: `${document.outPoint * timelineGeometry.pixelsPerSecond}px` }} />}{document.markers.map((marker) => <span key={marker.id} title={`${marker.label} · ${formatTime(marker.time)}`} className="absolute bottom-0 h-3 w-0.5 bg-amber-400" style={{ left: `${marker.time * timelineGeometry.pixelsPerSecond}px` }} />)}<span className="pointer-events-none absolute -bottom-2 z-30 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-rose-500" style={{ left: `${document.playhead * timelineGeometry.pixelsPerSecond}px` }} /></div>
            <div role="slider" aria-label="Arrastar agulha vertical" aria-valuemin="0" aria-valuemax={scaleDuration} aria-valuenow={document.playhead} onPointerDown={startPlayheadGesture} onPointerMove={updatePlayheadGesture} onPointerUp={endPlayheadGesture} onPointerCancel={endPlayheadGesture} className="absolute bottom-3 top-10 z-40 w-3 -translate-x-1/2 touch-none cursor-ew-resize" style={{ left: `${TRACK_HEADER_WIDTH + 12 + (document.playhead * timelineGeometry.pixelsPerSecond)}px` }}><span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-rose-500" /></div>
            {displayTracks.map((track) => (
              <div key={track.id} data-track-id={track.id} data-testid={`timeline2-track-${track.id}`} className="flex h-12 border-b border-slate-800" style={{ width: `${TRACK_HEADER_WIDTH + timelineGeometry.width}px` }}>
                <div className="flex w-40 shrink-0 items-center gap-1 border-r border-slate-700 px-2"><span className="flex flex-col">{(() => { const group = displayTracks.filter((item) => (item.kind === 'audio') === (track.kind === 'audio')); const position = group.findIndex((item) => item.id === track.id); return <>
                  <button type="button" disabled={track.locked || position <= 0} onClick={() => commit((current) => moveTrack(current, track.id, 'up'))} aria-label={`Subir ${track.name}`} title={track.kind === 'audio' ? 'Mover trilha para cima' : 'Subir camada (fica por cima no preview)'} className="text-slate-500 hover:text-white disabled:opacity-25"><ChevronUp size={10} /></button>
                  <button type="button" disabled={track.locked || position >= group.length - 1} onClick={() => commit((current) => moveTrack(current, track.id, 'down'))} aria-label={`Descer ${track.name}`} title={track.kind === 'audio' ? 'Mover trilha para baixo' : 'Descer camada'} className="text-slate-500 hover:text-white disabled:opacity-25"><ChevronDown size={10} /></button>
                </>; })()}</span><span className="min-w-0 flex-1"><strong className="block text-xs uppercase">{track.id}</strong>{renamingTrackId === track.id
                  ? <input autoFocus aria-label={`Nome da trilha ${track.id}`} defaultValue={track.name} maxLength={60} onBlur={(event) => commitTrackName(track, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } else if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.value = track.name; event.currentTarget.blur(); } }} className="w-full rounded border border-sky-600 bg-slate-950 px-1 text-[9px] text-slate-100" />
                  : <button type="button" onClick={() => setRenamingTrackId(track.id)} aria-label={`Renomear ${track.name}`} title="Renomear trilha" className="block w-full truncate text-left text-[9px] text-slate-500 hover:text-slate-300">{track.name}</button>}</span><button type="button" onClick={() => commit((current) => toggleTrackState(current, track.id, 'locked'))} aria-label={`${track.locked ? 'Destravar' : 'Travar'} ${track.name}`} className="text-slate-500 hover:text-white">{track.locked ? <Lock size={11} /> : <Unlock size={11} />}</button>{track.kind !== 'text' && <button type="button" onClick={() => commit((current) => toggleTrackState(current, track.id, 'muted'))} aria-label={`${track.muted ? 'Ativar' : 'Silenciar'} ${track.name}`} className="text-slate-500 hover:text-white">{track.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>}{track.kind !== 'audio' && <button type="button" onClick={() => commit((current) => toggleTrackState(current, track.id, 'hidden'))} aria-label={`${track.hidden ? 'Mostrar' : 'Ocultar'} ${track.name}`} className="text-slate-500 hover:text-white">{track.hidden ? <EyeOff size={11} /> : <Eye size={11} />}</button>}{track.userCreated && <button type="button" disabled={track.clips.length > 0} onClick={() => commit((current) => removeTrack(current, track.id))} aria-label={`Remover ${track.name}`} title={track.clips.length ? 'Remova os clipes antes de excluir a trilha' : 'Remover trilha'} className="text-slate-500 hover:text-rose-300 disabled:opacity-25"><Trash2 size={11} /></button>}</div>
                <div data-track-canvas aria-label={`Área da faixa ${track.name}`} className={`relative shrink-0 ${track.hidden || (track.kind === 'audio' && track.muted) ? 'opacity-35' : ''}`} onPointerDown={(event) => { if (event.target !== event.currentTarget) return; if (event.shiftKey) startMarquee(event, track); else movePlayheadFromPointer(event); }} onPointerMove={(event) => { if (marqueeRef.current) updateMarquee(event); }} onPointerUp={endMarquee} onPointerCancel={endMarquee} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnTrack(event, track)} style={{ width: `${timelineGeometry.width}px` }}>
                  {marquee?.trackIds.includes(track.id) && <span data-testid="timeline2-marquee" aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-20 border border-sky-400 bg-sky-400/15" style={{ left: `${Math.min(marquee.startTime, marquee.endTime) * timelineGeometry.pixelsPerSecond}px`, width: `${Math.max(1, Math.abs(marquee.endTime - marquee.startTime) * timelineGeometry.pixelsPerSecond)}px` }} />}
                  {track.clips.map((clip) => <button key={clip.id} type="button" aria-pressed={selectedIds.includes(clip.id)} onPointerDown={(event) => startClipGesture(event, clip)} onPointerMove={updateClipGesture} onPointerUp={endClipGesture} onPointerCancel={endClipGesture} onClick={(event) => { if (isModifierClick(event)) { toggleSelection(clip.id); return; } if (suppressClickRef.current) { suppressClickRef.current = false; return; } setSelectedClipId(clip.id); if (activeTool === 'blade') commit((current) => splitClip(current, clip.id, current.playhead)); }} title="Arraste para mover entre trilhas; use as alças para aparar ou estender. Shift/Ctrl + clique seleciona vários." className={`group absolute top-1 h-10 touch-none cursor-grab overflow-hidden rounded border px-3 text-left text-[10px] shadow active:cursor-grabbing ${trackColor[clip.kind]} ${selectedIds.includes(clip.id) ? 'border-amber-300 ring-2 ring-amber-300/50' : 'border-white/10'}`} style={{ left: `${clip.start * timelineGeometry.pixelsPerSecond}px`, width: `${Math.max(8, clip.duration * timelineGeometry.pixelsPerSecond)}px` }}>{clip.kind === 'audio' && clip.src && <Timeline2Waveform src={clip.src} sourceIn={Number(clip.sourceIn) || 0} sourceSpan={clip.duration * Math.max(0.25, Math.min(4, Number(clip.properties?.speed) || 1))} width={clip.duration * timelineGeometry.pixelsPerSecond} />}{clip.transitionIn && <span data-testid={`transition-${clip.id}`} title={`${TIMELINE2_TRANSITIONS.find((item) => item.id === clip.transitionIn.type)?.label || 'Transição'} · ${clip.transitionIn.duration.toFixed(2)} s`} aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-white/45 to-transparent" style={{ width: `${clip.transitionIn.duration * timelineGeometry.pixelsPerSecond}px` }} />}<span role="slider" aria-label={`Aparar início de ${clip.name}`} aria-valuenow={clip.start} tabIndex={0} onPointerDown={(event) => startClipGesture(event, clip, 'start')} className={`absolute inset-y-0 left-0 z-10 w-2 touch-none cursor-ew-resize bg-white/50 ${selectedClipId === clip.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} /><span className="block truncate font-bold">{clip.name}</span><span className="opacity-70">{formatTime(clip.duration)}</span><span role="slider" aria-label={`Aparar fim de ${clip.name}`} aria-valuenow={clip.start + clip.duration} tabIndex={0} onPointerDown={(event) => startClipGesture(event, clip, 'end')} className={`absolute inset-y-0 right-0 z-10 w-2 touch-none cursor-ew-resize bg-white/50 ${selectedClipId === clip.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} /></button>)}
                </div>
              </div>
            ))}
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><ChevronLeft size={12} /> Arraste o playhead, selecione um clipe e use os comandos reais acima <ChevronRight size={12} /></div>
          </div>
        </section>
      </div>
    </div>
  );
}
