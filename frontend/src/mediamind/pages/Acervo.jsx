import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive, Shield, MonitorCog, Grid3X3, List,
  AlertTriangle, CheckCircle2, Play, FileText, Music, Image,
} from 'lucide-react';
import { Panel, Stat, Tabs, Badge, StatusBadge, SearchInput, Loading, EmptyState } from '../ui';
import { formatDuration, formatSize, formatBytes } from '../data';
import { base44 } from '@/api/base44Client';
import { getManagementOverview } from '../../api/management';
import { buildAcervoSystemSummary } from '../lib/acervoSystemViewModel';
import { listMemberships } from '../../api/permissions';
import { CARGO_BY_ID } from '../lib/roleCatalog';

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
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      getManagementOverview(),
      base44.entities.Asset.list('-created_date', 500),
      base44.entities.LogAuditoria.list('-created_date', 100),
      listMemberships().catch(() => []),
    ])
      .then(([overview, assets, logs, memberships]) => { if (active) setData({ overview, assets, logs, memberships }); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

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

      {error && <EmptyState icon={AlertTriangle} title="Não foi possível carregar o acervo" description="Verifique o serviço local e tente novamente." />}
      {!error && !data && <Loading label="Carregando acervo..." />}
      {data && activeTab === 'acervo' && <AcervoTab assets={data.assets} summary={data.overview.assets} />}
      {data && activeTab === 'admin' && <AdminTab logs={data.logs} memberships={data.memberships} />}
      {data && activeTab === 'monitoring' && <MonitoringTab overview={data.overview} />}
    </div>
  );
}

function AcervoTab({ assets, summary }) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  const filtered = assets.filter((a) => {
    if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
    if (query && !`${a.title} ${a.filename} ${a.subjects} ${a.people}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat title="Total de arquivos" value={summary.total.toLocaleString('pt-BR')} icon={Archive} tone="sky" />
        <Stat title="Indexados IA" value={summary.indexed.toLocaleString('pt-BR')} icon={CheckCircle2} tone="emerald" />
        <Stat title="Falhas" value={summary.failures} icon={AlertTriangle} tone="amber" />
        <Stat title="Storage utilizado" value={formatBytes(summary.storage_bytes)} icon={MonitorCog} tone="sky" />
      </div>

      {/* Tipos de mídia */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('all')}
          className={`mm-badge ${typeFilter === 'all' ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}
        >
          Todos
        </button>
        {[
          ['video', '🎬', 'Vídeos'], ['audio', '🎙️', 'Áudios'],
          ['image', '🖼️', 'Imagens'], ['document', '📄', 'Documentos'],
        ].map(([type, icon, label]) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`mm-badge ${typeFilter === type ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}
          >
            {icon} {label} <span className="opacity-60">{assets.filter((asset) => asset.asset_type === type).length}</span>
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

function AdminTab({ logs, memberships }) {
  const activeUsers = memberships.filter((membership) => membership.status !== 'inactive').length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Usuários com acesso" value={memberships.length} icon={Shield} tone="sky" />
        <Stat title="Acessos ativos" value={activeUsers} icon={CheckCircle2} tone="emerald" />
        <Stat title="Perfis distintos" value={new Set(memberships.map((item) => item.role)).size} icon={Shield} tone="violet" />
        <Stat title="Eventos auditados" value={logs.length} icon={Archive} tone="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Usuários e permissões do acervo">
          <div className="space-y-2">
            {memberships.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum usuário disponível para este tenant.</p>}
            {memberships.map((membership) => (
              <div key={membership.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-300">
                  {(membership.full_name || membership.email || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{membership.full_name || membership.email}</p>
                  <p className="truncate text-xs text-slate-500">{membership.email}</p>
                </div>
                <div className="text-right">
                  <Badge tone="info">{CARGO_BY_ID[membership.role]?.name || membership.role}</Badge>
                  <p className="mt-1 text-[10px] text-slate-500">{membership.status || 'ativo'}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Logs de auditoria">
          <div className="flex flex-col gap-2">
            {logs.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum evento de auditoria.</p>}
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-lg border border-slate-800/50 px-3 py-2 text-sm">
                <Badge tone="info">{log.action || 'evento'}</Badge>
                <span className="flex-1 truncate text-slate-300">{log.entity_type || log.entidade || 'registro'}</span>
                <span className="text-xs text-slate-500">{log.created_date ? new Date(log.created_date).toLocaleString('pt-BR') : ''}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MonitoringTab({ overview }) {
  const summary = buildAcervoSystemSummary(overview);
  const ICONS = [MonitorCog, CheckCircle2, AlertTriangle, CheckCircle2, MonitorCog];
  const incidents = [];
  if (overview.processing.failed) incidents.push(`${overview.processing.failed} processamento(s) com falha`);
  if (overview.assets.failures) incidents.push(`${overview.assets.failures} arquivo(s) com falha de indexação`);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summary.map((item, index) => (
          <Stat key={item.id} title={item.label} value={item.value} icon={ICONS[index]} tone={item.tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Serviços e pipelines">
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <div className="grid grid-cols-[1fr_auto] bg-slate-950/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <span>Serviço</span><span>Status</span>
            </div>
            {overview.services.map((s) => (
              <div key={s.key} className="flex items-center justify-between border-t border-slate-800 bg-slate-900/40 px-3 py-2.5">
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
          <p className="py-6 text-center text-sm text-slate-500">Métricas de CPU, memória e GPU serão exibidas quando o agente de monitoramento local estiver habilitado.</p>
        </Panel>
      </div>

      <Panel title="Modelos de IA">
        <p className="text-sm text-slate-500">Nenhum modelo local configurado.</p>
      </Panel>

      <Panel title="Incidentes recentes">
        <div className="space-y-2">
          {incidents.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Nenhum incidente técnico aberto.</p>}
          {incidents.map((incident) => (
            <div key={incident} className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-200">
              <AlertTriangle size={14} /> {incident}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
