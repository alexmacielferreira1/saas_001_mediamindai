import React from 'react';
import { Upload, Plus } from 'lucide-react';
import { MOCK_CORP_MEDIA } from '../../data';

const STATUS_TONE = {
  bruto: 'bg-amber-500/15 text-amber-300',
  finalizado: 'bg-emerald-500/15 text-emerald-300',
};

export default function CorpMediaPanel() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mídias (MAM / Acervo)</p>
        <div className="flex gap-1.5">
          <button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            <Upload size={11} /> Ingest
          </button>
          <button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">
            <Plus size={11} /> Adicionar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {MOCK_CORP_MEDIA.map((m) => (
            <div key={m.id} className="group rounded-lg border border-slate-800 bg-slate-950/40 p-2 transition hover:border-sky-700">
              <div className="mb-1.5 flex h-14 items-center justify-center rounded-md bg-gradient-to-br from-slate-800 to-slate-900 text-2xl">
                {m.icon}
              </div>
              <p className="truncate text-[10px] font-medium text-slate-200">{m.name}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[9px] font-mono text-slate-500">{m.duration}</span>
                <span className="text-[9px] text-slate-500">{m.size}</span>
              </div>
              <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${STATUS_TONE[m.status]}`}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}