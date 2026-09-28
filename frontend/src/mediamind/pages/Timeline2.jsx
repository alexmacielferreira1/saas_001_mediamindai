import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, BookmarkPlus, Captions, ChevronLeft, ChevronRight, Copy, Crop, Download, Eye, EyeOff,
  Diamond, FolderOpen, Lock, Magnet, MousePointer2, Music, Pause, Play, Plus, Redo2, Save,
  Scissors, SlidersHorizontal, Sparkles, Trash2, Type, Undo2, Unlock, Upload, Volume2,
  VolumeX, Wand2, ZoomIn,
} from 'lucide-react';
import { exportMediaClip, exportTimeline, listMediaAssets, mediaStreamUrl, uploadMediaAsset } from '../../api/media';
import { useTimeline2Project } from '../hooks/useTimeline2Project';
import {
  addMarker, addMediaClip, addPropertyKeyframe, addTextClip, createTimeline2Document, deleteClips, duplicateClip, moveClip, removePropertyKeyframe, rippleDelete,
  setPlayhead, setZoom, splitClip, toggleSnapping, toggleTrackState, trimClip,
  getActiveClips, getClipPropertiesAtTime, getTimelineGeometry, pointerToTimelineTime, updateClipProperties, updateKeyframeCurve,
} from '../lib/timeline2Model';

const INITIAL_DOCUMENT = createTimeline2Document({ id: 'timeline2-local', name: 'Novo projeto MediaMind' });

