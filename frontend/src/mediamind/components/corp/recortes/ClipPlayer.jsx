import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Flag } from 'lucide-react';
import { fmt } from './clipModel';
import { resolveMediaUrl } from '../../../../api/media';

// Player de seleção IN/OUT com timeline + overlay de trechos virais/CGs.
// seekRef permite que os painéis chamem seekRef.current(ms).
export default function ClipPlayer({ source_url, captions = [], videoCuts = [], overlays = [], fit = 'fill', in_ms = 0, out_ms = 0, segments = [], onSetIn, onSetOut, onReady, onMoveLayer, seekRef }) {
  const vref = useRef(null);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    const onLoaded = () => { setDur(v.duration * 1000); onReady?.(v.duration * 1000); };
    const onTime = () => {
      let current = v.currentTime * 1000;
      // Accommodate overlapping and adjacent removed intervals without looping.
      for (const cut of [...videoCuts].sort((a, b) => a.start_ms - b.start_ms)) {
        if (cut.end_ms > cut.start_ms && current >= cut.start_ms && current < cut.end_ms) current = cut.end_ms;
      }
      if (current !== v.currentTime * 1000) v.currentTime = current / 1000;
      setTime(current);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [source_url, videoCuts]);

  useEffect(() => {
    if (seekRef) seekRef.current = (ms) => { if (vref.current) vref.current.currentTime = Math.max(0, (ms || 0) / 1000); };
  }, [seekRef]);

  // Pausa ao chegar no OUT durante reprodução do trecho.
  useEffect(() => {
    const v = vref.current;
    if (!v || !out_ms) return;
    if (time >= out_ms && playing) v.pause();
  }, [time, out_ms, playing]);

  function togglePlay() {
    const v = vref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setPlaying(false)); else v.pause();
  }
  function seekTo(ms) { if (vref.current) vref.current.currentTime = Math.max(0, (ms || 0) / 1000); }

  const total = dur || Math.max(1, out_ms, ...captions.map((item) => item.end_ms || 0), ...overlays.map((item) => item.end_ms || 0));
  function seekFromPointer(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(bounds.width, 1)));
    seekTo(ratio * total);
  }
  const pct = (t) => `${(t / total) * 100}%`;
  const activeCaption = captions.find((caption) => time >= caption.start_ms && time <= caption.end_ms);
  const captionPosition = activeCaption?.posicao || 'bottom';
  const captionStyle = activeCaption?.estilo || 'impacto';
  const captionClasses = {
    impacto: 'bg-black/80 text-lg font-black uppercase tracking-tight text-white shadow-lg',
    dinamico: 'bg-amber-300 text-base font-black text-slate-950 shadow-lg',
    limpo: 'bg-slate-950/75 text-sm font-semibold text-white',
  }[captionStyle];
  const captionPlacement = { top: 'top-4', center: 'top-1/2 -translate-y-1/2', bottom: 'bottom-4' }[captionPosition];
  function dropLayer(event) {
    event.preventDefault();
    const layer = overlays.find((item) => item.id === event.dataTransfer.getData('text/plain'));
    if (!layer || !onMoveLayer || !Number.isFinite(event.clientX)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const length = Math.max(0, layer.end_ms - layer.start_ms);
    const start = Math.max(0, Math.min(total - length, Math.round(((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * total)));
    onMoveLayer(layer.id, start, start + length);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-800 bg-black">
        {source_url ? <video ref={vref} src={source_url} className={`h-full w-full ${fit === 'fit' ? 'object-contain' : 'object-cover'}`} controls={false} playsInline preload="metadata" /> : <p className="p-6 text-center text-xs text-slate-400">Nenhuma mídia vinculada ao corte.</p>}
        {overlays.filter((layer) => layer.tipo !== 'logo' && time >= layer.start_ms && time < layer.end_ms).map((layer, index) => layer.tipo === 'imagem' ? <img key={layer.id} src={resolveMediaUrl(layer.source_url)} alt={layer.titulo} className="pointer-events-none absolute right-[5%] top-[5%] max-h-[35%] max-w-[35%] object-contain" /> : layer.template === 'barra-editorial' ? <div key={layer.id} aria-label="GC barra editorial em prévia" className="pointer-events-none absolute inset-x-[7%] bottom-[12%] overflow-hidden p-[1%]" style={{ backgroundColor: layer.cor_barra || '#ffcc00', clipPath: `inset(0 ${100 - Math.min(1, Math.max(0, (time - layer.start_ms) / 600), Math.max(0, (layer.end_ms - time) / 600)) * 100}% 0 0)` }}><div className="overflow-hidden px-3 py-2 text-center font-bold" style={{ backgroundColor: layer.cor_painel || '#ffffff', color: layer.cor_texto || '#000000', fontFamily: layer.fonte || 'Arial', fontSize: `${layer.tamanho || 24}px` }}><div style={{ transform: `translateY(${Math.max(0, 1 - (time - layer.start_ms - 250) / 500) * 100}%)` }}>{layer.titulo}</div><div style={{ transform: `translateY(${-Math.max(0, 1 - (time - layer.start_ms - 250) / 500) * 100}%)` }}>{layer.subtitulo}</div></div></div> : <div key={layer.id} className="pointer-events-none absolute inset-x-4 flex justify-center" style={{ top: `${8 + index * 10}%` }}><span className="rounded bg-slate-950/80 px-3 py-1 text-center text-sm font-bold text-white">{layer.titulo}</span></div>)}
        {activeCaption?.texto && <div aria-label="Legenda em prévia" className={`pointer-events-none absolute inset-x-4 flex justify-center ${captionPlacement}`}><span className={`max-w-[90%] rounded px-3 py-1.5 text-center ${captionClasses}`}>{activeCaption.texto}</span></div>}
      </div>

      <div className="mt-3">
        <div aria-label="Timeline do corte" role="slider" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(time)} onClick={seekFromPointer} className="relative h-14 cursor-pointer select-none rounded-lg border border-slate-800 bg-slate-950/60">
          {segments.map((s, i) => (
            <div key={i} className={`absolute top-1 h-3 rounded ${s.color || 'bg-sky-500/40'}`} style={{ left: pct(s.start_ms), width: `calc(${((s.end_ms - s.start_ms) / total) * 100}%)` }} title={s.title} />
          ))}
          {out_ms > 0 && (
            <div className="absolute bottom-1 h-5 rounded border-x border-emerald-500/50 bg-emerald-500/20" style={{ left: pct(in_ms), width: `calc(${((out_ms - in_ms) / total) * 100}%)` }} />
          )}
          <div className="absolute bottom-0 top-0 w-px bg-sky-300" style={{ left: pct(time) }}>
            <div className="-ml-1.5 -top-1 h-3 w-3 rounded-full bg-sky-400" />
          </div>
        </div>
        <div className="mt-2 space-y-1" aria-label="Camadas da timeline">
          <div className="grid grid-cols-[70px_1fr] items-center gap-2 text-[10px] text-slate-400"><span>Vídeo</span><div className="h-5 rounded bg-emerald-900/40" title="Vídeo de origem" /></div>
          <div className="grid grid-cols-[70px_1fr] items-center gap-2 text-[10px] text-slate-400"><span>Legendas</span><div className="relative h-6 rounded bg-slate-900">{captions.map((caption) => <button key={caption.id} type="button" onClick={() => seekTo(caption.start_ms)} title={caption.texto} aria-label={`Ir para legenda ${caption.texto || 'sem texto'}`} className="absolute top-1 h-4 overflow-hidden rounded bg-violet-600/70 text-[9px] text-white" style={{ left: pct(caption.start_ms), width: pct(Math.max(0, caption.end_ms - caption.start_ms)) }}>{caption.texto}</button>)}</div></div>
          <div className="grid grid-cols-[70px_1fr] items-center gap-2 text-[10px] text-slate-400"><span>Textos</span><div aria-label="Trilha de textos" onDragOver={(event) => event.preventDefault()} onDrop={dropLayer} className="relative h-7 rounded border border-dashed border-sky-800 bg-slate-900">{overlays.map((layer) => <button key={layer.id} type="button" draggable={Boolean(onMoveLayer)} onDragStart={(event) => event.dataTransfer.setData('text/plain', layer.id)} onClick={() => seekTo(layer.start_ms)} aria-label={`Mover camada ${layer.titulo}`} className="absolute top-1 h-5 overflow-hidden rounded bg-sky-600 px-1 text-left text-[9px] text-white" style={{ left: pct(layer.start_ms), width: pct(Math.max(0, layer.end_ms - layer.start_ms)) }}>{layer.titulo}</button>)}</div></div>
          <p className="text-[10px] text-slate-500">Arraste textos na trilha para mudar o início. As edições são exibidas na prévia.</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button disabled={!source_url} onClick={togglePlay} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">{playing ? <Pause size={12} /> : <Play size={12} />} {playing ? 'Pausar' : 'Reproduzir'}</button>
          <button onClick={() => seekTo(in_ms)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"><SkipBack size={12} /> IN</button>
          <button onClick={() => seekTo(out_ms)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800">OUT <SkipForward size={12} /></button>
          <button onClick={() => onSetIn?.(Math.min(Math.round(time), out_ms || Math.round(dur)))} className="flex items-center gap-1 rounded-md border border-emerald-700 px-2.5 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-950/40"><Flag size={12} /> Marcar IN</button>
          <button onClick={() => onSetOut?.(Math.max(Math.round(time), in_ms || 0))} className="flex items-center gap-1 rounded-md border border-emerald-700 px-2.5 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-950/40"><Flag size={12} /> Marcar OUT</button>
          <span className="ml-auto text-[11px] text-slate-400">{fmt(time)} / {fmt(dur)}</span>
        </div>
      </div>
    </div>
  );
}
