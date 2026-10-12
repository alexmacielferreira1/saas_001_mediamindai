import { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

const clock = value => {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(n / 60).toString().padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
};

export default function MediaPlayer({ src, poster, markers = [], onTimeChange, title = 'Prévia da mídia' }) {
  const media = useRef(null);
  const frame = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const seek = value => {
    if (!media.current || !Number.isFinite(duration) || duration <= 0) return;
    const next = Math.max(0, Math.min(duration, Number(value) || 0));
    media.current.currentTime = next; setTime(next); onTimeChange?.(next);
  };
  const toggle = async () => {
    if (!media.current || !src) return;
    if (playing) media.current.pause();
    else try { await media.current.play(); setError(''); } catch { setError('Não foi possível reproduzir esta mídia. Confira o arquivo e sua conexão.'); }
  };
  return <section ref={frame} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
    <header className="flex justify-between px-3 py-2 text-xs text-slate-300"><span>{title}</span><span className="font-mono text-sky-400">{clock(time)} / {clock(duration)}</span></header>
    <div className="aspect-video bg-black flex items-center justify-center">
      {src ? <video key={src} ref={media} data-testid="media-player-video" aria-label={title} src={src} poster={poster} preload="metadata" muted={muted} className="h-full w-full object-contain" onLoadedMetadata={event => { setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0); setTime(0); setPlaying(false); setError(''); }} onTimeUpdate={event => { setTime(event.currentTarget.currentTime); onTimeChange?.(event.currentTarget.currentTime); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setError('Mídia indisponível ou formato não suportado.'); }} /> : <p className="px-4 text-center text-xs text-slate-500">Vincule uma mídia para reproduzir a prévia.</p>}
    </div>
    <div className="flex items-center gap-3 p-2 text-slate-300">
      <button type="button" disabled={!src || Boolean(error)} aria-label={playing ? 'Pausar mídia' : 'Reproduzir mídia'} onClick={toggle} className="disabled:opacity-30">{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
      <input aria-label="Posição da mídia" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(time, duration)} disabled={!duration} onChange={event => seek(event.target.value)} className="min-w-0 flex-1 accent-sky-400"/>
      <button type="button" aria-label={muted ? 'Ativar áudio' : 'Silenciar mídia'} onClick={() => setMuted(value => !value)}>{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}</button>
      <button type="button" aria-label="Tela cheia" onClick={() => frame.current?.requestFullscreen?.().catch(() => setError('Tela cheia não disponível.'))}><Maximize size={16}/></button>
    </div>
    {error && <p role="alert" className="p-2 text-xs text-amber-300">{error}</p>}
    {markers.length > 0 && <div className="flex flex-wrap gap-2 border-t border-slate-800 p-2">{markers.map(marker => <button type="button" key={marker.id} onClick={() => seek(marker.time)} className="rounded border border-sky-800 px-2 py-1 text-[10px] text-sky-300">{clock(marker.time)} · {marker.text || marker.label}</button>)}</div>}
  </section>;
}
