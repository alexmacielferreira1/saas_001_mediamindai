import React, { useState } from 'react';
import { useWorkDraftState } from '../../../lib/workProtection';
import { Plus, Play, Trash2 } from 'lucide-react';
import { fmt } from './clipModel';

const TIPOS = [
  { value: 'lower_third', label: 'Lower-third' },
  { value: 'titulo', label: 'Título' },
  { value: 'credito', label: 'Crédito' },
  { value: 'logo', label: 'Logo' },
];

// CGs / lower-thirds: adicionar, editar e posicionar sobre o trecho.
export default function ClipCGPanel({ clip, onChange, seekTo, onAvancar }) {
  const [draft, setDraft] = useWorkDraftState(`clip:${clip.id}:cg`, { titulo: '', tipo: 'lower_third', start_ms: clip.in_ms || 0, end_ms: (clip.in_ms || 0) + 4000 });

  function add() {
    if (!draft.titulo) return;
    onChange({ cgs: [...clip.cgs, { id: `cg-${Date.now()}`, ...draft }] });
    setDraft({ ...draft, titulo: '' });
  }
  function upd(id, patch) { onChange({ cgs: clip.cgs.map((c) => (c.id === id ? { ...c, ...patch } : c)) }); }
  function remove(id) { onChange({ cgs: clip.cgs.filter((c) => c.id !== id) }); }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Adicionar CG / lower-third</p>
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} placeholder="Texto do CG" className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
          <select value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none">
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="number" value={draft.start_ms} onChange={(e) => setDraft({ ...draft, start_ms: +e.target.value })} placeholder="in ms" className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none" />
          <input type="number" value={draft.end_ms} onChange={(e) => setDraft({ ...draft, end_ms: +e.target.value })} placeholder="out ms" className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none" />
        </div>
        <button onClick={add} className="mt-2 flex items-center gap-1 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={12} /> Adicionar</button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {clip.cgs.length === 0 && <p className="py-8 text-center text-[11px] text-slate-500">Adicione lower-thirds, títulos e créditos sobre o trecho.</p>}
        {clip.cgs.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
            <button onClick={() => seekTo(c.start_ms)} className="rounded-md border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800"><Play size={11} /></button>
            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-300">{TIPOS.find((t) => t.value === c.tipo)?.label}</span>
            <input value={c.titulo} onChange={(e) => upd(c.id, { titulo: e.target.value })} className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 outline-none" />
            <span className="text-[10px] text-slate-500">{fmt(c.start_ms)}–{fmt(c.end_ms)}</span>
            <button onClick={() => remove(c.id)} className="rounded-md border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-rose-950/40 hover:text-rose-300"><Trash2 size={11} /></button>
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t border-slate-800 pt-3">
        <button onClick={onAvancar} className="rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">Continuar →</button>
      </div>
    </div>
  );
}
