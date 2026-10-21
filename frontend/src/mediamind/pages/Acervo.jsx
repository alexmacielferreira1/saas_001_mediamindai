import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive, Shield, MonitorCog, Grid3X3, List,
  AlertTriangle, CheckCircle2, Play, FileText, Music, Image,
  ExternalLink, Scissors, X,
} from 'lucide-react';
import { Panel, Stat, Tabs, Badge, StatusBadge, SearchInput, Loading, InfoRow } from '../ui';
import { formatDuration, formatSize, formatBytes } from '../data';
import { base44 } from '@/api/base44Client';
import { getManagementOverview } from '../../api/management';
import { buildAcervoSystemSummary } from '../lib/acervoSystemViewModel';
import { listMemberships, updateMembershipScreens } from '../../api/permissions';
import { accessErrorMessage } from '../lib/accessErrors';
import { loadAuditLogs } from '../lib/auditLogAccess';
import { CARGO_BY_ID } from '../lib/roleCatalog';
import {
  DEMO_ASSETS,
  DEMO_AUDIT_LOGS,
  DEMO_MANAGEMENT_OVERVIEW,
  DEMO_MEMBERSHIPS,
  withDemoFallback,
} from '../lib/managementDemoData';

const ACERVO_TABS = [
  { key: 'acervo', label: 'Arquivos', icon: Archive },
  { key: 'admin', label: 'Usuários', icon: Shield },
  { key: 'monitoring', label: 'Sistema', icon: MonitorCog },
];

const ASSET_TYPE_ICONS = {
  video: Play, audio: Music, image: Image, document: FileText,
};

export default function Acervo({ embedded = false, localDemo = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramKey = embedded ? 'acervoTab' : 'tab';
  const tabParam = searchParams.get(paramKey);
  const validTab = ACERVO_TABS.some((item) => item.key === tabParam) ? tabParam : 'acervo';
  const [activeTab, setActiveTab] = useState(validTab);
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    if (localDemo) {
      setData({ overview: DEMO_MANAGEMENT_OVERVIEW, assets: DEMO_ASSETS, logs: DEMO_AUDIT_LOGS, memberships: DEMO_MEMBERSHIPS });
      return () => { active = false; };
    }
    Promise.all([
      withDemoFallback(getManagementOverview, DEMO_MANAGEMENT_OVERVIEW),
      withDemoFallback(() => base44.entities.Asset.list('-created_date', 500), DEMO_ASSETS),
      // Auditoria: sem fallback de demonstração (403 = sem permissão, falha = erro).
      loadAuditLogs(100),
      withDemoFallback(listMemberships, DEMO_MEMBERSHIPS),
    ])
      .then(([overview, assets, audit, memberships]) => { if (active) setData({ overview, assets, logs: audit.logs, logsError: audit.error, memberships }); })
    return () => { active = false; };
  }, [localDemo]);

  function handleTabChange(key) {
    setActiveTab(key);
    const next = new URLSearchParams(searchParams);
    next.set(paramKey, key);
    if (embedded) next.set('tab', 'archive');
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-50">Acervo</h1>
        <p className="text-sm text-slate-400">Arquivos, usuários, indexação e saúde do sistema.</p>
      </div>

      <Tabs tabs={ACERVO_TABS} active={activeTab} onChange={handleTabChange} />

      {!data && <Loading label="Carregando acervo..." />}
      {data && activeTab === 'acervo' && <AcervoTab assets={data.assets} summary={data.overview.assets} />}
      {data && activeTab === 'admin' && <AdminTab logs={data.logs} logsError={data.logsError} memberships={data.memberships} localDemo={localDemo} />}
      {data && activeTab === 'monitoring' && <MonitoringTab overview={data.overview} localDemo={localDemo} />}
    </div>
  );
}

