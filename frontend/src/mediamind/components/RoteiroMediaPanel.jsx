import React, { useState } from 'react';
import { Search, Plus, Film, Music, Image as ImageIcon, FileText } from 'lucide-react';
import { MOCK_ASSETS, formatDuration } from '../data';

const TYPE_ICON = {
  video: Film, audio: Music, image: ImageIcon, document: FileText,
};

export default function RoteiroMediaPanel({ onAddMedia }) {
  const [query, setQuery] = useState('');

  const filtered = MOCK_ASSETS.filter((a) =>
    !query || `${a.title} ${a.filename}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Mídias disponíveis</h2>
      </div>
      <div className="border-b border-slate-800 p-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 py-2 pl-9 pr-3 text-xs outline-none focus:border-sky-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1.5">
          {filtered.map((a) => {
            const Icon = TYPE_ICON[a.asset_type] || FileText;
            return (
              <div
                key={a.id}
                className="group flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-2 transition hover:border-sky-700"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-base">
                  {a.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{a.title}</p>
                  <p className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Icon size={9} /> {formatDuration(a.duration)}
                  </p>
                </div>
                <button
                  onClick={() => onAddMedia(a)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sky-400 transition hover:bg-sky-500/20"
                  title="Adicionar ao roteiro"
                >
                  <Plus size={14} />
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">Nenhuma mídia encontrada.</p>
          )}
        </div>
      </div>
    </div>
  );
}