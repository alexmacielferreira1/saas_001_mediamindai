import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive, Shield, MonitorCog, Grid3X3, List, Download,
  AlertTriangle, CheckCircle2, Play, FileText, Music, Image, Scissors,
} from 'lucide-react';
import { Panel, Stat, Tabs, Badge, StatusBadge, SearchInput, Button, InfoRow, Loading } from '../ui';
import {
  MOCK_ASSETS, MOCK_LIBRARIES, MOCK_AUDIT_LOGS, MOCK_MONITORING,
  ACERVO_STATS, MEDIA_TYPES, formatDuration, formatSize, formatBytes,
} from '../data';

const ACERVO_TABS = [
  { key: 'acervo', label: 'Arquivos', icon: Archive },
  { key: 'admin', label: 'Usuários', icon: Shield },
  { key: 'monitoring', label: 'Sistema', icon: MonitorCog },
];

const ASSET_TYPE_ICONS = {
  video: Play, audio: Music, image: Image, document: FileText,
};

export default function Acervo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'acervo');

  function handleTabChange(key) {
    setActiveTab(key);
    setSearchParams({ tab: key }, { replace: true });
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-50">Acervo</h1>
        <p className="text-sm text-slate-400">Arquivos, usuários e sistema</p>
      </div>

      <Tabs tabs={ACERVO_TABS} active={activeTab} onChange={handleTabChange} />

      {activeTab === 'acervo' && <AcervoTab />}
      {activeTab === 'admin' && <AdminTab />}
      {activeTab === 'monitoring' && <MonitoringTab />}
    </div>
  );
}

function AcervoTab() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  const filtered = MOCK_ASSETS.filter((a) => {
    if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
    if (query && !`${a.title} ${a.filename} ${a.subjects} ${a.people}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat title="Total de arquivos" value={ACERVO_STATS.totalAssets.toLocaleString('pt-BR')} icon={Archive} tone="sky" />
        <Stat title="Bibliotecas" value={ACERVO_STATS.totalLibraries} icon={FolderIcon} tone="violet" />
        <Stat title="Indexados IA" value={ACERVO_STATS.indexedAssets.toLocaleString('pt-BR')} icon={CheckCircle2} tone="emerald" />
        <Stat title="Falhas" value={ACERVO_STATS.failedAssets} icon={AlertTriangle} tone="amber" />
        <Stat title="Storage" value={`${ACERVO_STATS.storageUsagePercent}%`} icon={MonitorCog} tone="sky" />
      </div>

      {/* Tipos de mídia */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('all')}
          className={`mm-badge ${typeFilter === 'all' ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}
        >
          Todos
        </button>
        {MEDIA_TYPES.map((m) => (
          <button
            key={m.label}
            onClick={() => setTypeFilter(m.label === 'Vídeos' ? 'video' : m.label === 'Áudios' ? 'audio' : m.label === 'Imagens' ? 'image' : 'document')}
            className={`mm-badge ${typeFilter === (m.label === 'Vídeos' ? 'video' : m.label === 'Áudios' ? 'audio' : m.label === 'Imagens' ? 'image' : 'document') ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}
          >
            {m.icon} {m.label} <span className="opacity-60">{m.badge}</span>
          </button>
        ))}
      </div>

      {/* Filtros + busca */}
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

      {/* Lista */}
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const Icon = ASSET_TYPE_ICONS[a.asset_type] || FileText;
                  return (
                    <tr key={a.id} className="border-b border-slate-800/50 transition hover:bg-slate-800/30 cursor-pointer">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">Nenhum arquivo encontrado.</p>
            )}
          </div>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((a) => (
            <div key={a.id} className="mm-panel mm-card-hover group cursor-pointer">
              <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-4xl">
                {a.icon}
              </div>
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

function AdminTab() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Bibliotecas">
          <div className="flex flex-col gap-2">
            {MOCK_LIBRARIES.map((lib) => (
              <div key={lib.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                <div>
                  <p className="font-medium text-slate-200">{lib.name}</p>
                  <p className="text-xs text-slate-500">{lib.asset_count.toLocaleString('pt-BR')} arquivos · {formatBytes(lib.storage_bytes)}</p>
                </div>
                <StatusBadge status={lib.status} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Logs de auditoria">
          <div className="flex flex-col gap-2">
            {MOCK_AUDIT_LOGS.map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-lg border border-slate-800/50 px-3 py-2 text-sm">
                <Badge tone={log.action.includes('Falha') ? 'error' : 'info'}>{log.action}</Badge>
                <span className="flex-1 truncate text-slate-300">{log.asset}</span>
                <span className="text-xs text-slate-500">{log.date}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MonitoringTab() {
  const m = MOCK_MONITORING;
  const memPct = m.resources.memory_used_bytes && m.resources.memory_total_bytes
    ? Math.round((m.resources.memory_used_bytes / m.resources.memory_total_bytes) * 100) : 0;
  const gpuPct = m.resources.gpu_percent ?? 0;
  const cpuPct = m.resources.cpu_percent ?? 0;
  const storagePct = m.storage.total_bytes ? Math.round((m.storage.used_bytes / m.storage.total_bytes) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat title="Processando" value={m.processing} icon={MonitorCog} tone="info" />
        <Stat title="Concluídos" value={m.completed.toLocaleString('pt-BR')} icon={CheckCircle2} tone="success" />
        <Stat title="Falhas" value={m.failed} icon={AlertTriangle} tone="error" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Serviços">
          <div className="flex flex-col gap-2">
            {m.services.map((s) => (
              <div key={s.key} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                <div>
                  <p className="font-medium text-slate-200">{s.label}</p>
                  <p className="text-xs text-slate-500">{s.detail}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recursos do sistema">
          <div className="flex flex-col gap-4">
            <ResourceBar label="CPU" percent={cpuPct} detail={`${m.resources.cpu_logical_cores} núcleos`} />
            <ResourceBar label="Memória" percent={memPct} detail={`${formatBytes(m.resources.memory_used_bytes)} / ${formatBytes(m.resources.memory_total_bytes)}`} />
            <ResourceBar label="GPU" percent={gpuPct} detail={`${formatBytes(m.resources.gpu_memory_used_bytes)} / ${formatBytes(m.resources.gpu_memory_total_bytes)}`} />
            <ResourceBar label="Storage" percent={storagePct} detail={`${formatBytes(m.storage.used_bytes)} / ${formatBytes(m.storage.total_bytes)}`} />
          </div>
        </Panel>
      </div>

      <Panel title="Modelos de IA">
        <div className="flex flex-wrap gap-2">
          {m.ai_models.map((model) => (
            <div key={model.key} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
              <span className="text-sm text-slate-200">{model.label}</span>
              <StatusBadge status={model.status} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ResourceBar({ label, percent, detail }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-xs text-slate-500">{detail}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${percent > 80 ? 'bg-rose-500' : percent > 60 ? 'bg-amber-500' : 'bg-gradient-to-r from-sky-400 to-violet-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-slate-500">{percent}%</p>
    </div>
  );
}

function FolderIcon(props) {
  return <Archive {...props} />;
}