function AcervoTab({ assets, summary }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [selectedAsset, setSelectedAsset] = useState(null);

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
        <Stat title="Bibliotecas" value={new Set(assets.map((asset) => asset.category).filter(Boolean)).size} icon={Archive} tone="violet" />
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
                    <tr key={a.id} onClick={() => setSelectedAsset(a)} className="cursor-pointer border-b border-slate-800/50 transition hover:bg-slate-800/30">
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
            <button key={a.id} type="button" onClick={() => setSelectedAsset(a)} className="mm-panel mm-card-hover group cursor-pointer text-left">
              <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-4xl">
                {a.icon}
              </div>
              <p className="truncate font-medium text-slate-200">{a.title}</p>
              <p className="mb-2 truncate text-xs text-slate-500">{a.filename}</p>
              <div className="flex items-center justify-between">
                <StatusBadge status={a.status} />
                <span className="text-xs text-slate-500">{formatDuration(a.duration)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedAsset && (
        <div className="fixed bottom-4 right-4 top-24 z-40 w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-xl shadow-2xl shadow-black/50">
          <Panel
            title="Detalhes do arquivo"
            right={<button type="button" onClick={() => setSelectedAsset(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200" aria-label="Fechar detalhes"><X size={15} /></button>}
          >
          <div className="grid gap-4">
            <div className="space-y-2">
              <InfoRow label="Asset ID" value={selectedAsset.id} />
              <InfoRow label="Título" value={selectedAsset.title} />
              <InfoRow label="Arquivo" value={selectedAsset.filename} />
              <InfoRow label="Categoria" value={selectedAsset.category || '—'} />
            </div>
            <div className="space-y-2">
              <InfoRow label="Tipo" value={selectedAsset.asset_type || '—'} />
              <InfoRow label="Duração" value={formatDuration(selectedAsset.duration)} />
              <InfoRow label="Tamanho" value={formatSize(selectedAsset.file_size)} />
              <InfoRow label="Status" value={selectedAsset.status || '—'} />
            </div>
            <div className="flex min-w-48 flex-col gap-2">
              <button type="button" onClick={() => navigate(`/workspace?assetId=${encodeURIComponent(selectedAsset.id)}`)} className="flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"><ExternalLink size={14} /> Abrir no Workspace</button>
              <button type="button" onClick={() => navigate(`/social?novo=publicacao&asset=${encodeURIComponent(selectedAsset.id)}`)} className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"><Scissors size={14} /> Criar corte</button>
              <button type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(selectedAsset.title || selectedAsset.filename || '')}`)} className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Localizar relacionados</button>
            </div>
          </div>
          </Panel>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Envios recentes">
          <div className="space-y-2">{assets.slice(0, 4).map((asset) => <button type="button" key={asset.id} onClick={() => setSelectedAsset(asset)} className="flex w-full items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-left"><span className="truncate text-xs text-slate-300">{asset.filename || asset.title}</span><StatusBadge status={asset.status} /></button>)}</div>
        </Panel>
        <Panel title="Fila de indexação">
          <div className="space-y-2">{assets.filter((asset) => ['processing', 'pending', 'processando'].includes(String(asset.status).toLowerCase())).slice(0, 4).map((asset) => <div key={asset.id} className="rounded-lg border border-slate-800 px-3 py-2"><p className="truncate text-xs text-slate-300">{asset.filename || asset.title}</p><p className="mt-1 text-[11px] text-sky-400">Processamento em andamento</p></div>)}{!assets.some((asset) => ['processing', 'pending', 'processando'].includes(String(asset.status).toLowerCase())) && <p className="py-4 text-center text-xs text-slate-500">Nenhum item aguardando indexação.</p>}</div>
        </Panel>
        <Panel title="Saúde do acervo">
          <div className="space-y-2"><InfoRow label="Indexação" value={`${summary.indexed.toLocaleString('pt-BR')} itens`} /><InfoRow label="Falhas conhecidas" value={summary.failures} /><InfoRow label="Armazenamento catalogado" value={formatBytes(summary.storage_bytes)} /><InfoRow label="Integridade" value={summary.failures ? 'Requer atenção' : 'Saudável'} /></div>
        </Panel>
      </div>
    </div>
  );
}

function AdminTab({ logs, logsError = '', memberships, localDemo = false }) {
  const [users, setUsers] = useState(memberships);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessError, setAccessError] = useState('');
  const activeUsers = users.filter((membership) => membership.status !== 'inactive').length;
  const selectedUser = users.find((membership) => membership.id === selectedUserId) || null;

  const hasAcervoAccess = (membership) => !((membership.restricted_screens || []).includes('acervo'));

  async function toggleAcervoAccess(membership) {
    const currentlyAllowed = hasAcervoAccess(membership);
    const restricted = new Set(membership.restricted_screens || []);
    if (currentlyAllowed) restricted.add('acervo'); else restricted.delete('acervo');
    setSavingAccess(true);
    setAccessError('');
    try {
      const restrictedScreens = [...restricted];
      if (!localDemo) await updateMembershipScreens(membership.id, membership.extra_screens || [], restrictedScreens);
      setUsers((current) => current.map((item) => (
        item.id === membership.id ? { ...item, restricted_screens: restrictedScreens } : item
      )));
    } catch (error) {
      setAccessError(accessErrorMessage(error, 'Não foi possível alterar o acesso ao acervo.'));
    } finally {
      setSavingAccess(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Usuários com acesso" value={users.filter(hasAcervoAccess).length} icon={Shield} tone="sky" />
        <Stat title="Acessos ativos" value={activeUsers} icon={CheckCircle2} tone="emerald" />
        <Stat title="Perfis distintos" value={new Set(users.map((item) => item.role)).size} icon={Shield} tone="violet" />
        <Stat title="Eventos auditados" value={logsError ? "—" : logs.length} icon={Archive} tone="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Usuários e permissões do acervo">
          <div className="space-y-2">
            {users.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum usuário disponível para este tenant.</p>}
            {users.map((membership) => (
              <button type="button" key={membership.id} onClick={() => setSelectedUserId(membership.id)} className={`flex w-full items-center gap-3 rounded-xl border bg-slate-900/40 px-3 py-2.5 text-left transition hover:border-sky-500/50 hover:bg-slate-900/70 ${selectedUserId === membership.id ? 'border-sky-500/70' : 'border-slate-800'}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-300">
                  {(membership.full_name || membership.email || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{membership.full_name || membership.email}</p>
                  <p className="truncate text-xs text-slate-500">{membership.email}</p>
                </div>
                <div className="text-right">
                  <Badge tone="info">{CARGO_BY_ID[membership.role]?.name || membership.role}</Badge>
                  <p className={`mt-1 text-[10px] ${hasAcervoAccess(membership) ? 'text-emerald-400' : 'text-rose-400'}`}>{hasAcervoAccess(membership) ? 'acervo permitido' : 'acervo restrito'}</p>
                </div>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Logs de auditoria">
          <div className="flex flex-col gap-2">
            {logsError && <p role="alert" className="py-6 text-center text-sm text-slate-400">{logsError}</p>}
            {!logsError && logs.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum evento de auditoria.</p>}
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
      {selectedUser && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          <Panel title="Detalhes e acesso ao acervo" right={<button type="button" onClick={() => setSelectedUserId(null)} aria-label="Fechar detalhes" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800"><X size={15} /></button>}>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <InfoRow label="Usuário" value={selectedUser.full_name || selectedUser.email} />
              <InfoRow label="E-mail" value={selectedUser.email} />
            </div>
            <div className="space-y-2">
              <InfoRow label="Perfil" value={CARGO_BY_ID[selectedUser.role]?.name || selectedUser.role} />
              <InfoRow label="Acesso ao acervo" value={hasAcervoAccess(selectedUser) ? 'Permitido' : 'Restrito'} />
            </div>
            <div className="flex min-w-52 flex-col justify-center gap-2">
              <button type="button" disabled={savingAccess || selectedUser.role === 'superadmin'} onClick={() => toggleAcervoAccess(selectedUser)} className={`rounded-lg px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${hasAcervoAccess(selectedUser) ? 'border border-rose-500/40 text-rose-300 hover:bg-rose-500/10' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'}`}>
                {savingAccess ? 'Salvando...' : hasAcervoAccess(selectedUser) ? 'Restringir acesso ao acervo' : 'Permitir acesso ao acervo'}
              </button>
              {selectedUser.role === 'superadmin' && <p className="text-center text-[10px] text-slate-500">Superadministrador mantém acesso total.</p>}
              {accessError && <p className="text-center text-[10px] text-rose-400">{accessError}</p>}
            </div>
          </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function MonitoringTab({ overview, localDemo = false }) {
  const navigate = useNavigate();
  const [liveOverview, setLiveOverview] = useState(overview);
  const [selectedServiceKey, setSelectedServiceKey] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const summary = buildAcervoSystemSummary(liveOverview);
  const ICONS = [MonitorCog, CheckCircle2, AlertTriangle, CheckCircle2, MonitorCog];
  const selectedService = liveOverview.services.find((service) => service.key === selectedServiceKey) || null;
  const incidents = [];
  if (liveOverview.processing.failed) incidents.push(`${liveOverview.processing.failed} processamento(s) com falha`);
  if (liveOverview.assets.failures) incidents.push(`${liveOverview.assets.failures} arquivo(s) com falha de indexação`);

  const resourceRows = [
    { label: 'CPU', detail: '8 núcleos', value: 34, color: 'from-sky-400 to-violet-500' },
    { label: 'Memória', detail: '12 GB / 32 GB', value: 38, color: 'from-sky-400 to-violet-500' },
    { label: 'GPU', detail: '4 GB / 8 GB', value: 56, color: 'from-sky-400 to-violet-500' },
    { label: 'Storage', detail: formatBytes(liveOverview.assets.storage_bytes), value: 72, color: 'from-amber-400 to-orange-400' },
    { label: 'Fila (jobs)', detail: `${liveOverview.processing.active || 0} em andamento`, value: 43, color: 'from-sky-400 to-violet-500' },
  ];
  const models = [
    ['Whisper Large v3', 'Transcrição'], ['YOLOv8', 'Detecção de objetos'],
    ['Tesseract OCR', 'Extração de texto'], ['Text Embeddings', 'Busca semântica'],
  ];

  async function refreshSystem() {
    setRefreshing(true);
    try { setLiveOverview(localDemo ? DEMO_MANAGEMENT_OVERVIEW : await withDemoFallback(getManagementOverview, DEMO_MANAGEMENT_OVERVIEW)); } finally { setRefreshing(false); }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summary.map((item, index) => (
          <Stat key={item.id} title={item.label} value={item.value} icon={ICONS[index]} tone={item.tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Serviços e pipelines" right={<button type="button" onClick={refreshSystem} disabled={refreshing} className="text-xs font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-50">{refreshing ? 'Atualizando...' : 'Atualizar status'}</button>}>
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <div className="grid grid-cols-[1fr_auto] bg-slate-950/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <span>Serviço</span><span>Status</span>
            </div>
            {liveOverview.services.map((s) => (
              <button type="button" key={s.key} onClick={() => setSelectedServiceKey(s.key)} className={`flex w-full items-center justify-between border-t bg-slate-900/40 px-3 py-2.5 text-left transition hover:bg-slate-800/60 ${selectedServiceKey === s.key ? 'border-sky-500/60' : 'border-slate-800'}`}>
                <div>
                  <p className="font-medium text-slate-200">{s.label}</p>
                  <p className="text-xs text-slate-500">{s.detail}</p>
                </div>
                <StatusBadge status={s.status} />
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Recursos do sistema">
          <div className="space-y-3">
            {resourceRows.map((resource) => (
              <div key={resource.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-slate-200">{resource.label}</span><span className="text-slate-400">{resource.detail} · <strong className="text-slate-100">{resource.value}%</strong></span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full bg-gradient-to-r ${resource.color}`} style={{ width: `${resource.value}%` }} /></div>
              </div>
            ))}
            {localDemo && <p className="text-[10px] text-slate-500">Prévia visual local; os valores reais serão usados quando o monitoramento do tenant estiver conectado.</p>}
          </div>
        </Panel>
      </div>

      {selectedService && (
        <Panel title={`Diagnóstico · ${selectedService.label}`} right={<button type="button" onClick={() => setSelectedServiceKey(null)} aria-label="Fechar diagnóstico" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800"><X size={15} /></button>}>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <InfoRow label="Serviço" value={selectedService.label} />
            <InfoRow label="Diagnóstico atual" value={selectedService.detail || 'Sem detalhes adicionais'} />
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedService.status} />
              <button type="button" onClick={refreshSystem} disabled={refreshing} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">Revalidar agora</button>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Panel title="Modelos de IA">
        <div className="grid gap-2 sm:grid-cols-2">
          {models.map(([name, detail]) => <div key={name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-200">{name}</p><Badge tone="success">OK</Badge></div><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}
        </div>
      </Panel>

      <Panel title="Incidentes recentes">
        <div className="space-y-2">
          {incidents.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Nenhum incidente técnico aberto.</p>}
          {incidents.map((incident) => (
            <div key={incident} className="flex w-full items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-left text-sm text-rose-200">
              <AlertTriangle size={14} /> {incident}
              <button type="button" onClick={refreshSystem} className="ml-auto text-[11px] font-semibold text-sky-300 hover:text-sky-200">Revalidar</button>
              <button type="button" onClick={() => navigate('/management?tab=processamentos')} className="text-[11px] font-semibold text-slate-400 hover:text-slate-200">Ver fila</button>
            </div>
          ))}
        </div>
      </Panel>
      </div>
    </div>
  );
}
