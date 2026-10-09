import React, { useState } from 'react';
import {
  Archive, Grid3X3, List, Download, AlertTriangle, CheckCircle2,
  Play, FileText, Music, Image, Folder,
} from 'lucide-react';
import { Panel, Stat, StatusBadge, SearchInput } from '../../../ui';
import {
  MOCK_ASSETS, ACERVO_STATS, MEDIA_TYPES, formatDuration, formatSize,
} from '../../../data';

// Navegador completo do acervo (arquivos) — puxado da aba Arquivos do Acervo.
// Busca, filtro por tipo de mídia e visualização lista/grade. Administrador vê tudo.
const ASSET_TYPE_ICONS = { video: Play, audio: Music, image: Image, document: FileText };
const TYPE_BY_LABEL = { 'Vídeos': 'video', 'Áudios': 'audio', 'Imagens': 'image', 'Documentos': 'document' };

export default function CedocArquivosTab() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  const filtered = MOCK_ASSETS.filter((a) => {
    if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
    if (query && !`${a.title} ${a.filename} ${a.subjects} ${a.people}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full space-y-4 overflow-y-auto">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat title="Total de arquivos" value={ACERVO_STATS.totalAssets.toLocaleString('pt-BR')} icon={Archive} tone="sky" />
        <Stat title="Bibliotecas" value={ACERVO_STATS.totalLibraries} icon={Folder} tone="violet" />
        <Stat title="Indexados IA" value={ACERVO_STATS.indexedAssets.toLocaleString('pt-BR')} icon={CheckCircle2} tone="emerald" />
        <Stat title="Falhas" value={ACERVO_STATS.failedAssets} icon={AlertTriangle} tone="amber" />
        <Stat title="Storage" value={`${ACERVO_STATS.storageUsagePercent}%`} icon={Archive} tone="sky" />
      </div>

      {/* Filtro por tipo */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('all')}
          className={`mm-badge ${typeFilter === 'all' ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}
        >
          Todos
        </button>
        {MEDIA_TYPES.map((m) => {
          const t = TYPE_BY_LABEL[m.label];
          return (
            <button
              key={m.label}
              onClick={() => setTypeFilter(t)}
              className={`mm-badge ${typeFilter === t ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}
            >
              {m.icon} {m.label} <span className="opacity-60">{m.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Busca + toggle de visualização */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Buscar por título, nome, pessoa, assunto..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-xl border p-2.5 ${viewMode === 'list' ? 'border-sky-600 text-sky-400' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-xl border p-2.5 ${viewMode === 'grid' ? 'border-sky-600 text-sky-400' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
          >
            <Grid3X3 size={18} />
          </button>
        </div>
      </div>

      {/* Lista / Grade */}
      {viewMode === 'list' ? (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                  <th className="px-3 py-2 text-left">Arquivo</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-left">Duração</th>
                  <th className="px-3 py-2 text-left">Tamanho</th>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const Icon = ASSET_TYPE_ICONS[a.asset_type] || FileText;
                  return (
                    <tr key={a.id} className="border-b border-slate-800/50 transition hover:bg-slate-800/30">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-lg">{a.icon}</div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-200">{a.title}</p>
                            <p className="truncate text-xs text-slate-500">{a.filename}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><span className="flex items-center gap-1.5 text-slate-400"><Icon size={14} />{a.asset_type}</span></td>
                      <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                      <td className="px-3 py-3 text-slate-400">{a.category}</td>
                      <td className="px-3 py-3 text-slate-400">{formatDuration(a.duration)}</td>
                      <td className="px-3 py-3 text-slate-400">{formatSize(a.file_size)}</td>
                      <td className="px-3 py-3 text-slate-500">{a.reference_date}</td>
                      <td className="px-3 py-3 text-right">
                        <button className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-sky-400" title="Baixar">
                          <Download size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Nenhum arquivo encontrado.</p>}
          </div>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((a) => (
            <div key={a.id} className="mm-panel mm-card-hover group cursor-pointer">
              <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-4xl">{a.icon}</div>
              <p className="truncate font-medium text-slate-200">{a.title}</p>
              <p className="mb-2 truncate text-xs text-slate-500">{a.filename}</p>
              <div className="flex items-center justify-between">
                <StatusBadge status={a.status} />
                <span className="text-xs text-slate-500">{formatDuration(a.duration)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}