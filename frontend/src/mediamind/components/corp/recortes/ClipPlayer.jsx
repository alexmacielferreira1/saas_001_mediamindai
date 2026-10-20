import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Flag, Frame, ZoomIn, ZoomOut, Magnet, AudioWaveform, Volume2, VolumeX } from 'lucide-react';
import { fmt } from './clipModel';
import { resolveMediaUrl } from '../../../../api/media';
import { emojiFor, keywordList, normalizeWord, templateFor, wrapCaptionText } from '../../../lib/captionTools';
import { EDITOR_SHORTCUTS, clampView, fitView, isFullView, peaksInView, resolvePlayerKey, resolveSnap, snapThresholdMs, stepFrames, zoomView } from '../../../lib/clipEditorTools';
import { decodeWaveform } from '../../../lib/clipWaveform';

const FRAME_RATIOS = { '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 };

// Player de seleção IN/OUT com timeline + overlay de trechos virais/CGs.
// seekRef permite que os painéis chamem seekRef.current(ms).
// playheadRef (opcional) expõe a posição atual; onSplitAt/onDeleteAt atendem os atalhos S e Delete.
export default function ClipPlayer({ source_url, captions = [], videoCuts = [], overlays = [], fit = 'fill', in_ms = 0, out_ms = 0, segments = [], onSetIn, onSetOut, onReady, onMoveLayer, seekRef, format = '', focusX = null, captionTemplate = '', captionSettings = null, playheadRef = null, onSplitAt, onDeleteAt }) {
  const vref = useRef(null);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  // Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md: zoom, ímã, forma de onda e atalhos.
  const [view, setView] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [waveform, setWaveform] = useState({ status: 'idle', peaks: [], durationMs: 0, message: '' });
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const keyActionRef = useRef(null);

  useEffect(() => { setWaveform({ status: 'idle', peaks: [], durationMs: 0, message: '' }); setView(null); }, [source_url]);
  useEffect(() => { if (playheadRef) playheadRef.current = time; }, [time, playheadRef]);
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, volume));
    v.muted = muted;
  }, [volume, muted, source_url]);
  useEffect(() => {
    function onKey(event) {
      const action = resolvePlayerKey(event);
      if (action && keyActionRef.current?.(action)) event.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
  const win = clampView(view, total);
  const span = Math.max(1, win.end - win.start);
  const zoomed = !isFullView(view, total);
  function seekFromPointer(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(bounds.width, 1)));
    seekTo(win.start + ratio * span);
  }
  const pct = (t) => `${((t - win.start) / span) * 100}%`;
  const len = (ms) => `${(ms / span) * 100}%`;
  function currentMs() { return vref.current ? vref.current.currentTime * 1000 : time; }
  function zoomBy(factor) {
    const center = time >= win.start && time <= win.end ? time : undefined;
    setView(zoomView(win, factor, total, center));
  }
  function handleKeyAction(action) {
    const now = currentMs();
    const maxMs = dur || total;
    const hasVideo = Boolean(source_url && vref.current);
    const seekBy = (delta) => { seekTo(Math.max(0, Math.min(maxMs, now + delta))); return true; };
    switch (action) {
      case 'toggle-play': if (!hasVideo) return false; togglePlay(); return true;
      case 'seek-backward': return hasVideo && seekBy(-1000);
      case 'seek-forward': return hasVideo && seekBy(1000);
      case 'jump-backward': return hasVideo && seekBy(-5000);
      case 'jump-forward': return hasVideo && seekBy(5000);
      case 'frame-step-backward': if (!hasVideo) return false; seekTo(stepFrames(now, -1, { maxMs })); return true;
      case 'frame-step-forward': if (!hasVideo) return false; seekTo(stepFrames(now, 1, { maxMs })); return true;
      case 'goto-in': if (!hasVideo) return false; seekTo(in_ms); return true;
      case 'goto-out': if (!hasVideo || !out_ms) return false; seekTo(out_ms); return true;
      case 'mark-in': if (!onSetIn) return false; onSetIn(Math.min(Math.round(now), out_ms || Math.round(dur))); return true;
      case 'mark-out': if (!onSetOut) return false; onSetOut(Math.max(Math.round(now), in_ms || 0)); return true;
      case 'split': if (!onSplitAt) return false; onSplitAt(Math.round(now)); return true;
      case 'delete': if (!onDeleteAt) return false; onDeleteAt(Math.round(now)); return true;
      default: return false;
    }
  }
  keyActionRef.current = handleKeyAction;
  async function loadWaveform() {
    setWaveform({ status: 'loading', peaks: [], durationMs: 0, message: 'Gerando forma de onda…' });
    try {
      const result = await decodeWaveform(source_url, { durationMs: dur });
      setWaveform({ status: 'ready', peaks: result.peaks, durationMs: result.durationMs, message: '' });
    } catch (error) {
      setWaveform({ status: 'error', peaks: [], durationMs: 0, message: error?.message || 'Não foi possível gerar a forma de onda.' });
    }
  }
  const visiblePeaks = waveform.status === 'ready' ? peaksInView(waveform.peaks, waveform.durationMs, win) : [];
  const activeCaption = captions.find((caption) => time >= caption.start_ms && time <= caption.end_ms);
  const captionPosition = activeCaption?.posicao || 'bottom';
  const captionStyle = activeCaption?.estilo || captionTemplate || 'impacto';
  const template = templateFor(captionStyle);
  const captionClasses = {
    impacto: 'bg-black/80 text-lg font-black uppercase tracking-tight text-white shadow-lg',
    dinamico: 'bg-amber-300 text-base font-black text-slate-950 shadow-lg',
    limpo: 'bg-slate-950/75 text-sm font-semibold text-white',
    karaoke: 'text-lg font-black uppercase text-white [text-shadow:0_2px_4px_#000]',
    neon: 'text-lg font-black uppercase text-sky-100 [text-shadow:0_0_8px_#22d3ee]',
    contorno: 'text-base font-bold text-white [text-shadow:-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000,1px_1px_0_#000]',
  }[captionStyle] || 'bg-black/80 text-lg font-black uppercase tracking-tight text-white shadow-lg';
  const highlightColor = captionSettings?.highlight || template.highlight;
  const keywords = new Set(keywordList(captionSettings?.keywords));
  const activeWordIndex = template.karaoke && activeCaption?.palavras?.length ? activeCaption.palavras.findIndex((word) => time >= word.start_ms && time < word.end_ms) : -1;
  function renderCaptionText(caption) {
    // Sem configurações explícitas mantém a prévia original (texto inteiro).
    if (!captionSettings && !(template.karaoke && caption.palavras?.length)) return caption.texto;
    const words = String(caption.texto).split(/\s+/).filter(Boolean);
    const timed = caption.palavras?.length === words.length;
    let wordIndex = -1;
    return wrapCaptionText(caption.texto, captionSettings?.maxChars || 28).map((line, lineIndex) => <span key={lineIndex} className="block">{line.split(' ').map((word, index) => {
      wordIndex += 1;
      const emphasised = (timed && wordIndex === activeWordIndex) || keywords.has(normalizeWord(word));
      const emoji = captionSettings?.emojis ? emojiFor(word) : '';
      return <React.Fragment key={index}>{index ? ' ' : ''}<span data-active-word={timed && wordIndex === activeWordIndex ? 'true' : undefined} style={emphasised ? { color: highlightColor } : (captionSettings?.color ? { color: captionSettings.color } : undefined)}>{template.uppercase ? word.toLocaleUpperCase('pt-BR') : word}</span>{emoji ? ` ${emoji}` : ''}</React.Fragment>;
    })}</span>);
  }
  const frameRatio = FRAME_RATIOS[format] || 0;
  const captionPlacement = { top: 'top-4', center: 'top-1/2 -translate-y-1/2', bottom: 'bottom-4' }[captionPosition];
  function dropLayer(event) {
    event.preventDefault();
    const layer = overlays.find((item) => item.id === event.dataTransfer.getData('text/plain'));
    if (!layer || !onMoveLayer || !Number.isFinite(event.clientX)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const length = Math.max(0, layer.end_ms - layer.start_ms);
    let start = Math.max(0, Math.min(total - length, Math.round(win.start + ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * span)));
    if (snapping) {
      // Ímã: encaixa o início no cursor, IN/OUT e limites de legendas/outras camadas.
      const points = [time, in_ms, out_ms, ...captions.flatMap((c) => [c.start_ms, c.end_ms]), ...overlays.filter((o) => o.id !== layer.id).flatMap((o) => [o.start_ms, o.end_ms])];
      start = Math.max(0, Math.min(total - length, Math.round(resolveSnap(start, points, snapThresholdMs(span, bounds.width)).time)));
    }
    onMoveLayer(layer.id, start, start + length);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-800 bg-black">
        {source_url ? <video ref={vref} src={source_url} className={`h-full w-full ${fit === 'fit' ? 'object-contain' : 'object-cover'}`} style={fit !== 'fit' && focusX != null ? { objectPosition: `${Math.round(Number(focusX) * 100)}% 50%` } : undefined} controls={false} playsInline preload="metadata" /> : <p className="p-6 text-center text-xs text-slate-400">Nenhuma mídia vinculada ao corte.</p>}
        {overlays.filter((layer) => layer.tipo !== 'logo' && time >= layer.start_ms && time < layer.end_ms).map((layer, index) => layer.tipo === 'imagem' ? <img key={layer.id} src={resolveMediaUrl(layer.source_url)} alt={layer.titulo} className="pointer-events-none absolute right-[5%] top-[5%] max-h-[35%] max-w-[35%] object-contain" /> : layer.template === 'barra-editorial' ? <div key={layer.id} aria-label="GC barra editorial em prévia" className="pointer-events-none absolute inset-x-[7%] bottom-[12%] overflow-hidden p-[1%]" style={{ backgroundColor: layer.cor_barra || '#ffcc00', clipPath: `inset(0 ${100 - Math.min(1, Math.max(0, (time - layer.start_ms) / 600), Math.max(0, (layer.end_ms - time) / 600)) * 100}% 0 0)` }}><div className="overflow-hidden px-3 py-2 text-center font-bold" style={{ backgroundColor: layer.cor_painel || '#ffffff', color: layer.cor_texto || '#000000', fontFamily: layer.fonte || 'Arial', fontSize: `${layer.tamanho || 24}px` }}><div style={{ transform: `translateY(${Math.max(0, 1 - (time - layer.start_ms - 250) / 500) * 100}%)` }}>{layer.titulo}</div><div style={{ transform: `translateY(${-Math.max(0, 1 - (time - layer.start_ms - 250) / 500) * 100}%)` }}>{layer.subtitulo}</div></div></div> : <div key={layer.id} className="pointer-events-none absolute inset-x-4 flex justify-center" style={{ top: `${8 + index * 10}%` }}><span className="rounded bg-slate-950/80 px-3 py-1 text-center text-sm font-bold text-white">{layer.titulo}</span></div>)}
        {activeCaption?.texto && <div aria-label="Legenda em prévia" className={`pointer-events-none absolute inset-x-4 flex justify-center ${captionPlacement}`}><span className={`max-w-[90%] rounded px-3 py-1.5 text-center ${captionClasses}`} style={captionSettings?.fontSize ? { fontSize: `${Math.max(10, Math.round(Number(captionSettings.fontSize) / 3.5))}px` } : undefined}>{renderCaptionText(activeCaption)}</span></div>}
        {showGuide && frameRatio > 0 && <div aria-label={`Guia de enquadramento ${format}`} className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="relative h-full border-2 border-dashed border-amber-300/80" style={{ aspectRatio: String(frameRatio), maxWidth: "100%" }}>{format === "9:16" && <><div className="absolute inset-x-0 top-0 h-[12%] bg-rose-500/20" title="Área de interface no topo" /><div className="absolute inset-x-0 bottom-0 h-[20%] bg-rose-500/20" title="Área de botões e descrição das redes" /><div className="absolute bottom-0 right-0 top-[40%] w-[14%] bg-rose-500/20" title="Coluna de ações das redes" /></>}</div></div>}
      </div>

      <div className="mt-3">
        <div aria-label="Timeline do corte" role="slider" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(time)} onClick={seekFromPointer} className={`relative h-14 cursor-pointer select-none rounded-lg border border-slate-800 bg-slate-950/60${zoomed ? ' overflow-hidden' : ''}`}>
          {segments.map((s, i) => (
            <div key={i} className={`absolute top-1 h-3 rounded ${s.color || 'bg-sky-500/40'}`} style={{ left: pct(s.start_ms), width: len(s.end_ms - s.start_ms) }} title={s.title} />
          ))}
          {out_ms > 0 && (
            <div className="absolute bottom-1 h-5 rounded border-x border-emerald-500/50 bg-emerald-500/20" style={{ left: pct(in_ms), width: len(out_ms - in_ms) }} />
          )}
          <div className="absolute bottom-0 top-0 w-px bg-sky-300" style={{ left: pct(time) }}>
            <div className="-ml-1.5 -top-1 h-3 w-3 rounded-full bg-sky-400" />
          </div>
        </div>
        <div className="mt-2 space-y-1" aria-label="Camadas da timeline">
          <div className="grid grid-cols-[70px_1fr] items-center gap-2 text-[10px] text-slate-400"><span>Vídeo</span><div className="h-5 rounded bg-emerald-900/40" title="Vídeo de origem" /></div>
          {visiblePeaks.length > 0 && <div className="grid grid-cols-[70px_1fr] items-center gap-2 text-[10px] text-slate-400"><span>Áudio</span><div aria-label="Forma de onda do áudio" className="relative h-6 overflow-hidden rounded bg-slate-900"><svg viewBox={`0 0 ${visiblePeaks.length} 100`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full fill-emerald-400/70">{visiblePeaks.map((peak, index) => <rect key={index} x={index} width={0.8} y={50 - Math.max(1, peak * 50)} height={Math.max(2, peak * 100)} />)}</svg></div></div>}
          <div className="grid grid-cols-[70px_1fr] items-center gap-2 text-[10px] text-slate-400"><span>Legendas</span><div className={`relative h-6 rounded bg-slate-900${zoomed ? ' overflow-hidden' : ''}`}>{captions.map((caption) => <button key={caption.id} type="button" onClick={() => seekTo(caption.start_ms)} title={caption.texto} aria-label={`Ir para legenda ${caption.texto || 'sem texto'}`} className="absolute top-1 h-4 overflow-hidden rounded bg-violet-600/70 text-[9px] text-white" style={{ left: pct(caption.start_ms), width: len(Math.max(0, caption.end_ms - caption.start_ms)) }}>{caption.texto}</button>)}</div></div>
          <div className="grid grid-cols-[70px_1fr] items-center gap-2 text-[10px] text-slate-400"><span>Textos</span><div aria-label="Trilha de textos" onDragOver={(event) => event.preventDefault()} onDrop={dropLayer} className={`relative h-7 rounded border border-dashed border-sky-800 bg-slate-900${zoomed ? ' overflow-hidden' : ''}`}>{overlays.map((layer) => <button key={layer.id} type="button" draggable={Boolean(onMoveLayer)} onDragStart={(event) => event.dataTransfer.setData('text/plain', layer.id)} onClick={() => seekTo(layer.start_ms)} aria-label={`Mover camada ${layer.titulo}`} className="absolute top-1 h-5 overflow-hidden rounded bg-sky-600 px-1 text-left text-[9px] text-white" style={{ left: pct(layer.start_ms), width: len(Math.max(0, layer.end_ms - layer.start_ms)) }}>{layer.titulo}</button>)}</div></div>
          <p className="text-[10px] text-slate-500">Arraste textos na trilha para mudar o início. As edições são exibidas na prévia.</p>
        </div>

        <details className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-[10px] text-slate-400">
          <summary className="cursor-pointer font-semibold uppercase tracking-wide text-slate-400">Ferramentas da timeline e atalhos</summary>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button type="button" aria-pressed={snapping} onClick={() => setSnapping((value) => !value)} className={`flex items-center gap-1 rounded border px-1.5 py-1 ${snapping ? 'border-sky-500 bg-sky-500/15 text-sky-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}><Magnet size={11} /> Ímã na trilha de textos</button>
            <button type="button" onClick={loadWaveform} disabled={!source_url || waveform.status === 'loading'} className="flex items-center gap-1 rounded border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"><AudioWaveform size={11} /> {waveform.status === 'ready' ? 'Atualizar forma de onda' : 'Mostrar forma de onda'}</button>
            <button type="button" aria-pressed={muted} onClick={() => setMuted((value) => !value)} className="flex items-center gap-1 rounded border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800">{muted ? <VolumeX size={11} /> : <Volume2 size={11} />} {muted ? 'Ativar som' : 'Silenciar'}</button>
            <label className="flex items-center gap-1">Volume da prévia<input aria-label="Volume da prévia" type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={(e) => setVolume(Number(e.target.value) / 100)} className="w-20" /></label>
          </div>
          <p className="mt-1 text-slate-500">Volume e silêncio valem só para a prévia; o MP4 mantém o áudio original. O ímã encaixa o início do texto no cursor, IN/OUT e limites de legendas e camadas.</p>
          {waveform.message && <p role="status" className={`mt-1 ${waveform.status === 'error' ? 'text-amber-300' : 'text-slate-400'}`}>{waveform.message}</p>}
          <p className="mt-2 font-semibold uppercase tracking-wide text-slate-500">Atalhos de teclado</p>
          <ul aria-label="Atalhos de teclado do editor" className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">{EDITOR_SHORTCUTS.map((item) => <li key={item.action} className="flex items-center gap-1.5"><span className="flex gap-0.5">{item.keys.map((key) => <kbd key={key} className="rounded border border-slate-700 bg-slate-900 px-1 text-[9px] text-slate-200">{key}</kbd>)}</span><span>{item.label}</span></li>)}</ul>
          <p className="mt-1 text-slate-500">Os atalhos não funcionam enquanto o foco está em um campo de texto. A taxa de quadros real não é informada pelo navegador; o passo de quadro usa 30 fps.</p>
        </details>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button disabled={!source_url} onClick={togglePlay} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">{playing ? <Pause size={12} /> : <Play size={12} />} {playing ? 'Pausar' : 'Reproduzir'}</button>
          <button onClick={() => seekTo(in_ms)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"><SkipBack size={12} /> IN</button>
          <button onClick={() => seekTo(out_ms)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800">OUT <SkipForward size={12} /></button>
          <button onClick={() => onSetIn?.(Math.min(Math.round(time), out_ms || Math.round(dur)))} className="flex items-center gap-1 rounded-md border border-emerald-700 px-2.5 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-950/40"><Flag size={12} /> Marcar IN</button>
          <button onClick={() => onSetOut?.(Math.max(Math.round(time), in_ms || 0))} className="flex items-center gap-1 rounded-md border border-emerald-700 px-2.5 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-950/40"><Flag size={12} /> Marcar OUT</button>
          {frameRatio > 0 && <button type="button" aria-pressed={showGuide} onClick={() => setShowGuide((value) => !value)} className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] ${showGuide ? 'border-amber-400 text-amber-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}><Frame size={12} /> Guia {format} e área segura</button>}
          <button type="button" aria-label="Diminuir zoom da timeline" title="Diminuir zoom da timeline" onClick={() => zoomBy(0.5)} disabled={!zoomed} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"><ZoomOut size={12} /></button>
          <button type="button" aria-label="Aumentar zoom da timeline" title="Aumentar zoom da timeline" onClick={() => zoomBy(2)} disabled={span <= 500} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"><ZoomIn size={12} /></button>
          <button type="button" onClick={() => setView(fitView(in_ms, out_ms, total))} disabled={!(out_ms > in_ms)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40">Ajustar ao trecho</button>
          {zoomed && <button type="button" onClick={() => setView(null)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800">Ver tudo</button>}
          <span className="ml-auto text-[11px] text-slate-400">{fmt(time)} / {fmt(dur)}</span>
        </div>
      </div>
    </div>
  );
}
