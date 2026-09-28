import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { formatDuration } from '../../data';

const activeAt = (clips, time) => clips.find((clip) => time >= clip.start && time < clip.start + clip.duration) || clips.at(-1);
const formatPlayerTime = (value) => formatDuration(value) === '—' ? '00:00' : formatDuration(value);

export default function FinalTimelinePlayer({ timeline }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const rangeStart = Math.max(0, Number(timeline?.inPoint) || 0);
  const fullDuration = Math.max(0, Number(timeline?.duration) || 0);
  const rangeEnd = timeline?.outPoint == null ? fullDuration : Math.max(rangeStart, Math.min(fullDuration, Number(timeline.outPoint) || 0));
  const [playhead, setPlayhead] = useState(rangeStart);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoClips = useMemo(() => (timeline?.tracks || []).filter((track) => track.kind === 'video' && !track.hidden).flatMap((track) => track.clips || []).filter((clip) => clip.src).sort((a, b) => a.start - b.start), [timeline]);
  const audioClips = useMemo(() => (timeline?.tracks || []).filter((track) => track.kind === 'audio' && !track.muted).flatMap((track) => track.clips || []).filter((clip) => clip.src).sort((a, b) => a.start - b.start), [timeline]);
  const textClips = useMemo(() => (timeline?.tracks || []).filter((track) => track.kind === 'text' && !track.hidden).flatMap((track) => track.clips || []), [timeline]);
  const activeVideo = activeAt(videoClips, playhead);
  const activeAudio = activeAt(audioClips, playhead);
  const activeTexts = textClips.filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration);

  const syncPlayer = (player, clip) => {
    if (!player || !clip) return;
    const sourceTime = Math.max(0, Number(clip.sourceIn || 0) + (playhead - clip.start) * Math.max(0.25, Number(clip.properties?.speed) || 1));
    if (Number.isFinite(sourceTime) && Math.abs(player.currentTime - sourceTime) > 0.12) player.currentTime = sourceTime;
  };
  useEffect(() => {
    syncPlayer(videoRef.current, activeVideo);
    syncPlayer(audioRef.current, activeAudio);
  }, [playhead, activeVideo?.id, activeAudio?.id]);
  useEffect(() => {
    setPlayhead((current) => Math.max(rangeStart, Math.min(rangeEnd, current)));
  }, [rangeStart, rangeEnd]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted || Boolean(activeVideo?.properties?.audioDisabled);
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted, activeVideo?.id]);

  const play = async () => {
    const players = [[videoRef.current, activeVideo], [audioRef.current, activeAudio]].filter(([player, clip]) => player && clip);
    if (!players.length) return;
    syncPlayer(videoRef.current, activeVideo); syncPlayer(audioRef.current, activeAudio);
    const results = await Promise.allSettled(players.map(([player]) => player.play()));
    if (results.some((result) => result.status === 'fulfilled')) setPlaying(true);
  };
  const pause = () => { videoRef.current?.pause(); audioRef.current?.pause(); setPlaying(false); };
  const updateFromVideo = (event) => {
    if (!playing || !activeVideo) return;
    const speed = Math.max(0.25, Number(activeVideo.properties?.speed) || 1);
    const next = activeVideo.start + ((event.currentTarget.currentTime - Number(activeVideo.sourceIn || 0)) / speed);
    const bounded = Math.max(rangeStart, Math.min(rangeEnd, next));
    setPlayhead(bounded);
    if (bounded >= rangeEnd) pause();
  };

  return <article className="w2-panel overflow-hidden" data-testid="final-timeline-player">
    <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div><h3 className="font-bold">Prévia do vídeo final</h3><p className="text-[11px] text-slate-500">Confira a sequência montada antes de renderizar, enviar à fila ou gerar aprovação.</p></div><span className="rounded bg-slate-900 px-2 py-1 font-mono text-xs text-sky-300">{formatPlayerTime(playhead)} / {formatPlayerTime(rangeEnd)}</span></header>
    <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div>
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-black">
          {activeVideo ? <video ref={videoRef} data-testid="final-timeline-video" key={activeVideo.id} src={activeVideo.src} preload="metadata" onLoadedMetadata={() => syncPlayer(videoRef.current, activeVideo)} onTimeUpdate={updateFromVideo} onEnded={() => { const next = Math.min(rangeEnd, activeVideo.start + activeVideo.duration); setPlayhead(next); if (next >= rangeEnd) setPlaying(false); }} className="h-full w-full object-contain" /> : <p className="text-sm text-slate-500">A Timeline ainda não possui vídeo reproduzível.</p>}
          {activeTexts.map((clip) => <div key={clip.id} className="pointer-events-none absolute max-w-[90%] text-center font-bold text-white drop-shadow-lg" style={{ left: '50%', top: '75%', zIndex: 5, opacity: (clip.properties?.opacity ?? 100) / 100, fontSize: `${clip.properties?.fontSize || 36}px`, transform: `translate(-50%, -50%) translate(${clip.properties?.x || 0}px, ${clip.properties?.y || 0}px) scale(${(clip.properties?.scale || 100) / 100}) rotate(${clip.properties?.rotation || 0}deg)` }}>{clip.properties?.text || clip.name}</div>)}
          {activeAudio && <audio ref={audioRef} key={activeAudio.id} src={activeAudio.src} preload="metadata" onLoadedMetadata={() => syncPlayer(audioRef.current, activeAudio)} />}
        </div>
        <div className="mt-3 flex items-center gap-2"><button type="button" aria-label="Reproduzir vídeo final" onClick={play} disabled={!activeVideo} className="grid size-10 place-items-center rounded-full bg-sky-500 text-slate-950 disabled:opacity-40"><Play size={17} fill="currentColor" /></button><button type="button" aria-label="Pausar vídeo final" onClick={pause} disabled={!activeVideo} className="grid size-9 place-items-center rounded-full bg-slate-800 disabled:opacity-40"><Pause size={15} /></button><button type="button" aria-label={muted ? 'Ativar áudio da prévia final' : 'Silenciar prévia final'} onClick={() => setMuted((value) => !value)} className="grid size-9 place-items-center rounded-full bg-slate-800">{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button><input aria-label="Posição do vídeo final" type="range" min={rangeStart} max={Math.max(rangeEnd, rangeStart + 0.01)} step={1 / (Number(timeline?.fps) || 30)} value={playhead} onChange={(event) => { pause(); setPlayhead(Number(event.target.value)); }} className="flex-1 accent-sky-500" /><button type="button" aria-label="Voltar ao início do vídeo final" onClick={() => { pause(); setPlayhead(rangeStart); }} className="grid size-9 place-items-center rounded-full bg-slate-800"><RotateCcw size={15} /></button></div>
      </div>
      <aside className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Em reprodução</p><strong className="mt-2 block text-sm text-slate-100">{activeVideo?.name || 'Sem clipe'}</strong><dl className="mt-4 grid grid-cols-2 gap-y-2"><dt className="text-slate-500">Início</dt><dd>{formatPlayerTime(activeVideo?.start || 0)}</dd><dt className="text-slate-500">Duração</dt><dd>{formatPlayerTime(activeVideo?.duration || 0)}</dd><dt className="text-slate-500">Textos ativos</dt><dd>{activeTexts.length}</dd><dt className="text-slate-500">Áudio separado</dt><dd>{activeAudio ? 'Sim' : 'Não'}</dd></dl></aside>
    </div>
  </article>;
}