const formatTime = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const frames = Math.floor((safe % 1) * 30);
  return `00:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
};

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

export default function Timeline2({ embedded = false }) {
  const initial = useMemo(() => {
    try {
      const workspaceDraft = JSON.parse(localStorage.getItem('mm_workspace2_timeline2_draft'));
      return workspaceDraft?.tracks ? workspaceDraft : INITIAL_DOCUMENT;
    } catch { return INITIAL_DOCUMENT; }
  }, []);
  const { document, commit, updateTransient, beginGesture, finishGesture, undo, redo, canUndo, canRedo } = useTimeline2Project(initial, `mm_timeline2_project:${initial.id}`);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [libraryTab, setLibraryTab] = useState('project');
  const [activePanel, setActivePanel] = useState('media');
  const [activeTool, setActiveTool] = useState('select');
  const [textValue, setTextValue] = useState('');
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [autoKeyframe, setAutoKeyframe] = useState(false);
  const [notice, setNotice] = useState('Importe um arquivo ou adicione uma mídia do acervo.');
  const fileInputRef = useRef(null);
  const mediaRefs = useRef(new Map());
  const pointerGestureRef = useRef(null);
  const selected = document.tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId);
  const selectedProperties = { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, speed: 1, ...(selected ? getClipPropertiesAtTime(selected, document.playhead) : {}) };
  const activeClips = useMemo(() => getActiveClips(document, document.playhead), [document]);
  const activeVisuals = activeClips.filter((clip) => clip.kind === 'video' || clip.kind === 'text');
  const activeAudio = activeClips.filter((clip) => clip.kind === 'audio');
  const primaryClock = activeClips.find((clip) => ['video', 'audio'].includes(clip.kind) && clip.src);
  const scaleDuration = Math.max(document.duration, 30);
  const timelineGeometry = useMemo(() => getTimelineGeometry(scaleDuration, document.zoom), [scaleDuration, document.zoom]);
  const projectMedia = useMemo(() => {
    const clips = document.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind !== 'text');
    return clips.map((clip) => ({ id: clip.assetId || clip.id, name: clip.name, kind: clip.kind, duration: clip.sourceOut || clip.duration, src: clip.src, origin: clip.origin }))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id && candidate.src === item.src) === index);
  }, [document.tracks]);
  const acervoMedia = useMemo(
    () => assets.filter((asset) => ['video', 'audio'].includes(asset.asset_type)).map(assetToMedia),
    [assets],
  );

  const applySplit = () => selected && commit((current) => splitClip(current, selected.id, current.playhead));
  const removeSelected = () => selected && commit((current) => deleteClips(current, [selected.id]));
  const rippleRemoveSelected = () => selected && commit((current) => rippleDelete(current, [selected.id]));
  const changeTrim = (edge, value) => selected && commit((current) => trimClip(current, selected.id, { edge, time: Number(value) }));
  const addToTimeline = (media, trackId, start = document.playhead) => {
    const clipId = `clip-${media.id}-${Date.now()}`;
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
    if (!players.length) {
      setNotice('Posicione a agulha sobre um clipe reproduzível.');
      return;
    }
    if (playing) {
      players.forEach(({ player }) => player.pause());
      setPlaying(false);
      return;
    }
    const attempts = await Promise.allSettled(players.map(async ({ clip, player }) => {
      player.currentTime = Math.max(0, clip.sourceTime);
      player.playbackRate = Math.max(0.25, Math.min(4, Number(clip.properties?.speed) || 1));
      player.volume = Math.max(0, Math.min(1, 10 ** ((Number(clip.properties?.volume) || 0) / 20)));
      await player.play();
    }));
    if (attempts.some((result) => result.status === 'fulfilled')) setPlaying(true);
    else setNotice('O navegador não conseguiu reproduzir esta mídia. Gere ou selecione um proxy compatível.');
  };
  const setProperty = (field, value) => selected && commit((current) => (autoKeyframe
    ? addPropertyKeyframe(current, selected.id, field, { value: Number(value) })
    : updateClipProperties(current, selected.id, { [field]: Number(value) })));
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
    try { downloadExport(await exportTimeline({ name: document.name, tracks: document.tracks })); }
    catch (error) { setNotice(error?.message || 'Não foi possível exportar a sequência.'); }
    finally { setExporting(false); }
  };
  const addText = (caption = false) => {
    if (!textValue.trim()) return;
    const clipId = `text-${Date.now()}`;
    commit((current) => addTextClip(current, textValue, { properties: { text: textValue, caption, fontSize: caption ? 34 : 54, y: caption ? 34 : 0 } }));
    setTextValue(''); setActivePanel(caption ? 'captions' : 'text'); setNotice(`${caption ? 'Legenda' : 'Texto'} adicionado no playhead.`);
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
    const onKeyDown = (event) => {
      const editingField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName);
      if (editingField) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
      else if (event.key.toLowerCase() === 's') { event.preventDefault(); applySplit(); }
      else if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
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
  const startClipGesture = (event, clip, mode = 'move') => {
    if (activeTool !== 'select') return;
    const canvas = event.currentTarget.closest('[data-track-canvas]');
    if (!canvas) return;
    event.preventDefault(); event.stopPropagation();
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* gesture remains usable without capture */ }
    const canvasBounds = canvas.getBoundingClientRect();
    const pointerTime = pointerToTimelineTime(event.clientX, canvasBounds, scaleDuration);
    pointerGestureRef.current = {
      clipId: clip.id,
      bounds: { left: canvasBounds.left, width: canvasBounds.width },
      duration: scaleDuration,
      mode,
      offset: pointerTime - clip.start,
    };
    setSelectedClipId(clip.id);
    beginGesture();
  };
  const updateClipGesture = (event) => {
    const gesture = pointerGestureRef.current;
    if (!gesture) return;
    const pointerTime = pointerToTimelineTime(event.clientX, gesture.bounds, gesture.duration);
    if (gesture.mode === 'move') {
      const hoveredTrack = globalThis.document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.('[data-track-id]');
      updateTransient((current) => moveClip(current, gesture.clipId, { start: pointerTime - gesture.offset, trackId: hoveredTrack?.dataset.trackId }));
    } else updateTransient((current) => trimClip(current, gesture.clipId, { edge: gesture.mode, time: pointerTime }));
  };
  const endClipGesture = () => {
    if (!pointerGestureRef.current) return;
    pointerGestureRef.current = null;
    finishGesture();
    setNotice('Edição aplicada. Desfazer restaura o gesto inteiro.');
  };
  const moduleItems = [
    ['media', FolderOpen, 'Arquivos'], ['audio', Music, 'Áudio'], ['text', Type, 'Texto'],
    ['elements', Sparkles, 'Elementos'], ['effects', Wand2, 'Efeitos'], ['captions', Captions, 'Legendas'],
    ['adjust', SlidersHorizontal, 'Ajustes'],
  ];

  return (
    <div className={`${embedded ? 'min-h-[760px]' : '-m-4 min-h-[calc(100vh-4rem)]'} flex flex-col bg-[#020817] p-4 text-slate-100`}>
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">Editor não destrutivo · mídia local e acervo</p>
          <h1 className="text-2xl font-bold">Timeline 2</h1>
          <p className="text-xs text-slate-400">{document.name} · {formatTime(document.duration)} · {document.fps} fps</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label="Desfazer" className="w2-button disabled:opacity-40"><Undo2 size={14} /> Desfazer</button>
          <button type="button" onClick={redo} disabled={!canRedo} aria-label="Refazer" className="w2-button disabled:opacity-40"><Redo2 size={14} /> Refazer</button>
          <button type="button" onClick={() => localStorage.setItem('mm_timeline2_project', JSON.stringify(document))} className="w2-button"><Save size={14} /> Salvar projeto</button>
          <button type="button" onClick={exportSelected} disabled={exporting || selected?.kind !== 'video' || !selected?.assetId} title="Renderiza os cortes do clipe selecionado em MP4" className="w2-button border-emerald-600 text-emerald-300 disabled:opacity-40"><Download size={14} /> {exporting ? 'Renderizando…' : 'Exportar clipe'}</button>
          <button type="button" onClick={exportSequence} disabled={exporting || !document.tracks.find((track) => track.id === 'v1')?.clips.some((clip) => clip.assetId)} title="Renderiza todos os cortes da trilha principal em um MP4" className="w2-button border-violet-600 text-violet-300 disabled:opacity-40"><Download size={14} /> Exportar sequência</button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[260px_minmax(500px,1fr)_280px] grid-rows-[minmax(300px,42vh)_1fr] gap-2 overflow-hidden">
        <aside className="w2-panel grid min-h-0 grid-cols-[48px_1fr] overflow-hidden">
          <nav aria-label="Módulos do editor" className="flex flex-col items-center gap-1 border-r border-slate-800 bg-slate-950/80 py-2">
            {moduleItems.map(([id, Icon, label]) => <button key={id} type="button" onClick={() => setActivePanel(id)} aria-label={label} title={label} className={`grid size-10 place-items-center rounded-lg ${activePanel === id ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon size={18} /></button>)}
          </nav>
          <div className="flex min-w-0 flex-col p-3">
            {(activePanel === 'media' || activePanel === 'audio') && <>
              <div className="flex items-center justify-between"><h2 className="text-xs font-bold uppercase text-slate-400">{activePanel === 'audio' ? 'Áudio' : 'Arquivos'}</h2><button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="w2-button disabled:opacity-50"><Upload size={13} /> {uploading ? 'Enviando…' : 'Importar'}</button></div>
              <input ref={fileInputRef} aria-label="Importar vídeos e áudios" type="file" multiple accept="video/*,audio/*" onChange={importFiles} className="hidden" />
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-950 p-1"><button type="button" onClick={() => setLibraryTab('project')} className={`rounded px-2 py-2 text-xs ${libraryTab === 'project' ? 'bg-sky-600 font-bold' : 'text-slate-400'}`}>Projeto</button><button type="button" onClick={() => setLibraryTab('acervo')} className={`rounded px-2 py-2 text-xs ${libraryTab === 'acervo' ? 'bg-sky-600 font-bold' : 'text-slate-400'}`}><Archive size={12} className="mr-1 inline" /> Acervo</button></div>
              <input aria-label="Pesquisar na biblioteca" placeholder="Pesquisar mídias..." className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
              <div className="mt-3 min-h-0 space-y-2 overflow-y-auto">
                {(libraryTab === 'acervo' ? acervoMedia : projectMedia).filter((media) => activePanel !== 'audio' || media.kind === 'audio').map((media) => (
                  <div key={`${libraryTab}-${media.id}-${media.src || ''}`} draggable onDragStart={(event) => event.dataTransfer.setData('application/x-timeline2-media', JSON.stringify(media))} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2 hover:border-sky-700">
                    <span className={`grid h-10 w-12 shrink-0 place-items-center rounded text-lg ${trackColor[media.kind]}`}>{media.icon || (media.kind === 'audio' ? '🎵' : '🎬')}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{media.name}</span><span className="text-[10px] text-slate-500">{media.origin === 'acervo' ? 'Acervo' : 'Arquivo local'} · {formatTime(media.duration)}</span></span>
                    <button type="button" onClick={() => addToTimeline(media)} aria-label={`Adicionar ${media.name}`} className="grid size-7 shrink-0 place-items-center rounded bg-sky-500 text-slate-950"><Plus size={14} /></button>
                  </div>
                ))}
                {libraryTab === 'project' && !projectMedia.length && <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl border border-dashed border-slate-700 p-6 text-xs text-slate-400"><Upload className="mx-auto mb-2" />Arraste ou selecione vídeos e áudios</button>}
              </div>
            </>}
            {(activePanel === 'text' || activePanel === 'captions') && <div><h2 className="text-xs font-bold uppercase text-slate-400">{activePanel === 'captions' ? 'Legendas' : 'Texto'}</h2><textarea value={textValue} onChange={(event) => setTextValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); addText(activePanel === 'captions'); } }} aria-label={activePanel === 'captions' ? 'Texto da legenda' : 'Texto do elemento'} placeholder={activePanel === 'captions' ? 'Digite a legenda e pressione Enter...' : 'Digite o texto e pressione Enter...'} className="mt-3 h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm" /><button type="button" onClick={() => addText(activePanel === 'captions')} className="mt-3 w2-button w-full justify-center"><Plus size={14} /> Adicionar no playhead</button></div>}
            {activePanel === 'elements' && <div><h2 className="text-xs font-bold uppercase text-slate-400">Elementos</h2><div className="mt-3 grid grid-cols-2 gap-2">{['◼ Forma', '● Círculo', '→ Seta', '★ Destaque'].map((item) => <button key={item} type="button" onClick={() => { setTextValue(item); commit((current) => addTextClip(current, item, { properties: { text: item, fontSize: 64 } })); setNotice(`${item} adicionado.`); }} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs hover:border-sky-500">{item}</button>)}</div></div>}
            {activePanel === 'effects' && <div><h2 className="text-xs font-bold uppercase text-slate-400">Efeitos rápidos</h2><div className="mt-3 space-y-2">{[['Fade 50%', { opacity: 50 }], ['Zoom 120%', { scale: 120 }], ['Girar 15°', { rotation: 15 }], ['Velocidade 2x', { speed: 2 }]].map(([label, values]) => <button key={label} type="button" disabled={!selected} onClick={() => commit((current) => updateClipProperties(current, selected.id, values))} className="w2-button w-full justify-center disabled:opacity-40">{label}</button>)}</div></div>}
            {activePanel === 'adjust' && <div><h2 className="text-xs font-bold uppercase text-slate-400">Ajustes</h2><p className="mt-3 text-xs leading-5 text-slate-400">Use o Inspetor à direita para posição, trim, transformação, velocidade e áudio do clipe selecionado.</p><button type="button" onClick={() => commit(toggleSnapping)} className="mt-4 w2-button w-full justify-center"><Magnet size={14} /> Snapping {document.snapEnabled ? 'ligado' : 'desligado'}</button></div>}
          </div>
        </aside>

        <main className="w2-panel flex flex-col p-3">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Preview do programa</h2><span className="text-xs text-sky-300">{formatTime(document.playhead)}</span></div>
          <div className="relative grid flex-1 place-items-center overflow-hidden rounded-xl bg-black">
            {activeVisuals.map((clip) => {
              const properties = { opacity: 100, scale: 100, rotation: 0, x: 0, y: 0, volume: 0, speed: 1, ...(clip.properties || {}) };
              if (clip.kind === 'text') return <div key={clip.id} data-testid={`preview-layer-${clip.id}`} onClick={() => setSelectedClipId(clip.id)} className="absolute max-w-[90%] cursor-pointer text-center font-bold text-white drop-shadow-lg" style={{ zIndex: clip.layerIndex, opacity: properties.opacity / 100, fontSize: `${properties.fontSize || 54}px`, transform: `translate(${properties.x}px, ${properties.y}px) scale(${properties.scale / 100}) rotate(${properties.rotation}deg)` }}>{properties.text || clip.name}</div>;
              return <video key={clip.id} data-testid={`preview-layer-${clip.id}`} ref={(node) => { if (node) mediaRefs.current.set(clip.id, node); else mediaRefs.current.delete(clip.id); }} src={clip.src} preload="metadata" onClick={() => setSelectedClipId(clip.id)} className="absolute max-h-full max-w-full cursor-pointer transition-transform" style={{ zIndex: clip.layerIndex, opacity: properties.opacity / 100, transform: `translate(${properties.x}px, ${properties.y}px) scale(${properties.scale / 100}) rotate(${properties.rotation}deg)` }} onTimeUpdate={(event) => { if (clip.id === primaryClock?.id && playing) { const programTime = clip.start + ((event.currentTarget.currentTime - clip.sourceIn) / Math.max(0.25, Number(properties.speed) || 1)); updateTransient((current) => setPlayhead(current, programTime)); } }} onEnded={() => setPlaying(false)} />;
            })}
            {activeAudio.map((clip) => <audio key={clip.id} data-testid={`preview-audio-${clip.id}`} ref={(node) => { if (node) mediaRefs.current.set(clip.id, node); else mediaRefs.current.delete(clip.id); }} src={clip.src} preload="metadata" onTimeUpdate={(event) => { if (clip.id === primaryClock?.id && playing) { const speed = Math.max(0.25, Number(clip.properties?.speed) || 1); updateTransient((current) => setPlayhead(current, clip.start + ((event.currentTarget.currentTime - clip.sourceIn) / speed))); } }} onEnded={() => setPlaying(false)} />)}
            {!activeVisuals.length && <div className="text-center"><div className="text-6xl">{activeAudio.length ? '🎵' : '🎬'}</div><p className="mt-3 text-sm font-semibold">{activeAudio[0]?.name || selected?.name || 'Posicione a agulha sobre um clipe'}</p><p className="mt-1 text-xs text-slate-500">{selected ? 'O preview segue a agulha e as camadas ativas.' : 'Importe um arquivo ou escolha no Acervo'}</p></div>}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={togglePlayback} disabled={!activeClips.some((clip) => clip.src)} aria-label={playing ? 'Pausar' : 'Reproduzir'} className="grid size-11 place-items-center rounded-full bg-sky-500 text-slate-950 disabled:opacity-40">{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button>
            <input aria-label="Playhead" type="range" min="0" max={document.duration} step={1 / document.fps} value={document.playhead} onChange={(event) => updateTransient((current) => setPlayhead(current, event.target.value))} className="flex-1" />
          </div>
        </main>

        <aside className="w2-panel min-h-0 overflow-y-auto p-3">
          <h2 className="text-xs font-bold uppercase text-slate-400">Inspetor</h2>
          {selected ? <div className="mt-3 space-y-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-sm font-bold">{selected.name}</p><p className="text-[10px] text-slate-500">{selected.id} · {selected.trackId}</p></div>
            <label className="block text-xs text-slate-400">Posição na timeline<input aria-label="Posição do clipe" type="number" step="0.001" value={Number(selected.start.toFixed(3))} onChange={(event) => commit((current) => moveClip(current, selected.id, { start: Number(event.target.value) }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" /></label>
            <label className="block text-xs text-slate-400">Início do conteúdo (trim)<input aria-label="Início do clipe" type="number" step="0.001" value={Number(selected.start.toFixed(3))} onChange={(event) => changeTrim('start', event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" /></label>
            <label className="block text-xs text-slate-400">Fim na timeline<input aria-label="Fim do clipe" type="number" step="0.001" value={Number((selected.start + selected.duration).toFixed(3))} onChange={(event) => changeTrim('end', event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100" /></label>
            <dl className="grid grid-cols-2 gap-2 text-xs"><dt className="text-slate-500">Source IN</dt><dd>{formatTime(selected.sourceIn)}</dd><dt className="text-slate-500">Source OUT</dt><dd>{formatTime(selected.sourceOut)}</dd></dl>
            <div className="border-t border-slate-800 pt-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase text-sky-300">Transformação</h3><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={autoKeyframe} onChange={(event) => setAutoKeyframe(event.target.checked)} /> Auto keyframe</label></div>{[
              ['Posição X', 'x', -500, 500, 1], ['Posição Y', 'y', -500, 500, 1], ['Escala', 'scale', 10, 300, 1], ['Rotação', 'rotation', -180, 180, 1], ['Opacidade', 'opacity', 0, 100, 1],
            ].map(([label, field, min, max, step]) => { const currentKeyframe = keyframeAtPlayhead(field); return <div key={field} className="mb-3 rounded-lg border border-slate-800 bg-slate-950/40 p-2"><span className="mb-1 flex items-center justify-between text-xs text-slate-400"><span>{label}</span><span className="flex items-center gap-2"><strong className="text-slate-200">{Number(Number(selectedProperties[field]).toFixed(3))}{['scale', 'opacity'].includes(field) ? '%' : ''}</strong><button type="button" onClick={() => toggleKeyframe(field)} aria-label={`${currentKeyframe ? 'Remover' : 'Adicionar'} keyframe ${label}`} title="Ativar/desativar keyframe neste quadro" className={currentKeyframe ? 'text-amber-300' : 'text-slate-600 hover:text-slate-200'}><Diamond size={13} fill={currentKeyframe ? 'currentColor' : 'none'} /></button></span></span><input aria-label={label} type="range" min={min} max={max} step={step} value={selectedProperties[field]} onChange={(event) => setProperty(field, event.target.value)} className="w-full" />{currentKeyframe && <div className="mt-2 flex items-center justify-between gap-2"><label className="text-[10px] text-slate-500">Curva<select aria-label={`Curva do keyframe ${label}`} value={currentKeyframe.easing || 'smooth'} onChange={(event) => setKeyframeCurve(field, event.target.value)} className="ml-2 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"><option value="hold">Degrau</option><option value="linear">Linear</option><option value="smooth">Suave</option><option value="bezier">Bézier</option></select></label><span className="h-7 w-16 rounded border border-slate-700 bg-slate-900 p-1"><svg viewBox="0 0 56 20" className="h-full w-full" aria-label={`Gráfico da curva ${label}`}><path d={currentKeyframe.easing === 'hold' ? 'M1 19 H54 V1' : currentKeyframe.easing === 'linear' ? 'M1 19 L55 1' : 'M1 19 C18 19 38 1 55 1'} fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-400" /></svg></span></div>}</div>; })}</div>
            {selected.kind !== 'text' && <div className="border-t border-slate-800 pt-3"><h3 className="mb-3 text-xs font-bold uppercase text-emerald-300">Tempo e áudio</h3><label className="mb-3 block text-xs text-slate-400"><span className="mb-1 flex justify-between"><span>Velocidade</span><strong>{selectedProperties.speed}x</strong></span><input aria-label="Velocidade" type="range" min="0.25" max="4" step="0.25" value={selectedProperties.speed} onChange={(event) => setProperty('speed', event.target.value)} className="w-full" /></label><label className="block text-xs text-slate-400"><span className="mb-1 flex justify-between"><span>Volume</span><strong>{selectedProperties.volume} dB</strong></span><input aria-label="Volume" type="range" min="-60" max="6" step="1" value={selectedProperties.volume} onChange={(event) => setProperty('volume', event.target.value)} className="w-full" /></label></div>}
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
            <button type="button" onClick={() => selected && commit((current) => duplicateClip(current, selected.id))} disabled={!selected} aria-label="Duplicar clipe" title="Duplicar" className="w2-button disabled:opacity-40"><Copy size={14} /></button>
            <button type="button" onClick={removeSelected} disabled={!selected} aria-label="Excluir clipe" title="Excluir (Delete)" className="w2-button disabled:opacity-40"><Trash2 size={14} /></button>
            <button type="button" onClick={rippleRemoveSelected} disabled={!selected} aria-label="Excluir com ripple" title="Ripple delete" className="w2-button disabled:opacity-40"><Crop size={14} /></button>
            <button type="button" onClick={() => commit(toggleSnapping)} aria-label={document.snapEnabled ? 'Desativar snapping' : 'Ativar snapping'} className={`w2-button ${document.snapEnabled ? 'border-sky-500 text-sky-300' : ''}`}><Magnet size={14} /> Snapping</button>
            <button type="button" onClick={() => commit((current) => addMarker(current, { label: `Marcador ${current.markers.length + 1}` }))} aria-label="Adicionar marcador" title="Marcador no playhead" className="w2-button"><BookmarkPlus size={14} /></button>
            <div className="ml-auto flex items-center gap-2 text-xs"><ZoomIn size={14} /><input aria-label="Zoom da Timeline 2" type="range" min="0.25" max="8" step="0.25" value={document.zoom} onChange={(event) => commit((current) => setZoom(current, event.target.value))} /><span className="w-10 text-right">{Math.round(document.zoom * 100)}%</span></div>
          </div>
          <div className="border-b border-slate-800 px-3 py-1 text-[10px] text-sky-300" role="status">{notice}</div>
          <div className="relative flex-1 overflow-auto bg-[#031022] p-3">
            <div role="slider" aria-label="Régua e agulha da timeline" aria-valuemin="0" aria-valuemax={scaleDuration} aria-valuenow={document.playhead} onPointerDown={(event) => { try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* pointer may already be inactive */ } movePlayheadFromPointer(event); }} onPointerMove={(event) => { if (event.buttons === 1) movePlayheadFromPointer(event); }} className="relative ml-32 h-7 shrink-0 cursor-ew-resize border-b border-slate-700" style={{ width: `${timelineGeometry.width}px` }}><div className="pointer-events-none flex justify-between text-[10px] text-slate-500"><span>00:00</span><span>{formatTime(scaleDuration / 2)}</span><span>{formatTime(scaleDuration)}</span></div>{document.markers.map((marker) => <span key={marker.id} title={`${marker.label} · ${formatTime(marker.time)}`} className="absolute bottom-0 h-3 w-0.5 bg-amber-400" style={{ left: `${marker.time * timelineGeometry.pixelsPerSecond}px` }} />)}<span className="pointer-events-none absolute -bottom-2 z-30 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-rose-500" style={{ left: `${document.playhead * timelineGeometry.pixelsPerSecond}px` }} /></div>
            <div className="pointer-events-none absolute bottom-3 top-10 z-20 w-px bg-rose-500" style={{ left: `${140 + (document.playhead * timelineGeometry.pixelsPerSecond)}px` }} />
            {document.tracks.map((track) => (
              <div key={track.id} data-track-id={track.id} data-testid={`timeline2-track-${track.id}`} className="flex h-12 border-b border-slate-800" style={{ width: `${128 + timelineGeometry.width}px` }}>
                <div className="flex w-32 shrink-0 items-center gap-1 border-r border-slate-700 px-2"><span className="min-w-0 flex-1"><strong className="block text-xs uppercase">{track.id}</strong><small className="block truncate text-[9px] text-slate-500">{track.name}</small></span><button type="button" onClick={() => commit((current) => toggleTrackState(current, track.id, 'locked'))} aria-label={`${track.locked ? 'Destravar' : 'Travar'} ${track.name}`} className="text-slate-500 hover:text-white">{track.locked ? <Lock size={11} /> : <Unlock size={11} />}</button>{track.kind === 'audio' && <button type="button" onClick={() => commit((current) => toggleTrackState(current, track.id, 'muted'))} aria-label={`${track.muted ? 'Ativar' : 'Silenciar'} ${track.name}`} className="text-slate-500 hover:text-white">{track.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>}{track.kind !== 'audio' && <button type="button" onClick={() => commit((current) => toggleTrackState(current, track.id, 'hidden'))} aria-label={`${track.hidden ? 'Mostrar' : 'Ocultar'} ${track.name}`} className="text-slate-500 hover:text-white">{track.hidden ? <EyeOff size={11} /> : <Eye size={11} />}</button>}</div>
                <div data-track-canvas aria-label={`Área da faixa ${track.name}`} className={`relative shrink-0 ${track.hidden || track.muted ? 'opacity-35' : ''}`} onPointerDown={(event) => { if (event.target === event.currentTarget) movePlayheadFromPointer(event); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnTrack(event, track)} style={{ width: `${timelineGeometry.width}px` }}>
                  {track.clips.map((clip) => <button key={clip.id} type="button" onPointerDown={(event) => startClipGesture(event, clip)} onPointerMove={updateClipGesture} onPointerUp={endClipGesture} onPointerCancel={endClipGesture} onClick={() => { setSelectedClipId(clip.id); if (activeTool === 'blade') commit((current) => splitClip(current, clip.id, current.playhead)); }} title="Arraste para mover entre trilhas; use as alças para aparar" className={`group absolute top-1 h-10 touch-none cursor-grab overflow-hidden rounded border px-3 text-left text-[10px] shadow active:cursor-grabbing ${trackColor[clip.kind]} ${selectedClipId === clip.id ? 'border-amber-300 ring-2 ring-amber-300/50' : 'border-white/10'}`} style={{ left: `${clip.start * timelineGeometry.pixelsPerSecond}px`, width: `${Math.max(8, clip.duration * timelineGeometry.pixelsPerSecond)}px` }}><span onPointerDown={(event) => startClipGesture(event, clip, 'start')} className="absolute inset-y-0 left-0 z-10 w-2 touch-none cursor-ew-resize bg-white/30 opacity-0 group-hover:opacity-100" /><span className="block truncate font-bold">{clip.name}</span><span className="opacity-70">{formatTime(clip.duration)}</span><span onPointerDown={(event) => startClipGesture(event, clip, 'end')} className="absolute inset-y-0 right-0 z-10 w-2 touch-none cursor-ew-resize bg-white/30 opacity-0 group-hover:opacity-100" /></button>)}
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
