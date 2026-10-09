import React, { useState } from 'react';
import { Sparkles, Play, Check } from 'lucide-react';
import { fmt, gerarVirais } from './clipModel';

const scoreTone = (s) => (s >= 85 ? 'bg-emerald-500/20 text-emerald-300' : s >= 70 ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300');

// Análise IA: processa o trecho IN/OUT e lista trechos viralizáveis por nota.
export default function ClipViralPanel({ clip, onChange, seekTo, onAvancar }) {
  const [loading, setLoading] = useState(false);

  function processar() {
    setLoading(true);
    setTimeout(() => {
      onChange({ viral: gerarVirais(clip) });
      setLoading(false);
    }, 900);
  }
  function toggle(id) {
    onChange({ viral: clip.viral.map((v) => (v.id === id ? { ...v, selected: !v.selected } : v)) });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Trecho {fmt(clip.in_ms)}–{fmt(clip.out_ms)} · a IA divide em candidatos e atribui nota.</p>
        <button onClick={processar} disabled={loading} className="flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-violet-400 disabled:opacity-50"><Sparkles size={12} /> {loading ? 'Processando...' : 'Processar IA'}</button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {clip.viral.length === 0 && !loading && <p className="py-8 text-center text-[11px] text-slate-500">Processe o trecho pra ver os mais viralizáveis.</p>}
        {clip.viral.map((v) => (
          <div key={v.id} className={`flex items-center gap-3 rounded-lg border p-3 ${v.selected ? 'border-violet-600 bg-violet-950/30' : 'border-slate-800 bg-slate-950/40'}`}>
            <span className={`mm-badge ${scoreTone(v.score)}`}>{v.score}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-200">{v.titulo}</p>
              <p className="text-[10px] text-slate-500">{fmt(v.start_ms)} – {fmt(v.end_ms)} · {((v.end_ms - v.start_ms) / 1000).toFixed(1)}s</p>
            </div>
            <button onClick={() => seekTo(v.start_ms)} className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"><Play size={11} /></button>
            <button onClick={() => toggle(v.id)} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold ${v.selected ? 'bg-violet-500 text-slate-950' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}><Check size={11} /> {v.selected ? 'Selecionado' : 'Selecionar'}</button>
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t border-slate-800 pt-3">
        <button onClick={onAvancar} disabled={!clip.viral.some((v) => v.selected)} className="rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">Gerar legendas dos selecionados →</button>
      </div>
    </div>
  );
}