import React from 'react';
import { Plus, FileText } from 'lucide-react';
import { StatusBadge } from '../ui';
import { MOCK_SCRIPTS } from '../data';

const STATUS_MAP = { in_review: 'reviewing', approved: 'approved', draft: 'draft' };

export default function RoteiroScriptList({ selectedId, onSelect, onCreate }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-slate-400" />
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Roteiros</h2>
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-400">{MOCK_SCRIPTS.length}</span>
        </div>
      </div>
      <div className="p-3">
        <button
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-sky-400"
        >
          <Plus size={14} /> Criar novo roteiro
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-2">
          {MOCK_SCRIPTS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`rounded-xl border p-3 text-left transition ${
                selectedId === s.id
                  ? 'border-sky-500 bg-sky-950/30'
                  : 'border-slate-800 bg-slate-950/40 hover:border-sky-700'
              }`}
            >
              <p className="truncate text-sm font-medium text-slate-200">{s.title}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{s.project_name}</p>
              <div className="mt-2.5 flex items-center justify-between">
                <StatusBadge status={STATUS_MAP[s.status]} />
                <span className="text-[11px] text-slate-500">{s.clip_count} blocos · {s.duration_label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}