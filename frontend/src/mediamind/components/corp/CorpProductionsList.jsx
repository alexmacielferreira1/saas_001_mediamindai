import React, { useState } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { MOCK_CORP_PRODUCTIONS, CORP_STATUS_LABELS } from '../../data';
import { StatusBadge } from '../../ui';

export default function CorpProductionsList({ selectedId, onSelect, statuses }) {
  const [query, setQuery] = useState('');
  const filtered = MOCK_CORP_PRODUCTIONS.filter((p) => {
    if (statuses && !statuses.includes(p.status)) return false;
    return `${p.programa} ${p.titulo}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-slate-800 p-3">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produção..."
            className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-sky-500"
          />
        </div>
        <button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1.5 text-[10px] text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
          Status <ChevronDown size={11} />
        </button>
        <button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1.5 text-[10px] font-bold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">
          <Plus size={11} /> Nova
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-900">
            <tr className="border-b border-slate-800 text-[9px] uppercase text-slate-500">
              <th className="px-3 py-2 text-left font-semibold">Programa</th>
              <th className="px-2 py-2 text-left font-semibold">Ep.</th>
              <th className="px-2 py-2 text-left font-semibold">Status</th>
              <th className="px-2 py-2 text-left font-semibold">Grav.</th>
              <th className="px-2 py-2 text-left font-semibold">Pub.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isSelected = selectedId === p.id;
              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`cursor-pointer border-b border-slate-800/50 transition ${isSelected ? 'bg-sky-950/30' : 'hover:bg-slate-800/30'}`}
                >
                  <td className="px-3 py-2.5">
                    <p className="truncate font-medium text-slate-200">{p.programa}</p>
                    <p className="truncate text-[10px] text-slate-500">{p.titulo}</p>
                  </td>
                  <td className="px-2 py-2.5 font-mono text-slate-400">{p.episodio}</td>
                  <td className="px-2 py-2.5"><StatusBadge status={p.status} labels={CORP_STATUS_LABELS} /></td>
                  <td className="px-2 py-2.5 font-mono text-slate-500">{p.data_gravacao.slice(8)}/{p.data_gravacao.slice(5,7)}</td>
                  <td className="px-2 py-2.5 font-mono text-slate-500">{p.data_publicacao.slice(8)}/{p.data_publicacao.slice(5,7)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}