import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, Search, Send, Pencil, Film,
} from 'lucide-react';
import {
  MOCK_CLIPS, MOCK_ASSETS, PUBLICATION_PLATFORM_LABELS,
  formatDuration, formatSize,
} from '../data';
import { StatusBadge } from '../ui';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'ready', label: 'Pronto' },
  { value: 'sent_to_publish', label: 'Enviado p/ publicar' },
];

const PLATFORM_COLORS = {
  instagram: 'bg-pink-500/15 text-pink-300 border-pink-700/40',
  youtube: 'bg-red-500/15 text-red-300 border-red-700/40',
  tiktok: 'bg-violet-500/15 text-violet-300 border-violet-700/40',
  facebook: 'bg-blue-500/15 text-blue-300 border-blue-700/40',
};

export default function SocialClipsTable({ onSelect, selectedId }) {
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = MOCK_CLIPS.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (query && !`${c.title} ${c.program_name} ${c.editor}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  function toggleRow(id) {
    setExpandedId(expandedId === id ? null : id);
    if (onSelect) onSelect(id);
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40">
      {/* Table controls */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar corte, programa ou editor..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-sky-500"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-8 text-sm text-slate-300 outline-none focus:border-sky-500"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900">
            <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 text-left font-semibold">Corte</th>
              <th className="px-3 py-2.5 text-left font-semibold">Duração</th>
              <th className="px-3 py-2.5 text-left font-semibold">Tamanho</th>
              <th className="px-3 py-2.5 text-left font-semibold">Editor</th>
              <th className="px-3 py-2.5 text-left font-semibold">Programa</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th className="px-3 py-2.5 text-left font-semibold">Canais</th>
              <th className="px-3 py-2.5 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const channels = c.channels ? c.channels.split(',').filter(Boolean) : [];
              const expanded = expandedId === c.id;
              const isSelected = selectedId === c.id;
              return (
                <React.Fragment key={c.id}>
                  <tr
                    onClick={() => toggleRow(c.id)}
                    className={`cursor-pointer border-b border-slate-800/50 transition ${
                      isSelected ? 'bg-sky-950/30' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                        <Film size={13} className="text-slate-500" />
                        <span className="font-medium text-slate-200">{c.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-400">{formatDuration(c.duration)}</td>
                    <td className="px-3 py-3 text-slate-400">{formatSize(c.file_size)}</td>
                    <td className="px-3 py-3 text-slate-400">{c.editor}</td>
                    <td className="px-3 py-3 text-slate-400">{c.program_name}</td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {channels.length > 0 ? channels.map((ch) => (
                          <span key={ch} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${PLATFORM_COLORS[ch] || 'border-slate-700 bg-slate-800 text-slate-300'}`}>
                            {PUBLICATION_PLATFORM_LABELS[ch] || ch}
                          </span>
                        )) : <span className="text-slate-600">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-300 transition hover:bg-sky-500 hover:text-slate-950"
                      >
                        Publicar
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-950/40">
                      <td colSpan={8} className="px-8 py-3">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                            <p className="mb-0.5 text-[10px] uppercase text-slate-500">Asset de origem</p>
                            <p className="font-medium text-slate-200">
                              {MOCK_ASSETS.find((a) => a.id === c.source_asset_id)?.title || '—'}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                            <p className="mb-0.5 text-[10px] uppercase text-slate-500">Versões</p>
                            <p className="font-medium text-slate-200">v1</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">
                              <Pencil size={12} /> Editar
                            </button>
                            <button className="flex items-center gap-1.5 rounded-lg border border-sky-700 bg-sky-950/40 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-900/50">
                              <Send size={12} /> Enviar p/ publicar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">Nenhum corte encontrado.</p>
        )}
      </div>
    </div>
  );
}