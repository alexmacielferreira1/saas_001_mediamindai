import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Flag } from 'lucide-react';
import { fmt } from './clipModel';

// Player de seleção IN/OUT com timeline + overlay de trechos virais/CGs.
// seekRef permite que os painéis chamem seekRef.current(ms).
export default function ClipPlayer({ source_url, in_ms, out_ms, segments = [], onSetIn, onSetOut, onReady, seekRef }) {
  const vref = useRef(null);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    const onLoaded = () => { setDur(v.duration * 1000); onReady?.(v.duration * 1000); };
    const onTime = () => setTime(v.currentTime * 1000);
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
  }, [source_url]);

  useEffect(() => {
    if (seekRef) seekRef.current = (ms) => { if (vref.current) vref.current.currentTime = Math.max(0, (ms || 0) / 1000); };
  }, [seekRef]);

  // Pausa ao chegar no OUT durante reprodução do trecho.
  useEffect(() => {
    const v = vref.current;
    if (!v || !out_ms) return;
    if (time >= out_ms && playing && time <= out_ms + 400) v.pause();
  }, [time, out_ms, playing]);

  function togglePlay() {
    const v = vref.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }
  function seekTo(ms) { if (vref.current) vref.current.currentTime = Math.max(0, (ms || 0) / 1000); }

  const total = dur || 1;
  const pct = (t) => `${(t / total) * 100}%`;

  return (
    <div className="flex h-full flex-col">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-800 bg-black">
        {source_url ? <video ref={vref} src={source_url} className="h-full w-full object-contain" controls={false} playsInline preload="metadata" /> : <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_55%_35%,#315475,#15283d_38%,#07111f_75%)]"><div className="text-center"><div className="mx-auto mb-3 grid size-24 place-items-center rounded-full border border-sky-400/30 bg-slate-950/40 text-5xl">🎙️</div><p className="text-sm font-bold text-slate-100">Prefeito fala sobre obras</p><p className="text-[10px] text-slate-400">Jornal da Cidade · prévia do corte</p></div></div>}
        <div className="absolute bottom-5 left-[8%] right-[18%] border-l-4 border-sky-400 bg-white/95 px-3 py-2 text-left shadow-xl"><p className="text-[10px] font-black uppercase text-blue-900">Prefeito fala sobre obras</p><p className="text-[8px] font-semibold text-slate-700">Novas intervenções devem melhorar a mobilidade na região</p></div>
      </div>

      <div className="mt-3">
        <div className="relative h-14 select-none rounded-lg border border-slate-800 bg-slate-950/60">
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

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button onClick={togglePlay} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">{playing ? <Pause size={12} /> : <Play size={12} />} {playing ? 'Pausar' : 'Reproduzir'}</button>
          <button onClick={() => seekTo(in_ms)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"><SkipBack size={12} /> IN</button>
          <button onClick={() => seekTo(out_ms)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800">OUT <SkipForward size={12} /></button>
          <button onClick={() => onSetIn?.(Math.round(time))} className="flex items-center gap-1 rounded-md border border-emerald-700 px-2.5 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-950/40"><Flag size={12} /> Marcar IN</button>
          <button onClick={() => onSetOut?.(Math.round(time))} className="flex items-center gap-1 rounded-md border border-emerald-700 px-2.5 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-950/40"><Flag size={12} /> Marcar OUT</button>
          <span className="ml-auto text-[11px] text-slate-400">{fmt(time)} / {fmt(dur)}</span>
        </div>
      </div>
    </div>
  );
}
